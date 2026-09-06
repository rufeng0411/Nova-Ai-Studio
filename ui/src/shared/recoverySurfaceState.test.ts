import { describe, expect, it } from 'vitest';
import {
  applyRecoverySurfaceToNoticeSummary,
  isRecoverySurfaceV2Enabled,
  resolveRecoverySurfaceState,
  shouldRenderRecoveryNoticeForMessage,
  shouldShowRecoveryErrorInThread,
  type RecoverySurfaceInput,
} from './recoverySurfaceState';

function baseInput(overrides: Partial<RecoverySurfaceInput> = {}): RecoverySurfaceInput {
  return {
    enabled: true,
    autoContinueEnabled: true,
    recoveryContinuePending: false,
    pendingAutoContinue: false,
    userActionBlocked: false,
    autoContinueBlocked: false,
    circuitBreakerTripped: false,
    userAcknowledgedComplete: false,
    isLoading: false,
    sessionTaskPhase: 'idle',
    isAssistantWorkingFromLifecycle: false,
    workingStatus: null,
    formalErrorCode: null,
    uiGraceRemaining: 1,
    ...overrides,
  };
}

describe('resolveRecoverySurfaceState', () => {
  it('auto_continuing when pending flags set and auto ON', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      recoveryContinuePending: true,
    }));
    expect(view.phase).toBe('auto_continuing');
    expect(view.showActionableContinue).toBe(false);
    expect(view.liveDockTitleKey).toBe('working.autoContinuing');
    expect(view.suppressDuplicateHints).toBe(true);
  });

  it('blocked_user when user action required', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      userActionBlocked: true,
    }));
    expect(view.phase).toBe('blocked_user');
    expect(view.showActionableContinue).toBe(false);
  });

  it('silent when session terminal complete', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      sessionTerminalComplete: true,
      isAssistantWorkingFromLifecycle: true,
      sessionTaskPhase: 'deliverable_repair_pending',
    }));
    expect(view.phase).toBe('silent');
    expect(view.isAssistantWorkingAuthoritative).toBe(false);
  });

  it('formal_stop when recovery exhausted and no grace', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      autoContinueEnabled: false,
      workingStatus: { statusKind: 'recovery_pause', budgetRemaining: 0 },
      uiGraceRemaining: 0,
      formalErrorCode: 'recovery_exhausted',
    }));
    expect(view.phase).toBe('formal_stop');
    expect(view.showActionableContinue).toBe(true);
  });

  it('silent when formal stop but auto ON with grace remaining', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      workingStatus: { statusKind: 'recovery_pause', budgetRemaining: 0 },
      uiGraceRemaining: 1,
      formalErrorCode: 'recovery_exhausted',
    }));
    expect(view.phase).toBe('silent');
    expect(view.showActionableContinue).toBe(false);
  });

  it('silent on recovery_pause with auto ON', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      workingStatus: { statusKind: 'recovery_pause', budgetRemaining: 3 },
    }));
    expect(view.phase).toBe('silent');
    expect(view.suppressDuplicateHints).toBe(true);
  });

  it('working during recovery_handling', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      workingStatus: { statusKind: 'recovery_handling' },
      isLoading: true,
      isAssistantWorkingFromLifecycle: true,
    }));
    expect(view.phase).toBe('working');
    expect(view.suppressDuplicateHints).toBe(true);
  });

  it('turn_queued hides in-thread recovery notices', () => {
    const view = resolveRecoverySurfaceState(baseInput({
      sessionTaskPhase: 'turn_queued',
      isAssistantWorkingFromLifecycle: true,
    }));
    expect(view.phase).toBe('silent');
    expect(view.hideInThreadRecoveryNotices).toBe(true);
    expect(view.liveDockTitleKey).toBe('sidebar.sessions.queued');
    expect(shouldRenderRecoveryNoticeForMessage({
      messageType: 'error',
      isLastRecoveryErrorInTurn: true,
      surface: view,
    })).toBe(false);
  });
});

describe('shouldShowRecoveryErrorInThread', () => {
  const handling = '可能需要些时间，请稍后';

  it('hides all unified copy while session in flight', () => {
    expect(shouldShowRecoveryErrorInThread({
      autoContinueEnabled: true,
      isSessionInFlight: true,
      isLastGlobalRecoveryError: true,
      isPermission: false,
      showFormalGuidance: false,
      summary: handling,
      unifiedHandlingSummary: handling,
    })).toBe(false);
  });

  it('shows at most one unified copy when idle', () => {
    expect(shouldShowRecoveryErrorInThread({
      autoContinueEnabled: false,
      isSessionInFlight: false,
      isLastGlobalRecoveryError: false,
      isPermission: false,
      showFormalGuidance: false,
      summary: handling,
      unifiedHandlingSummary: handling,
    })).toBe(false);
    expect(shouldShowRecoveryErrorInThread({
      autoContinueEnabled: false,
      isSessionInFlight: false,
      isLastGlobalRecoveryError: true,
      isPermission: false,
      showFormalGuidance: false,
      summary: handling,
      unifiedHandlingSummary: handling,
    })).toBe(true);
  });

  it('hides when turn queued surface blocks thread notices', () => {
    const surface = resolveRecoverySurfaceState(baseInput({ sessionTaskPhase: 'turn_queued' }));
    expect(shouldShowRecoveryErrorInThread({
      surface,
      autoContinueEnabled: true,
      isSessionInFlight: true,
      isLastGlobalRecoveryError: true,
      isPermission: false,
      showFormalGuidance: false,
      summary: handling,
      unifiedHandlingSummary: handling,
    })).toBe(false);
  });
});

describe('applyRecoverySurfaceToNoticeSummary', () => {
  it('suppresses actionable exhausted copy when auto continuing', () => {
    const surface = resolveRecoverySurfaceState(baseInput({ recoveryContinuePending: true }));
    const applied = applyRecoverySurfaceToNoticeSummary({
      surface,
      defaultSummary: '您可以继续',
      exhaustedSummary: '您可以继续',
      handlingSummary: '可能需要些时间，请稍后',
    });
    expect(applied.summary).toBe('可能需要些时间，请稍后');
    expect(applied.hints).toEqual([]);
  });
});

describe('isRecoverySurfaceV2Enabled', () => {
  it('returns boolean', () => {
    expect(typeof isRecoverySurfaceV2Enabled()).toBe('boolean');
  });
});
