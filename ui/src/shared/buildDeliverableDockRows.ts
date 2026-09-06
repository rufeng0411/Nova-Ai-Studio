/**
 * PD-SAAS-FORK: session dock rows — wraps buildDeliverableSummaryRows with SDM stage metadata.
 */

import { pathSatisfiesSdmSlot } from '../../../src/saas/deliverables/sdmSlotMatching';
import {
  buildDeliverableSummaryRows,
  type BuildDeliverableSummaryRowsInput,
  type DeliverableSummaryRow,
  type ExpectedManifestEntry,
} from './buildDeliverableSummaryRows';
import type { DeliverableItem } from './collectDeliverables';
import { getArtifactFileName, normalizeArtifactPath } from './artifactPaths';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';
import type { SessionDeliverableSlotUi } from './resolveSessionDeliverableManifest';

export type DeliverableDockRow = DeliverableSummaryRow & {
  stageId?: string;
  stageOrder?: number;
};

export type BuildDeliverableDockRowsInput = BuildDeliverableSummaryRowsInput & {
  manifestSlots?: SessionDeliverableSlotUi[];
};

export function buildDeliverableDockRows(input: BuildDeliverableDockRowsInput): DeliverableDockRow[] {
  const rows = buildDeliverableSummaryRows(input);
  const slotById = new Map((input.manifestSlots ?? []).map((slot) => [slot.id, slot]));
  const slotByLabel = new Map(
    (input.manifestSlots ?? []).map((slot) => [slot.label.trim().toLowerCase(), slot]),
  );

  return rows.map((row) => {
    const slot = slotById.get(row.id)
      ?? slotByLabel.get(row.label.trim().toLowerCase());
    if (!slot?.stageId) return row;
    return {
      ...row,
      stageId: slot.stageId,
      stageOrder: slot.stageOrder,
    };
  });
}

function normalizeDockPathKey(path: string): string {
  return normalizeArtifactPath(path).replace(/\/+$/, '').toLowerCase();
}

function pathUnderScopeDir(filePath: string, scopeDir: string | null | undefined): boolean {
  if (!scopeDir) return true;
  const normalized = normalizeArtifactPath(filePath).toLowerCase();
  const scope = normalizeArtifactPath(scopeDir).replace(/\/+$/, '').toLowerCase();
  return normalized === scope || normalized.startsWith(`${scope}/`);
}

function dockRowMatchesFolderItem(
  row: DeliverableDockRow,
  item: DeliverableItem,
  slot?: SessionDeliverableSlotUi,
  entry?: ExpectedManifestEntry,
  scopeDir?: string | null,
): boolean {
  const rowPaths = [row.path, row.resolvedPath, row.apiPath]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map(normalizeDockPathKey);
  const itemPaths = [item.path, item.resolvedPath, item.apiPath]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map(normalizeDockPathKey);

  for (const rowPath of rowPaths) {
    for (const itemPath of itemPaths) {
      if (rowPath === itemPath) return true;
      const rowBase = rowPath.split('/').pop() ?? '';
      const itemBase = itemPath.split('/').pop() ?? '';
      if (rowBase.length > 0 && rowBase === itemBase) {
        if (scopeDir && !pathUnderScopeDir(itemPath, scopeDir)) continue;
        return true;
      }
    }
  }

  const itemPath = item.resolvedPath || item.apiPath || item.path;
  if (!itemPath) return false;
  if (scopeDir && !pathUnderScopeDir(itemPath, scopeDir)) return false;

  const slotLike = {
    id: row.id,
    label: row.label,
    kind: slot?.kind ?? entry?.kind,
    pathHint: slot?.pathHint ?? row.path ?? entry?.path,
    pathHints: slot?.pathHints ?? entry?.pathHints,
  };
  return pathSatisfiesSdmSlot(itemPath, slotLike);
}

