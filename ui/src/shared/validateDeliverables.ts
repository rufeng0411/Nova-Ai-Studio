// PD-SAAS-FORK: deliverable verify-before-show (client-side batch validate)

import type { DeliverableItem } from './collectDeliverables';
import { fetchWithBackoff } from './fetchWithBackoff';
import { getArtifactDirectory, getArtifactFileName, normalizeArtifactPath } from './artifactPaths';
import {
  deliverableBasenamesMatch,
  deliverableResolveMatchesRequest,
  isBareDeliverableFilename,
  isPhantomDeliverablePath,
  normalizeHintDir,
} from '../../shared/deliverablePathResolve.mjs';

export type DeliverableValidationStatus = 'verified' | 'softVerified' | 'pending' | 'broken' | 'phantom';

export type ValidatedDeliverable = DeliverableItem & {
  validationStatus: DeliverableValidationStatus;
  resolvedPath?: string;
  previewKind?: string;
  sizeBytes?: number;
};

export type ResolvedDeliverable = {
  id: string;
  logicalPath: string;
  resolvedPath: string;
  hintDir?: string;
  kind: DeliverableItem['kind'];
  displayName: string;
  status: DeliverableValidationStatus;
  sourceTurnId?: string;
};

export type ValidatedDeliverableSet = {
  displayItems: ValidatedDeliverable[];
  folderItems: ValidatedDeliverable[];
  resolvedItems: ResolvedDeliverable[];
  filteredCount: number;
  /** False while server validate is in flight for this item set. */
  validationSettled: boolean;
};

const SOURCE_PRIORITY: Record<DeliverableItem['source'], number> = {
  tool: 3,
  process: 2,
  text: 1,
};

function deliverableKey(item: DeliverableItem): string {
  const path = (item.apiPath || item.path || item.id).replace(/\\/g, '/');
  if (/(?:^|\/)artifacts\/slides-[^/]+\//i.test(path)) {
    return path.toLowerCase();
  }
  return path.split('/').pop()?.toLowerCase() ?? path.toLowerCase();
}

export function rankDeliverableSource(source: DeliverableItem['source']): number {
  return SOURCE_PRIORITY[source] ?? 0;
}

