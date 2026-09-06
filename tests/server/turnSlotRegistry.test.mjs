import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  tryAcquireTurnSlot,
  acquireTurnSlotStatus,
  releaseTurnSlot,
  resetTurnSlotRegistryForTests,
} from '../../ui/server/saas/concurrency/turnSlotRegistry.js';

describe('turnSlotRegistry', () => {
  beforeEach(() => {
    resetTurnSlotRegistryForTests();
    process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS = '5';
  });

  it('allows at most 5 concurrent slots per user', async () => {
    const tenantId = 'tenant-a';
    const userId = 42;
    const acquired = [];
    for (let i = 0; i < 20; i += 1) {
      const ok = await tryAcquireTurnSlot({
        tenantId,
        userId,
        sessionKey: `web-s_session-${i}`,
        role: 'user',
      });
      if (ok) acquired.push(i);
    }
    assert.equal(acquired.length, 5);
  });

  it('releases slots for pump', async () => {
    const input = { tenantId: 'tenant-a', userId: 7, role: 'user' };
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's1' }), true);
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's2' }), true);
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's3' }), true);
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's4' }), true);
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's5' }), true);
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's6' }), false);
    await releaseTurnSlot({ tenantId: input.tenantId, userId: input.userId, sessionKey: 's2' });
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's7' }), true);
  });

  it('allows resubmit on same session without extra slot', async () => {
    const input = { tenantId: 'tenant-a', userId: 9, role: 'user' };
    for (let i = 0; i < 5; i += 1) {
      assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: `s${i}` }), true);
    }
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's1' }), true);
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 's-new' }), false);
  });

  it('treats web:s_ and web-s_ as the same running slot', async () => {
    const input = { tenantId: 'tenant-a', userId: 11, role: 'user' };
    assert.equal(await acquireTurnSlotStatus({
      ...input,
      sessionKey: 'web:s_same-turn',
    }), 'acquired');
    assert.equal(await acquireTurnSlotStatus({
      ...input,
      sessionKey: 'web-s_same-turn',
    }), 'already_held');
    for (let i = 0; i < 4; i += 1) {
      assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: `web-s_other-${i}` }), true);
    }
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 'web-s_overflow' }), false);
    await releaseTurnSlot({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionKey: 'web-s_same-turn',
    });
    assert.equal(await tryAcquireTurnSlot({ ...input, sessionKey: 'web:s_overflow' }), true);
  });
});