/** PD-SAAS-FORK: align dock list with task folder — enrich slot rows; optional extra rows only without SDM baseline. */
export function mergeFolderItemsIntoDockRows(
  rows: DeliverableDockRow[],
  folderItems: DeliverableItem[],
  options?: {
    allowExtraRows?: boolean;
    manifestSlots?: SessionDeliverableSlotUi[];
    expectedEntries?: ExpectedManifestEntry[];
    /** PD-SAAS-FORK (STDA): basename match only within this task root — prevents index.html crosstalk. */
    scopeDir?: string | null;
    /** When false, folder hits must not promote rows to delivered (validation in flight). */
    validationSettled?: boolean;
    /** PD-SAAS-FORK P0-C′: require engine verified path before folder promote. */
    folderPromoteRequiresVerified?: boolean;
    verifiedPaths?: string[] | null;
  },
): DeliverableDockRow[] {
  if (folderItems.length === 0) return rows;

  const allowExtraRows = options?.allowExtraRows ?? true;
  const scopeDir = options?.scopeDir ?? null;
  const validationSettled = options?.validationSettled ?? true;
  const folderPromoteRequiresVerified = options?.folderPromoteRequiresVerified ?? false;
  const verifiedPaths = (options?.verifiedPaths ?? [])
    .map((p) => normalizeDockPathKey(p))
    .filter(Boolean);
  const slotById = new Map((options?.manifestSlots ?? []).map((slot) => [slot.id, slot]));
  const entryById = new Map(
    (options?.expectedEntries ?? [])
      .filter((entry) => entry.id)
      .map((entry) => [entry.id as string, entry]),
  );
  const merged = rows.map((row) => ({ ...row }));

  for (const item of folderItems) {
    const path = normalizeArtifactPath(item.resolvedPath || item.apiPath || item.path);
    if (!path || isNonUserDeliverablePath(path)) continue;
    if (scopeDir && !pathUnderScopeDir(path, scopeDir)) continue;

    const matchIndex = merged.findIndex((row) => {
      const rowSlot = slotById.get(row.id);
      const entry = entryById.get(row.id);
      return dockRowMatchesFolderItem(row, item, rowSlot, entry, scopeDir);
    });
    if (matchIndex >= 0) {
      const row = merged[matchIndex];
      const enrichedPath = normalizeArtifactPath(item.resolvedPath || path);
      const currentPath = row.resolvedPath || row.apiPath || row.path || '';
      const pathVerified = verifiedPaths.some((verified) => {
        const itemKey = normalizeDockPathKey(enrichedPath);
        return verified === itemKey || verified.endsWith(`/${itemKey.split('/').pop() ?? ''}`);
      });
      const mayPromoteDelivered = validationSettled
        && (!folderPromoteRequiresVerified || pathVerified)
        && (row.status === 'delivered' || pathVerified);
      const needsEnrich = !row.resolvedPath
        || (!currentPath.includes('/') && enrichedPath.includes('/'))
        || normalizeDockPathKey(currentPath) !== normalizeDockPathKey(enrichedPath);
      const currentUnderScope = Boolean(scopeDir && currentPath && pathUnderScopeDir(currentPath, scopeDir));
      const enrichedUnderScope = pathUnderScopeDir(enrichedPath, scopeDir);
      if (needsEnrich && currentUnderScope && !enrichedUnderScope) {
        continue;
      }
      if (needsEnrich) {
        const nextStatus = mayPromoteDelivered
          ? 'delivered'
          : (row.status === 'delivered' ? 'checking' : row.status);
        merged[matchIndex] = {
          ...row,
          status: nextStatus,
          resolvedPath: enrichedPath,
          apiPath: item.apiPath ? normalizeArtifactPath(item.apiPath) : row.apiPath,
          path: normalizeArtifactPath(item.apiPath || item.path || row.path),
          previewable: Boolean(enrichedPath),
          linkable: Boolean(enrichedPath),
        };
      } else if (enrichedPath && !row.linkable) {
        merged[matchIndex] = {
          ...row,
          resolvedPath: row.resolvedPath || enrichedPath,
          previewable: true,
          linkable: true,
        };
      }
      continue;
    }

    if (!allowExtraRows) continue;

    const normalized = normalizeDockPathKey(path);
    if (!validationSettled) continue;
    merged.push({
      id: `folder-${normalized.replace(/[^a-z0-9]+/g, '-')}`,
      label: getArtifactFileName(path),
      path: normalizeArtifactPath(item.apiPath || item.path),
      status: 'delivered',
      resolvedPath: normalizeArtifactPath(item.resolvedPath || path),
      apiPath: item.apiPath ? normalizeArtifactPath(item.apiPath) : undefined,
      previewable: true,
      linkable: true,
    });
  }
  return merged;
}

export { type DeliverableSummaryRow };