function validationRank(status: DeliverableValidationStatus, resolvedPath?: string): number {
  switch (status) {
    case 'verified':
      return 100;
    case 'softVerified':
      return 80;
    case 'pending':
      return 10;
    case 'broken':
      return resolvedPath ? 30 : 0;
    case 'phantom':
      return -100;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function pathSpecificityRank(item: ValidatedDeliverable): number {
  const path = (item.resolvedPath || item.apiPath || item.path || '').replace(/\\/g, '/');
  if (!path || isPhantomDeliverablePath(path)) return -200;
  let score = path.split('/').filter(Boolean).length * 3;
  if (path.includes('artifacts/')) score += 25;
  if (path.includes('cloud-storage/')) score += 10;
  return score;
}

function deliverablePriorityScore(item: ValidatedDeliverable): number {
  return validationRank(item.validationStatus, item.resolvedPath)
    + rankDeliverableSource(item.source) * 10
    + pathSpecificityRank(item);
}

export function dedupeValidatedByPriority(items: ValidatedDeliverable[]): ValidatedDeliverable[] {
  const byBase = new Map<string, ValidatedDeliverable>();
  for (const item of items) {
    const key = deliverableKey(item);
    const existing = byBase.get(key);
    if (!existing) {
      byBase.set(key, item);
      continue;
    }
    if (deliverablePriorityScore(item) >= deliverablePriorityScore(existing)) {
      byBase.set(key, item);
    }
  }
  return [...byBase.values()];
}

function expandDeliverableValidationPath(
  lookupPath: string,
  hintDir?: string,
): string {
  if (!lookupPath || isPhantomDeliverablePath(lookupPath)) {
    return lookupPath;
  }
  const hint = hintDir ? normalizeHintDir(hintDir) : '';
  if (!hint || !isBareDeliverableFilename(lookupPath)) {
    return lookupPath;
  }
  return `${hint}/${getArtifactFileName(lookupPath)}`;
}

export type ValidateDeliverablesResponse = {
  items: Array<{
    path: string;
    resolvedPath?: string;
    status: DeliverableValidationStatus;
    previewKind?: string;
    sizeBytes?: number;
    source?: DeliverableItem['source'];
  }>;
};

/** PD-SAAS-FORK: bound validate fetch so UI never sticks on「校验中…」when Bridge is wedged. */
export const DELIVERABLE_VALIDATE_FETCH_TIMEOUT_MS = 12_000;

function deliverableValidationHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('auth-token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function validateDeliverablesClient(
  projectName: string,
  items: DeliverableItem[],
  options?: { hidePhantom?: boolean; hintDir?: string },
): Promise<ValidatedDeliverable[]> {
  if (!projectName || items.length === 0) return [];
  const hintDir = options?.hintDir ?? items.find((item) => item.turnArtifactDir)?.turnArtifactDir;
  const validationRows = items
    .map((item) => {
      const lookupPath = item.apiPath || item.path;
      if (!lookupPath || isPhantomDeliverablePath(lookupPath)) {
        return null;
      }
      return {
        item,
        lookupPath,
        requestPath: expandDeliverableValidationPath(lookupPath, hintDir),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);
  if (validationRows.length === 0) {
    return items.map((item) => ({
      ...item,
      validationStatus: isPhantomDeliverablePath(item.apiPath || item.path) ? 'phantom' as const : 'broken' as const,
    }));
  }

  let response: ValidateDeliverablesResponse;
  try {
    const { response: res } = await fetchWithBackoff(
      `/api/projects/${encodeURIComponent(projectName)}/deliverables/validate`,
      {
        method: 'POST',
        headers: deliverableValidationHeaders(),
        credentials: 'include',
        signal: AbortSignal.timeout(DELIVERABLE_VALIDATE_FETCH_TIMEOUT_MS),
        body: JSON.stringify({
          paths: validationRows.map((row) => row.requestPath),
          ...(hintDir ? { hintDir } : {}),
        }),
      },
    );
    if (!res.ok) {
      // Transient API failure — keep tool/process items visible; only text phantoms stay hidden.
      return items.map((item) => ({
        ...item,
        validationStatus: item.source === 'text' ? 'phantom' : 'pending',
      }));
    }
    response = await res.json() as ValidateDeliverablesResponse;
  } catch {
    return items.map((item) => ({
      ...item,
      validationStatus: 'pending' as const,
    }));
  }

  const statusByPath = new Map(
    (response.items ?? []).map((row) => [row.path, row]),
  );

  const validated: ValidatedDeliverable[] = items.map((item) => {
    const lookupPath = item.apiPath || item.path;
    if (!lookupPath || isPhantomDeliverablePath(lookupPath)) {
      return {
        ...item,
        validationStatus: 'phantom' as const,
      };
    }
    const requestPath = expandDeliverableValidationPath(lookupPath, hintDir);
    const row = statusByPath.get(requestPath) ?? statusByPath.get(lookupPath);
    let validationStatus: DeliverableValidationStatus = row?.status ?? 'pending';
    const resolvedPath = row?.resolvedPath;
    if (
      validationStatus === 'verified'
      && resolvedPath
      && !deliverableResolveMatchesRequest(lookupPath, resolvedPath)
    ) {
      const reqBase = getArtifactFileName(lookupPath);
      const resBase = getArtifactFileName(resolvedPath);
      validationStatus = deliverableBasenamesMatch(resBase, reqBase) ? 'pending' : 'broken';
    }
    if (validationStatus === 'broken' && resolvedPath) {
      validationStatus = 'softVerified';
    }
    const shouldApplyResolvedPath = Boolean(
      resolvedPath
      && (validationStatus === 'verified'
        || validationStatus === 'softVerified'),
    );
    return {
      ...item,
      ...(shouldApplyResolvedPath ? { apiPath: resolvedPath, path: resolvedPath } : {}),
      validationStatus,
      resolvedPath,
      previewKind: row?.previewKind,
      sizeBytes: row?.sizeBytes,
    };
  });

  const deduped = dedupeValidatedByPriority(validated);
  if (options?.hidePhantom !== false) {
    return deduped.filter((item) => item.validationStatus !== 'phantom');
  }
  return deduped;
}

/** Whether a validated item may appear in T2 preview cards (AGENTS: 校验勿过严). */
export function shouldDisplayValidatedDeliverable(item: ValidatedDeliverable): boolean {
  if (item.validationStatus === 'phantom') {
    return false;
  }
  if (item.validationStatus === 'broken' && !item.resolvedPath) {
    return false;
  }
  if (item.validationStatus === 'pending') {
    const hasResolved = Boolean(item.resolvedPath);
    const isToolSource = item.source === 'tool' || item.source === 'process';
    if (hasResolved && isToolSource) {
      return true;
    }
    return false;
  }
  const lookup = item.apiPath || item.path;
  if (lookup && isPhantomDeliverablePath(lookup)) {
    return false;
  }
  return true;
}

export function applyValidatedDeliverablePaths(item: ValidatedDeliverable): ValidatedDeliverable {
  if (!item.resolvedPath || !shouldDisplayValidatedDeliverable(item)) {
    return item;
  }
  return { ...item, apiPath: item.resolvedPath, path: item.resolvedPath };
}

export function filterDisplayDeliverables(items: ValidatedDeliverable[]): ValidatedDeliverable[] {
  return items
    .filter(shouldDisplayValidatedDeliverable)
    .map(applyValidatedDeliverablePaths);
}

function curatedDeliverableDisplayFallback(
  rawItems: DeliverableItem[],
  validatedItems?: ValidatedDeliverable[],
): ValidatedDeliverable[] {
  // 服务端已确认为坏路径且无 resolvedPath 的正文(text)幻影：不回填，避免被复活为 pending。
  // AGENTS：无 resolvedPath 的 broken 不展示；text 幻影禁止串台进成果区。
  const serverBrokenTextPaths = new Set(
    (validatedItems ?? [])
      .filter(
        (item) =>
          item.source === 'text'
          && item.validationStatus === 'broken'
          && !item.resolvedPath,
      )
      .map((item) => normalizeArtifactPath(item.apiPath || item.path))
      .filter(Boolean),
  );
  return rawItems
    .filter((item) => {
      const normalized = normalizeArtifactPath(item.apiPath || item.path);
      if (!normalized || isPhantomDeliverablePath(normalized)) return false;
      if (item.source === 'text' && serverBrokenTextPaths.has(normalized)) return false;
      return true;
    })
    .map((item) => ({
      ...item,
      validationStatus: 'pending' as const,
    }));
}

export function buildValidatedDeliverableSet(
  rawItems: DeliverableItem[],
  validatedItems: ValidatedDeliverable[],
): ValidatedDeliverableSet {
  const sourceItems = validatedItems.length > 0
    ? validatedItems.filter((item) => item.validationStatus !== 'phantom'
      && !isPhantomDeliverablePath(item.apiPath || item.path))
    : rawItems.map((item) => ({ ...item, validationStatus: 'pending' as const }));
  const folderItems = sourceItems.map(applyValidatedDeliverablePaths);
  let displayItems = filterDisplayDeliverables(folderItems);
  if (displayItems.length === 0 && rawItems.length > 0) {
    displayItems = curatedDeliverableDisplayFallback(rawItems, validatedItems);
  }
  return {
    displayItems,
    folderItems,
    resolvedItems: buildResolvedDeliverables(rawItems, folderItems),
    filteredCount: 0,
    validationSettled: true,
  };
}

function buildResolvedDeliverables(
  rawItems: DeliverableItem[],
  items: ValidatedDeliverable[],
): ResolvedDeliverable[] {
  const rawById = new Map(rawItems.map((item) => [item.id, item]));
  return items
    .map((item) => {
      const raw = rawById.get(item.id);
      const logicalPath = normalizeArtifactPath(raw?.apiPath || raw?.path || item.apiPath || item.path);
      const resolvedPath = normalizeArtifactPath(item.resolvedPath || item.apiPath || item.path);
      if (!logicalPath || !resolvedPath) return null;
      const hintDir = item.turnArtifactDir
        ?? getArtifactDirectory(resolvedPath)
        ?? getArtifactDirectory(logicalPath)
        ?? undefined;
      return {
        id: item.id,
        logicalPath,
        resolvedPath,
        hintDir,
        kind: item.kind,
        displayName: getArtifactFileName(resolvedPath) || resolvedPath,
        status: item.validationStatus,
        sourceTurnId: typeof (item as { turnId?: unknown }).turnId === 'string'
          ? (item as { turnId: string }).turnId
          : undefined,
      };
    })
    .filter((item): item is ResolvedDeliverable => item != null);
}
