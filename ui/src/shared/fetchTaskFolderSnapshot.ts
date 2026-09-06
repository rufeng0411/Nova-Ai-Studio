/**
 * PD-SAAS-FORK: fetch scoped task-folder snapshot for Dock disk enrich.
 */
import { authenticatedFetch } from '../utils/api';
import type { TaskFolderSnapshotFile } from './buildUnifiedDeliverableView';
import type { SessionDeliverableSlotUi } from './resolveSessionDeliverableManifest';

export type TaskFolderSnapshotBinding = {
  requiredCount: number;
  matchedCount: number;
  complete: boolean;
  incompleteReason?: string;
};

export type TaskFolderSnapshotStatus = 'not_applicable' | 'loading' | 'complete' | 'inconclusive';

export function resolveTaskFolderSnapshotCompletenessForValidation(
  status: TaskFolderSnapshotStatus,
): boolean | undefined {
  switch (status) {
    case 'not_applicable':
      return undefined;
    case 'loading':
    case 'inconclusive':
      return false;
    case 'complete':
      return true;
    default: {
      const exhaustiveStatus: never = status;
      return exhaustiveStatus;
    }
  }
}

export type TaskFolderSnapshotEnvelope = {
  files: TaskFolderSnapshotFile[];
  status: TaskFolderSnapshotStatus;
  snapshotVersion: number;
  truncated: boolean;
  scannedCount: number;
  excludedCount: number;
  snapshotComplete: boolean;
  truncationReason?: string;
  binding: TaskFolderSnapshotBinding;
  scopeDir?: string;
};

const snapshotCache = new Map<string, { at: number; envelope: TaskFolderSnapshotEnvelope }>();
const COALESCE_MS = 2000;

type FetchTaskFolderSnapshotInput = {
  projectName: string;
  scopeDir: string;
  slots?: SessionDeliverableSlotUi[];
  force?: boolean;
  contractHash?: string | null;
  goalVersion?: number | null;
};

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeIdentityPath(value: unknown): string {
  return String(value ?? '').replace(/\\/g, '/').trim().toLowerCase();
}

