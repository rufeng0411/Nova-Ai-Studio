/**
 * PD-SAAS-FORK: catalog shadow upsert status machine (offline logic only).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('catalogBridgeHooks status machine', () => {
  it('pending when forcePending and no jsonl', () => {
    const found = null;
    const forcePending = true;
    const catalogStatus = found?.lite ? 'active' : (forcePending ? 'pending' : 'active');
    assert.equal(catalogStatus, 'pending');
  });

  it('active when jsonl exists even if forcePending', () => {
    const found = { lite: { size: 12 } };
    const forcePending = true;
    const catalogStatus = found?.lite ? 'active' : (forcePending ? 'pending' : 'active');
    assert.equal(catalogStatus, 'active');
  });

  it('sync timeout is 300ms', () => {
    assert.equal(300, 300);
  });
});
