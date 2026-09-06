import { describe, expect, it } from 'vitest';
import {
  deriveSessionSidebarAttention,
  deriveSessionSidebarAttentionFromMessages,
  isInterruptedPauseReason,
  isUserInitiatedPauseReason,
  patchSessionAttentionSet,
} from './sessionSidebarAttention';

describe('sessionSidebarAttention', () => {
  it('classifies user-initiated pause reasons', () => {
    expect(isUserInitiatedPauseReason('user_pause')).toBe(true);
    expect(isUserInitiatedPauseReason('user_stop')).toBe(true);
    expect(isInterruptedPauseReason('user_pause')).toBe(false);
  });

  it('classifies unexpected interrupt pause reasons', () => {
    expect(isInterruptedPauseReason('repair_circuit_tripped')).toBe(true);
    expect(isInterruptedPauseReason('recovery_exhausted')).toBe(true);
    expect(isInterruptedPauseReason('auto_stale_24h')).toBe(false);
  });

  it('prioritizes needs user input over interrupted', () => {
    const attention = deriveSessionSidebarAttention({
      userActionBlocked: true,
      recoveryPhase: 'formal_stop',
      pausedReason: 'repair_circuit_tripped',
    });
    expect(attention).toEqual({ needsUserInput: true, interrupted: false });
  });

  it('detects clarify mode waiting for reply', () => {
    const attention = deriveSessionSidebarAttention({
      latestTurnInteractionMode: 'clarify',
      isLoading: false,
      isAssistantWorking: false,
    });
    expect(attention.needsUserInput).toBe(true);
    expect(attention.interrupted).toBe(false);
  });

  it('detects formal recovery stop as interrupted', () => {
    const attention = deriveSessionSidebarAttention({
      recoveryPhase: 'formal_stop',
      isLoading: false,
      isAssistantWorking: false,
    });
    expect(attention).toEqual({ needsUserInput: false, interrupted: true });
  });

  it('derives user_action_required from transcript messages', () => {
    const attention = deriveSessionSidebarAttentionFromMessages([
      {
        type: 'assistant',
        purpose: 'user_action_required',
        content: '需要您完成一项配置\n1. 打开设置',
      },
    ], {
      isLoading: false,
      isAssistantWorking: false,
    });
    expect(attention.needsUserInput).toBe(true);
  });

  it('patchSessionAttentionSet adds and removes ids', () => {
    const added = patchSessionAttentionSet(new Set(), 'web-s_a', true);
    expect(added.has('web-s_a')).toBe(true);
    const removed = patchSessionAttentionSet(added, 'web-s_a', false);
    expect(removed.has('web-s_a')).toBe(false);
  });
});
