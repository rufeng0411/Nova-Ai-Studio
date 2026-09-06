import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidateCoalesceKey,
  clearValidateCoalescerForTests,
  coalesceValidateRequest,
} from '../../ui/server/saas/deliverables/validateRequestCoalescer.js';

describe('validateRequestCoalescer', () => {
  beforeEach(() => {
    clearValidateCoalescerForTests();
  });

  it('coalesces concurrent identical validate keys', async () => {
    let runs = 0;
    const task = () => {
      runs += 1;
      return Promise.resolve({ ok: true, runs });
    };
    const key = buildValidateCoalesceKey('t1', 'u1', 'general', '', ['a.md']);
    const [a, b] = await Promise.all([
      coalesceValidateRequest(key, task),
      coalesceValidateRequest(key, task),
    ]);
    assert.equal(runs, 1);
    assert.deepEqual(a, b);
  });
});
