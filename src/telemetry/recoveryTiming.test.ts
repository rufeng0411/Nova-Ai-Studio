import { describe, expect, it } from 'vitest';
import { recordRecoveryEvent, summarizeRecoveryByReason } from './recoveryTiming.js';

describe('recoveryTiming', () => {
  it('summarizeRecoveryByReason aggregates counts', () => {
    const events = [
      {
        recordedAtMs: 1,
        runId: 'r1',
        sessionId: 's1',
        turnId: 't1',
        reason: 'auto_continue',
        attempt: 1,
        maxAttempts: 8,
        budgetRemaining: 7,
      },
      {
        recordedAtMs: 2,
        runId: 'r1',
        sessionId: 's1',
        turnId: 't1',
        reason: 'tool_recovery',
        attempt: 2,
        maxAttempts: 8,
        budgetRemaining: 6,
      },
    ];
    const summary = summarizeRecoveryByReason(events);
    expect(summary.auto_continue?.count).toBe(1);
    expect(summary.tool_recovery?.count).toBe(1);
  });

  it('recordRecoveryEvent does not throw', () => {
    expect(() => {
      recordRecoveryEvent({
        recordedAtMs: Date.now(),
        runId: 'r',
        sessionId: 's',
        turnId: 't',
        reason: 'model_error',
        attempt: 1,
        maxAttempts: 8,
        budgetRemaining: 7,
      });
    }).not.toThrow();
  });
});
