import { describe, expect, it } from 'vitest';
import {
  clearAllTurnSnapshotsForTests,
  readTurnSnapshot,
  snapshotToValidatedItems,
  writeTurnSnapshot,
} from './turnDeliverableSnapshot';

describe('turnDeliverableSnapshot', () => {
  it('C1: snapshot preserves incomplete when later ledger upgrades', () => {
    clearAllTurnSnapshotsForTests();
    const sessionKey = 'sess\0general';
    writeTurnSnapshot(sessionKey, 'msg-turn1', [{
      id: '1',
      path: 'artifacts/report.md',
      apiPath: 'artifacts/report.md',
      kind: 'document',
      source: 'tool',
      validationStatus: 'pending',
    }]);
    const snap = readTurnSnapshot(sessionKey, 'msg-turn1');
    expect(snap).toBeDefined();
    const items = snapshotToValidatedItems(snap!);
    expect(items[0].validationStatus).toBe('pending');
  });
});
