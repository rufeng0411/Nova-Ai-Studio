import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  countActiveTurnSessionsForUser,
  countGlobalActiveTurnSessions,
  evaluateTurnConcurrencyGate,
  isTurnConcurrencyExempt,
} from '../../ui/server/saas/concurrency/turnConcurrencyGate.js';

describe('turnConcurrencyGate', () => {
  beforeEach(() => {
    process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS = '5';
    process.env.PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS = '20';
  });

  it('exempts continuation-only text', () => {
    assert.equal(isTurnConcurrencyExempt({ command: '继续' }), true);
  });

  it('exempts cold-resume / deliverable repair / infra resume kinds', () => {
    assert.equal(isTurnConcurrencyExempt({
      command: '可能需要些时间，请稍后',
      options: { resumeKind: 'cold_resume' },
    }), true);
    assert.equal(isTurnConcurrencyExempt({
      command: '补齐成果',
      options: { resumeKind: 'deliverable_repair' },
    }), true);
    assert.equal(isTurnConcurrencyExempt({
      command: '继续上次步骤',
      options: { resumeKind: 'infra_interrupt' },
    }), true);
    assert.equal(isTurnConcurrencyExempt({
      command: 'auto continue',
      options: { resumeKind: 'auto_continue' },
    }), true);
  });

  it('treats web:s_ and web-s_ as the same active session for the parallel cap', () => {
    const states = [
      { sessionKey: 'web:s_same', active: true, ownerUserId: 1 },
      { sessionKey: 's2', active: true, ownerUserId: 1 },
      { sessionKey: 's3', active: true, ownerUserId: 1 },
      { sessionKey: 's4', active: true, ownerUserId: 1 },
      { sessionKey: 's5', active: true, ownerUserId: 1 },
    ];
    const gate = evaluateTurnConcurrencyGate({
      userId: 1,
      role: 'user',
      command: 'next step',
      options: { sessionId: 'web-s_same' },
      sessionStates: states,
    });
    assert.equal(gate.allowed, true);
  });

  it('allows resubmit on same active session', () => {
    const states = [
      { sessionKey: 's1', active: true, ownerUserId: 1 },
      { sessionKey: 's2', active: true, ownerUserId: 1 },
    ];
    const gate = evaluateTurnConcurrencyGate({
      userId: 1,
      role: 'user',
      command: 'next step',
      options: { sessionId: 's1' },
      sessionStates: states,
    });
    assert.equal(gate.allowed, true);
  });

  it('rejects new slot when user limit reached', () => {
    const states = [
      { sessionKey: 's1', active: true, ownerUserId: 1 },
      { sessionKey: 's2', active: true, ownerUserId: 1 },
      { sessionKey: 's3', active: true, ownerUserId: 1 },
      { sessionKey: 's4', active: true, ownerUserId: 1 },
      { sessionKey: 's5', active: true, ownerUserId: 1 },
    ];
    const gate = evaluateTurnConcurrencyGate({
      userId: 1,
      role: 'user',
      command: 'new task',
      options: { sessionId: 's6' },
      sessionStates: states,
    });
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, 'parallel_limit');
  });

  it('A6 n2_bot T0-T2 exempt from worker slots; T3 and missing kind are not', () => {
    assert.equal(isTurnConcurrencyExempt({
      command: '进度',
      options: { sessionKind: 'n2_bot', n2BotTier: 'T1' },
    }), true);
    assert.equal(isTurnConcurrencyExempt({
      command: '做一份周会 PPT',
      options: { sessionKind: 'n2_bot', n2BotTier: 'T3' },
    }), false);
    assert.equal(isTurnConcurrencyExempt({
      command: '做一份周会 PPT',
      options: {},
    }), false);
    const states = [
      { sessionKey: 's1', active: true, ownerUserId: 1 },
      { sessionKey: 's2', active: true, ownerUserId: 1 },
      { sessionKey: 's3', active: true, ownerUserId: 1 },
      { sessionKey: 's4', active: true, ownerUserId: 1 },
      { sessionKey: 's5', active: true, ownerUserId: 1 },
    ];
    const gate = evaluateTurnConcurrencyGate({
      userId: 1,
      role: 'user',
      command: '进度',
      options: { sessionKind: 'n2_bot', n2BotTier: 'T1', sessionId: 's-n2' },
      sessionStates: states,
    });
    assert.equal(gate.allowed, true);
  });

  it('counts global active sessions', () => {
    assert.equal(countGlobalActiveTurnSessions([
      { sessionKey: 'a', active: true },
      { sessionKey: 'b', active: false },
    ]), 1);
    assert.equal(countActiveTurnSessionsForUser([
      { sessionKey: 'a', active: true, ownerUserId: 2 },
      { sessionKey: 'b', active: true, ownerUserId: 1 },
    ], 1, null), 1);
  });
});
