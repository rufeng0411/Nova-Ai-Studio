import { describe, expect, it } from 'vitest';
import type { ProjectSession } from '../types/app';
import {
  resolveSessionRowVisualStatus,
  resolveSidebarSessionExecutionStatus,
  shouldShowContextPauseSession,
  shouldShowContextResumeSession,
  shouldShowSidebarLoadMore,
  shouldShowSidebarLoadOlder,
} from './sidebarSessionExecutionStatus';
import { setSessionSidebarCompleted, setSessionSidebarLocked } from '../lib/sessionSidebarState';

function session(overrides: Partial<ProjectSession> = {}): ProjectSession {
  return {
    id: 'web-s_test',
    title: 't',
    created_at: '2026-07-21T00:00:00.000Z',
    updated_at: '2026-07-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('sidebarSessionExecutionStatus', () => {
  it('treats ghost catalog queued as idle', () => {
    const status = resolveSidebarSessionExecutionStatus({
      session: session({ executionStatus: 'queued', queuePosition: null }),
      sessionId: 'web-s_test',
    });
    expect(status).toBeUndefined();
  });

  it('hides leftover queuePosition when no turn is in-flight in this tab', () => {
    const status = resolveSidebarSessionExecutionStatus({
      session: session({ executionStatus: 'queued', queuePosition: 2 }),
      sessionId: 'web-s_test',
    });
    expect(status).toBeUndefined();
  });

  it('keeps cross-session queued when another turn is in-flight', () => {
    const status = resolveSidebarSessionExecutionStatus({
      session: session({ executionStatus: 'queued', queuePosition: 2 }),
      sessionId: 'web-s_test',
      processingSessions: new Set(['web-s_other']),
    });
    expect(status).toBe('queued');
  });

  it('does not show load more when visible list is empty', () => {
    expect(
      shouldShowSidebarLoadMore({ visibleSessionCount: 0, hasMore: true, total: 5 }),
    ).toBe(false);
  });

  it('shows load more when more sessions exist in window', () => {
    expect(
      shouldShowSidebarLoadMore({
        visibleSessionCount: 10,
        hasMore: true,
        total: 15,
        loadedSessionCount: 10,
        previewLimit: 10,
      }),
    ).toBe(true);
  });

  it('hides load-more when first page is not full (orphan catalog total drift)', () => {
    expect(
      shouldShowSidebarLoadMore({
        visibleSessionCount: 1,
        hasMore: true,
        total: 13,
        loadedSessionCount: 1,
        previewLimit: 10,
      }),
    ).toBe(false);
  });

  it('hides load older when server flag is off', () => {
    expect(shouldShowSidebarLoadOlder({ hasOlderSessions: false })).toBe(false);
    expect(shouldShowSidebarLoadOlder({ hasOlderSessions: true })).toBe(true);
  });

  it('hides load older while in-window load-more is available', () => {
    expect(
      shouldShowSidebarLoadOlder({ hasOlderSessions: true, showLoadMore: true }),
    ).toBe(false);
    expect(
      shouldShowSidebarLoadOlder({ hasOlderSessions: true, showLoadMore: false }),
    ).toBe(true);
  });

  it('resolveSessionRowVisualStatus prioritizes completed over idle dot', () => {
    setSessionSidebarCompleted('web-s_done', true);
    expect(
      resolveSessionRowVisualStatus({
        session: session({ id: 'web-s_done' }),
        sessionId: 'web-s_done',
        isCompleted: true,
      }),
    ).toBe('completed');
  });

  it('resolveSessionRowVisualStatus maps paused catalog row', () => {
    expect(
      resolveSessionRowVisualStatus({
        session: session({ executionStatus: 'paused' }),
        sessionId: 'web-s_test',
        isCompleted: false,
      }),
    ).toBe('paused');
  });

  it('resolveSessionRowVisualStatus maps needs_user_input attention set', () => {
    expect(
      resolveSessionRowVisualStatus({
        session: session(),
        sessionId: 'web-s_needs',
        isCompleted: false,
        needsUserInputSessionIds: new Set(['web-s_needs']),
      }),
    ).toBe('needs_user_input');
  });

  it('resolveSessionRowVisualStatus maps interrupted pause reason', () => {
    expect(
      resolveSessionRowVisualStatus({
        session: session({ executionStatus: 'paused', pausedReason: 'repair_circuit_tripped' }),
        sessionId: 'web-s_interrupt',
        isCompleted: false,
      }),
    ).toBe('interrupted');
  });

  it('resolveSessionRowVisualStatus keeps running above attention flags', () => {
    expect(
      resolveSessionRowVisualStatus({
        session: session({ executionStatus: 'running' }),
        sessionId: 'web-s_run',
        isCompleted: false,
        needsUserInputSessionIds: new Set(['web-s_run']),
        interruptedSessionIds: new Set(['web-s_run']),
      }),
    ).toBe('processing');
  });

  it('context pause/resume menu visibility', () => {
    const paused = session({ id: 'web-s_paused', executionStatus: 'paused' });
    const running = session({ id: 'web-s_run', executionStatus: 'running' });

    expect(shouldShowContextResumeSession(paused)).toBe(true);
    expect(shouldShowContextPauseSession(paused)).toBe(false);

    expect(shouldShowContextResumeSession(running)).toBe(false);
    expect(shouldShowContextPauseSession(running)).toBe(true);

    setSessionSidebarCompleted('web-s_paused', true);
    expect(shouldShowContextResumeSession(paused)).toBe(false);

    setSessionSidebarCompleted('web-s_paused', false);
    setSessionSidebarLocked('web-s_paused', true);
    expect(shouldShowContextResumeSession(paused)).toBe(false);
  });
});
