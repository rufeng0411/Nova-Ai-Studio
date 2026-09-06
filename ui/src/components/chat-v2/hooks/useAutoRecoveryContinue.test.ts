import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAutoRecoveryContinue,
  readAutoContinueEnabled,
  isRecoveryPauseStatus,
  resolveUiBudgetCap,
  shouldSuppressUiRecoveryContinue,
  shouldRefireTurnCompleteAfterReconnect,
  MAX_AUTO_CONTINUES,
} from './useAutoRecoveryContinue';

describe('shouldRefireTurnCompleteAfterReconnect', () => {
  it('refires when the session was running before the drop and is now settled', () => {
    // WS dropped mid-turn → engine aborted_streaming on disk → reconnect status poll
    // reports not-processing → UI must refire turn-complete so the deliverable
    // auto-continue hook can resume the unfinished task instead of waiting on the user.
    expect(
      shouldRefireTurnCompleteAfterReconnect({ armedWhileLoading: true, sessionStillProcessing: false }),
    ).toBe(true);
  });

  it('does not refire when the session is still processing after reconnect', () => {
    expect(
      shouldRefireTurnCompleteAfterReconnect({ armedWhileLoading: true, sessionStillProcessing: true }),
    ).toBe(false);
  });

  it('does not refire when nothing was running at drop time', () => {
    expect(
      shouldRefireTurnCompleteAfterReconnect({ armedWhileLoading: false, sessionStillProcessing: false }),
    ).toBe(false);
  });
});

describe('useAutoRecoveryContinue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem(
      'pilotdeck-settings',
      JSON.stringify({ autoRecoveryContinue: true, allowedTools: [], disallowedTools: [], skipPermissions: false }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('readAutoContinueEnabled defaults true when unset', () => {
    localStorage.clear();
    expect(readAutoContinueEnabled()).toBe(true);
  });

  it('detects recovery_pause status', () => {
    expect(isRecoveryPauseStatus({ statusKind: 'recovery_pause', text: 'recovery_pause' })).toBe(true);
  });

  it('does not fire while loading even on recovery_pause', () => {
    const onContinue = vi.fn();
    renderHook(() =>
      useAutoRecoveryContinue({
        sessionId: 'sess-1',
        turnBoundaryKey: 'sess-1:1',
        status: { statusKind: 'recovery_pause', text: 'recovery_pause' },
        isLoading: true,
        isConnected: true,
        onContinue,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('does not fire on failed turn without recovery_pause (engine handles)', () => {
    const onContinue = vi.fn();
    const { rerender } = renderHook(
      (props) => useAutoRecoveryContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:2',
          status: null,
          isLoading: false,
          isConnected: true,
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:2',
      status: null,
      isLoading: false,
      isConnected: true,
      turnCompleteSignal: 1,
      turnCompleteMeta: { exitCode: 1, success: false },
      lastAssistantText: '',
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('skips when disconnected', () => {
    const onContinue = vi.fn();
    renderHook(() =>
      useAutoRecoveryContinue({
        sessionId: 'sess-1',
        turnBoundaryKey: 'sess-1:1',
        status: { statusKind: 'recovery_pause', text: 'recovery_pause' },
        isLoading: false,
        isConnected: false,
        onContinue,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('grants UI grace budget after engine exhaust (default 1)', () => {
    expect(resolveUiBudgetCap({
      statusKind: 'recovery_pause',
      text: 'recovery_pause',
      budgetRemaining: 0,
    })).toBe(1);
  });

  it('suppresses grace when engine exhaust and verified count unchanged', () => {
    expect(resolveUiBudgetCap(
      {
        statusKind: 'recovery_pause',
        text: 'recovery_pause',
        budgetRemaining: 0,
        verifiedPaths: ['artifacts/a.md'],
      },
      { exhaustVerifiedBaseline: 1 },
    )).toBe(0);
  });

  it('allows grace for infra interrupt after engine exhaust', () => {
    expect(resolveUiBudgetCap({
      statusKind: 'infra_interrupt',
      text: 'infra_interrupt',
      budgetRemaining: 0,
      interruptKind: 'infra',
    })).toBe(1);
  });

  it('does not fire while user_action_required is pending', () => {
    const onContinue = vi.fn();
    renderHook(() =>
      useAutoRecoveryContinue({
        sessionId: 'sess-1',
        turnBoundaryKey: 'sess-1:1',
        status: { statusKind: 'recovery_pause', text: 'recovery_pause' },
        isLoading: false,
        isConnected: true,
        userActionBlocked: true,
        onContinue,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('respects MAX_AUTO_CONTINUES', () => {
    expect(MAX_AUTO_CONTINUES).toBeGreaterThanOrEqual(3);
  });

  it('shouldSuppressUiRecoveryContinue when turn succeeded', () => {
    expect(shouldSuppressUiRecoveryContinue({ exitCode: 0, success: true }, '')).toBe(true);
    expect(shouldSuppressUiRecoveryContinue(undefined, '图像已生成，文件路径：scene.png')).toBe(true);
    expect(shouldSuppressUiRecoveryContinue({ exitCode: 1, success: false }, '')).toBe(false);
  });

  it('does not suppress deliverable_repair even when assistant looks delivered', () => {
    expect(
      shouldSuppressUiRecoveryContinue(
        { exitCode: 0, success: true },
        '已完成，文件路径：report.md',
        { statusKind: 'deliverable_repair' },
      ),
    ).toBe(false);
  });

  it('does not fire after successful turn even with stale recovery_pause', () => {
    const onContinue = vi.fn();
    const { rerender } = renderHook(
      (props) => useAutoRecoveryContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:3',
          status: { statusKind: 'recovery_pause', text: 'recovery_pause', budgetRemaining: 0 },
          isLoading: false,
          isConnected: true,
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:3',
      status: { statusKind: 'recovery_pause', text: 'recovery_pause', budgetRemaining: 0 },
      isLoading: false,
      isConnected: true,
      turnCompleteSignal: 1,
      turnCompleteMeta: { exitCode: 0, success: true },
      lastAssistantText: '图像已生成成功！文件路径：cyberpunk-ghibli-landscape.png',
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onContinue).not.toHaveBeenCalled();
  });
});
