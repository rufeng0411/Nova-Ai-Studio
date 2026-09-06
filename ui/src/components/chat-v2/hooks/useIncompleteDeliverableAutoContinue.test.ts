import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useIncompleteDeliverableAutoContinue } from './useIncompleteDeliverableAutoContinue';
import { _clearTaskResumeCoordinatorForTests } from './taskResumeCoordinator';

describe('useIncompleteDeliverableAutoContinue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _clearTaskResumeCoordinatorForTests();
    localStorage.setItem(
      'pilotdeck-settings',
      JSON.stringify({ autoRecoveryContinue: true, allowedTools: [], disallowedTools: [], skipPermissions: false }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    _clearTaskResumeCoordinatorForTests();
  });

  it('continues non-user aborted direct-start deliverable turns', () => {
    const onContinue = vi.fn();
    const userGoalText = '输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做';
    const { rerender } = renderHook(
      (props) => useIncompleteDeliverableAutoContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:0',
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          userGoalText,
          isLoading: false,
          isConnected: true,
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:1',
      turnCompleteSignal: 1,
      turnCompleteMeta: { aborted: true, userAborted: false },
      lastAssistantText: '开始执行！先确认资料，然后逐一推进。',
      userGoalText,
      isLoading: false,
      isConnected: true,
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue.mock.calls[0]?.[0]).toContain('不要向用户索要「继续」');
  });

  it('does not continue user-aborted turns', () => {
    const onContinue = vi.fn();
    const userGoalText = '输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做';
    const { rerender } = renderHook(
      (props) => useIncompleteDeliverableAutoContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:0',
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          userGoalText,
          isLoading: false,
          isConnected: true,
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:1',
      turnCompleteSignal: 1,
      turnCompleteMeta: { aborted: true, userAborted: true },
      lastAssistantText: '开始执行！先确认资料，然后逐一推进。',
      userGoalText,
      isLoading: false,
      isConnected: true,
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onContinue).not.toHaveBeenCalled();
  });

  it('continues success turns that only contain a promise for deliverable goals', () => {
    const onContinue = vi.fn();
    const userGoalText = '用 React 程序化视频搭一个视频模板，方便批量渲染';
    const { rerender } = renderHook(
      (props) => useIncompleteDeliverableAutoContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:0',
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          userGoalText,
          isLoading: false,
          isConnected: true,
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:2',
      turnCompleteSignal: 2,
      turnCompleteMeta: { success: true },
      lastAssistantText: '我来创建一个完全参数化的视频模板。可能需要些时间，请稍后',
      userGoalText,
      isLoading: false,
      isConnected: true,
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // PD-SAAS-FORK: 4d — when the engine already flagged needs_repair (it owns the
  // repair loop), the UI deliverable fallback must stand aside so it never resets
  // the engine's per-turn recovery budget by opening a fresh "继续" turn.
  it('stands aside when the engine already owns repair (needs_repair)', () => {
    const onContinue = vi.fn();
    const userGoalText = '输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做';
    const { rerender } = renderHook(
      (props) => useIncompleteDeliverableAutoContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:0',
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          userGoalText,
          isLoading: false,
          isConnected: true,
          engineRepairOwned: false,
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:1',
      turnCompleteSignal: 1,
      turnCompleteMeta: { aborted: true, userAborted: false },
      lastAssistantText: '开始执行！先确认资料，然后逐一推进。',
      userGoalText,
      isLoading: false,
      isConnected: true,
      engineRepairOwned: true,
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onContinue).not.toHaveBeenCalled();
  });

  // Control for the test above: identical turn, only engineRepairOwned flips to
  // false — the fallback must still fire, proving 4d suppression is driven by the
  // engine flag and does not regress the existing incomplete-deliverable safety net.
  it('still continues an unowned incomplete turn (engineRepairOwned false)', () => {
    const onContinue = vi.fn();
    const userGoalText = '输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做';
    const { rerender } = renderHook(
      (props) => useIncompleteDeliverableAutoContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:0',
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          userGoalText,
          isLoading: false,
          isConnected: true,
          engineRepairOwned: false,
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:1',
      turnCompleteSignal: 1,
      turnCompleteMeta: { aborted: true, userAborted: false },
      lastAssistantText: '开始执行！先确认资料，然后逐一推进。',
      userGoalText,
      isLoading: false,
      isConnected: true,
      engineRepairOwned: false,
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // PD-SAAS-FORK: 4d timing guard — acceptance meta often lands a tick AFTER the
  // turn-complete signal. The fallback schedules on the (still-false) flag, then
  // engineRepairOwned flips true before the 800ms timer fires; the delayed re-check
  // must catch it and suppress.
  it('suppresses when needs_repair arrives after the turn was scheduled', () => {
    const onContinue = vi.fn();
    const userGoalText = '输出 Word(.docx)，产出存 artifacts/ 报路径，直接开始做';
    const { rerender } = renderHook(
      (props) => useIncompleteDeliverableAutoContinue(props),
      {
        initialProps: {
          sessionId: 'sess-1',
          turnBoundaryKey: 'sess-1:0',
          turnCompleteSignal: 0,
          turnCompleteMeta: undefined,
          lastAssistantText: '',
          userGoalText,
          isLoading: false,
          isConnected: true,
          engineRepairOwned: false,
          onContinue,
        },
      },
    );

    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:1',
      turnCompleteSignal: 1,
      turnCompleteMeta: { aborted: true, userAborted: false },
      lastAssistantText: '开始执行！先确认资料，然后逐一推进。',
      userGoalText,
      isLoading: false,
      isConnected: true,
      engineRepairOwned: false,
      onContinue,
    });

    // acceptance meta arrives mid-flight, before the 800ms continue timer fires
    rerender({
      sessionId: 'sess-1',
      turnBoundaryKey: 'sess-1:1',
      turnCompleteSignal: 1,
      turnCompleteMeta: { aborted: true, userAborted: false },
      lastAssistantText: '开始执行！先确认资料，然后逐一推进。',
      userGoalText,
      isLoading: false,
      isConnected: true,
      engineRepairOwned: true,
      onContinue,
    });

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onContinue).not.toHaveBeenCalled();
  });
});
