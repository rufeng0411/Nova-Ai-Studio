import { describe, expect, it } from 'vitest';
import {
  buildLedgerSessionKey,
  canonicalDeliverableKey,
  commitLedgerFromValidated,
  getOrCreateLedger,
  partitionItemsByLedger,
  clearAllLedgersForTests,
} from './deliverableValidationLedger';

describe('deliverableValidationLedger', () => {
  it('delivered entries are immutable', () => {
    clearAllLedgersForTests();
    const key = buildLedgerSessionKey('s1', 'general');
    const ledger = getOrCreateLedger(key);
    commitLedgerFromValidated(ledger, [{
      id: '1',
      path: 'artifacts/a.md',
      apiPath: 'artifacts/a.md',
      resolvedPath: 'artifacts/a.md',
      kind: 'document',
      source: 'tool',
      validationStatus: 'verified',
    }]);
    commitLedgerFromValidated(ledger, [{
      id: '1',
      path: 'artifacts/a.md',
      apiPath: 'artifacts/a.md',
      kind: 'document',
      source: 'tool',
      validationStatus: 'pending',
    }]);
    expect(readEntry(ledger, 'artifacts/a.md')?.status).toBe('delivered');
  });

  it('partitions needsValidate vs ledger hits', () => {
    clearAllLedgersForTests();
    const ledger = getOrCreateLedger('s2\0general');
    commitLedgerFromValidated(ledger, [{
      id: '1',
      path: 'artifacts/ok.md',
      apiPath: 'artifacts/ok.md',
      resolvedPath: 'artifacts/ok.md',
      kind: 'document',
      source: 'tool',
      validationStatus: 'verified',
    }]);
    const { needsValidate, ledgerDelivered } = partitionItemsByLedger(ledger, [
      { id: 'a', path: 'artifacts/ok.md', kind: 'document', source: 'tool' },
      { id: 'b', path: 'artifacts/new.md', kind: 'document', source: 'tool' },
    ]);
    expect(ledgerDelivered).toHaveLength(1);
    expect(needsValidate).toHaveLength(1);
    expect(needsValidate[0].path).toBe('artifacts/new.md');
  });

  it('canonical key includes hintDir', () => {
    expect(canonicalDeliverableKey('slide-01.png', 'artifacts/deck-a'))
      .not.toBe(canonicalDeliverableKey('slide-01.png', 'artifacts/deck-b'));
  });
});

function readEntry(ledger: ReturnType<typeof getOrCreateLedger>, path: string) {
  return ledger.get(canonicalDeliverableKey(path));
}