export function buildTaskFolderSnapshotContractIdentity(input: {
  slots?: SessionDeliverableSlotUi[];
  contractHash?: string | null;
}): string {
  const contractHash = String(input.contractHash ?? '').trim();
  const canonicalSlots = (input.slots ?? [])
    .map((slot) => ({
      id: String(slot.id ?? '').trim(),
      label: String(slot.label ?? '').trim(),
      kind: String(slot.kind ?? '').trim().toLowerCase(),
      count: typeof slot.count === 'number' && Number.isFinite(slot.count)
        ? Math.max(1, Math.floor(slot.count))
        : 1,
      required: slot.required !== false,
      status: slot.status ?? 'active',
      pathHint: normalizeIdentityPath(slot.pathHint),
      pathHints: [...new Set((slot.pathHints ?? []).map(normalizeIdentityPath).filter(Boolean))].sort(),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return [
    contractHash ? `contract:${contractHash}` : '',
    `slots:${JSON.stringify(canonicalSlots)}`,
  ].filter(Boolean).join('|');
}

export function createNotApplicableTaskFolderSnapshot(
  scopeDir = '',
  reason = 'snapshot_not_applicable',
): TaskFolderSnapshotEnvelope {
  return {
    files: [],
    status: 'not_applicable',
    snapshotVersion: 0,
    truncated: false,
    scannedCount: 0,
    excludedCount: 0,
    snapshotComplete: false,
    truncationReason: reason,
    binding: {
      requiredCount: 0,
      matchedCount: 0,
      complete: false,
      incompleteReason: reason,
    },
    scopeDir,
  };
}

export function createLoadingTaskFolderSnapshot(scopeDir = ''): TaskFolderSnapshotEnvelope {
  return {
    ...createInconclusiveTaskFolderSnapshot(scopeDir, 'snapshot_loading'),
    status: 'loading',
  };
}

export function createInconclusiveTaskFolderSnapshot(
  scopeDir = '',
  reason = 'snapshot_not_loaded',
  cached?: TaskFolderSnapshotEnvelope,
): TaskFolderSnapshotEnvelope {
  return {
    files: cached?.files ?? [],
    status: 'inconclusive',
    snapshotVersion: cached?.snapshotVersion ?? 2,
    truncated: true,
    scannedCount: cached?.scannedCount ?? 0,
    excludedCount: cached?.excludedCount ?? 0,
    snapshotComplete: false,
    truncationReason: reason,
    binding: {
      requiredCount: cached?.binding.requiredCount ?? 0,
      matchedCount: cached?.binding.matchedCount ?? 0,
      complete: false,
      incompleteReason: cached?.binding.incompleteReason ?? reason,
    },
    scopeDir: cached?.scopeDir ?? scopeDir,
  };
}

function normalizeSnapshotEnvelope(body: unknown, scopeDir: string): TaskFolderSnapshotEnvelope {
  const record = recordValue(body);
  const bindingRecord = recordValue(record.binding);
  const snapshotVersion = safeCount(record.snapshotVersion);
  const truncated = record.truncated === true;
  const hasV2Metadata = snapshotVersion >= 2
    && typeof record.snapshotComplete === 'boolean'
    && typeof record.truncated === 'boolean';
  const snapshotComplete = hasV2Metadata && record.snapshotComplete === true && !truncated;
  const status: TaskFolderSnapshotStatus = !hasV2Metadata
    ? 'not_applicable'
    : snapshotComplete
      ? 'complete'
      : 'inconclusive';
  const files = Array.isArray(record.files)
    ? record.files.filter((file): file is TaskFolderSnapshotFile => {
      if (!file || typeof file !== 'object') return false;
      const candidate = file as Partial<TaskFolderSnapshotFile>;
      return typeof candidate.path === 'string' && typeof candidate.basename === 'string';
    })
    : [];

  return {
    files,
    status,
    snapshotVersion: snapshotVersion || 1,
    truncated,
    scannedCount: safeCount(record.scannedCount),
    excludedCount: safeCount(record.excludedCount),
    snapshotComplete,
    truncationReason: typeof record.truncationReason === 'string'
      ? record.truncationReason
      : undefined,
    binding: {
      requiredCount: safeCount(bindingRecord.requiredCount),
      matchedCount: safeCount(bindingRecord.matchedCount),
      complete: bindingRecord.complete === true && snapshotComplete,
      incompleteReason: typeof bindingRecord.incompleteReason === 'string'
        ? bindingRecord.incompleteReason
        : undefined,
    },
    scopeDir: typeof record.scopeDir === 'string' ? record.scopeDir : scopeDir,
  };
}

export async function fetchTaskFolderSnapshotEnvelope(
  input: FetchTaskFolderSnapshotInput,
): Promise<TaskFolderSnapshotEnvelope> {
  const scopeDir = input.scopeDir.replace(/\\/g, '/').replace(/\/+$/, '');
  if (
    !input.projectName
    || !scopeDir
    || (scopeDir !== 'artifacts' && !scopeDir.startsWith('artifacts/'))
  ) {
    return createNotApplicableTaskFolderSnapshot(scopeDir, 'snapshot_prerequisites_missing');
  }

  const contractIdentity = buildTaskFolderSnapshotContractIdentity(input);
  const key = [
    input.projectName,
    scopeDir.toLowerCase(),
    contractIdentity,
    input.goalVersion ?? '',
  ].join('::');
  const cached = snapshotCache.get(key);
  if (!input.force && cached && Date.now() - cached.at < COALESCE_MS) {
    return cached.envelope;
  }

  const params = new URLSearchParams({ scopeDir });
  if (input.slots?.length) {
    params.set('slotsJson', JSON.stringify(input.slots));
  }

  try {
    const res = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(input.projectName)}/deliverables/task-folder-snapshot?${params.toString()}`,
    );
    if (!res.ok) {
      return createInconclusiveTaskFolderSnapshot(
        scopeDir,
        'request_failed_cached_fallback',
        cached?.envelope,
      );
    }

    const envelope = normalizeSnapshotEnvelope(await res.json(), scopeDir);
    snapshotCache.set(key, { at: Date.now(), envelope });
    return envelope;
  } catch {
    return createInconclusiveTaskFolderSnapshot(
      scopeDir,
      'request_failed_cached_fallback',
      cached?.envelope,
    );
  }
}

export async function fetchTaskFolderSnapshot(
  input: FetchTaskFolderSnapshotInput,
): Promise<TaskFolderSnapshotFile[]> {
  const envelope = await fetchTaskFolderSnapshotEnvelope(input);
  return envelope.files;
}

export function clearTaskFolderSnapshotCache(projectName?: string): void {
  if (!projectName) {
    snapshotCache.clear();
    return;
  }
  for (const key of snapshotCache.keys()) {
    if (key.startsWith(`${projectName}::`)) snapshotCache.delete(key);
  }
}
