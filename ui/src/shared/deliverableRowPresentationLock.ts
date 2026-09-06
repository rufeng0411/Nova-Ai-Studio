// PD-SAAS-FORK: presentation-layer monotonic lock for deliverable row status.
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { isDeliverableStatusLockEnabled } from './conversationDeliverableFeatureFlags';

export type DeliverablePresentationLockEntry = {
  status: DeliverableDockRow['status'];
  resolvedPath?: string;
  apiPath?: string;
  linkable?: boolean;
  previewable?: boolean;
  validationSettled?: boolean;
};

export type DeliverablePresentationLockStore = Record<string, DeliverablePresentationLockEntry>;

function lockKey(sessionId: string, contractHash: string, slotId: string): string {
  return `${sessionId}::${contractHash}::${slotId}`;
}

export function readDeliverablePresentationLockStore(
  store: DeliverablePresentationLockStore | undefined,
): DeliverablePresentationLockStore {
  return store ?? {};
}

export function applyDeliverableRowPresentationLock(
  rows: DeliverableDockRow[],
  options: {
    sessionId: string;
    contractHash: string;
    lockStore: DeliverablePresentationLockStore;
    validationSettled: boolean;
    engineMissingPaths?: string[];
  },
): { rows: DeliverableDockRow[]; lockStore: DeliverablePresentationLockStore } {
  if (!isDeliverableStatusLockEnabled()) {
    return { rows, lockStore: options.lockStore };
  }

  const nextStore = { ...options.lockStore };
  const missingSet = new Set(
    (options.engineMissingPaths ?? []).map((p) => p.replace(/\\/g, '/').toLowerCase()),
  );

  const nextRows = rows.map((row) => {
    const slotId = row.id ?? row.label;
    const key = lockKey(options.sessionId, options.contractHash, slotId);
    const prev = nextStore[key];
    const basename = (row.resolvedPath ?? row.path ?? row.pathHint ?? row.label ?? '').split('/').pop()?.toLowerCase() ?? '';
    const engineMissing = basename && missingSet.has(basename);

    if (
      row.status === 'delivered'
      && row.resolvedPath
      && options.validationSettled
    ) {
      nextStore[key] = {
        status: 'delivered',
        resolvedPath: row.resolvedPath,
        apiPath: row.apiPath ?? row.resolvedPath,
        linkable: row.linkable,
        previewable: row.previewable,
        validationSettled: true,
      };
      return row;
    }

    if (prev?.status === 'delivered' && prev.resolvedPath && !engineMissing) {
      return {
        ...row,
        status: 'delivered',
        resolvedPath: prev.resolvedPath,
        apiPath: prev.apiPath ?? prev.resolvedPath,
        linkable: prev.linkable ?? true,
        previewable: prev.previewable ?? Boolean(prev.resolvedPath),
      };
    }

    return row;
  });

  return { rows: nextRows, lockStore: nextStore };
}
