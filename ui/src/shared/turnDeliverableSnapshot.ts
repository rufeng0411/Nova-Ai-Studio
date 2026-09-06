/**
 * PD-SAAS-FORK: per-turn frozen snapshot of deliverable summary row states.
 * Historical tables read snapshots only — they do not upgrade when ledger changes (C1).
 */
import type { ValidatedDeliverable } from './validateDeliverables';

export type TurnSnapshotRow = {
  path: string;
  apiPath?: string;
  resolvedPath?: string;
  validationStatus: ValidatedDeliverable['validationStatus'];
};

export type TurnDeliverableSnapshot = {
  messageId: string;
  rows: TurnSnapshotRow[];
  capturedAt: number;
};

const snapshotsBySession = new Map<string, Map<string, TurnDeliverableSnapshot>>();

function sessionSnapshots(sessionKey: string): Map<string, TurnDeliverableSnapshot> {
  let map = snapshotsBySession.get(sessionKey);
  if (!map) {
    map = new Map();
    snapshotsBySession.set(sessionKey, map);
  }
  return map;
}

export function writeTurnSnapshot(
  sessionKey: string,
  messageId: string,
  items: ValidatedDeliverable[],
): void {
  const map = sessionSnapshots(sessionKey);
  map.set(messageId, {
    messageId,
    rows: items.map((item) => ({
      path: item.path,
      apiPath: item.apiPath,
      resolvedPath: item.resolvedPath,
      validationStatus: item.validationStatus ?? 'pending',
    })),
    capturedAt: Date.now(),
  });
}

export function readTurnSnapshot(
  sessionKey: string,
  messageId: string,
): TurnDeliverableSnapshot | undefined {
  return sessionSnapshots(sessionKey).get(messageId);
}

export function clearTurnSnapshots(sessionKey: string): void {
  snapshotsBySession.delete(sessionKey);
}

export function snapshotToValidatedItems(snapshot: TurnDeliverableSnapshot): ValidatedDeliverable[] {
  return snapshot.rows.map((row, idx) => ({
    id: `snap-${idx}`,
    path: row.path,
    apiPath: row.apiPath ?? row.path,
    resolvedPath: row.resolvedPath,
    kind: 'document' as const,
    source: 'tool' as const,
    validationStatus: row.validationStatus,
  }));
}

/** Test-only */
export function clearAllTurnSnapshotsForTests(): void {
  snapshotsBySession.clear();
}
