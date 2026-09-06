// PD-SAAS-FORK: sidebar display rules for catalog executionStatus (ghost queued → idle).
import type { ProjectSession } from '../types/app';
import {
  isSessionSidebarCompleted,
  isSessionSidebarLocked,
} from '../lib/sessionSidebarState';
import { isSameSessionId, sessionIdSetHas } from './sessionId';
import { isInterruptedPauseReason } from './sessionSidebarAttention';

export function sessionIdInProcessingSet(
  processingSessions: Set<string> | undefined,
  sessionId: string,
): boolean {
  if (!processingSessions?.size) return false;
  for (const id of processingSessions) {
    if (isSameSessionId(id, sessionId)) return true;
  }
  return false;
}

/**
 * Catalog rows often stay `queued` after a turn finishes. Only show 排队中 when
 * the client or catalog indicates an active wait (processing set / queue position).
 */
export function resolveSidebarSessionExecutionStatus(input: {
  session: ProjectSession;
  sessionId: string;
  isOptimisticRow?: boolean;
  processingSessions?: Set<string>;
}): ProjectSession['executionStatus'] | undefined {
  const { session, sessionId, isOptimisticRow, processingSessions } = input;
  if (isOptimisticRow) return 'queued';
  const raw = session.executionStatus;
  if (raw !== 'queued') return raw;
  if (sessionIdInProcessingSet(processingSessions, sessionId)) return 'queued';
  const queuePosition = session.queuePosition;
  if (typeof queuePosition === 'number' && Number.isFinite(queuePosition) && queuePosition > 0) {
    // Cross-session wait: only show queued when another turn is actually in-flight.
    if (processingSessions?.size) return 'queued';
    return undefined;
  }
  return undefined;
}

export function shouldShowSidebarLoadMore(input: {
  visibleSessionCount: number;
  hasMore?: boolean;
  total: number | null;
  /** Sessions actually loaded in project.sessions (before client window filter). */
  loadedSessionCount?: number;
  previewLimit?: number;
}): boolean {
  const {
    visibleSessionCount,
    hasMore,
    total,
    loadedSessionCount = visibleSessionCount,
    previewLimit = 10,
  } = input;
  if (visibleSessionCount <= 0) return false;
  // First page not full: server `total` often includes orphan catalog rows — don't show paging.
  if (loadedSessionCount < previewLimit && visibleSessionCount >= loadedSessionCount) {
    return false;
  }
  if (!hasMore) return false;
  if (total === null) return true;
  return total > visibleSessionCount;
}

export function shouldShowSidebarLoadOlder(input: {
  hasOlderSessions?: boolean;
  /** When true, user should paginate in-window first — hide 7-day+ affordance. */
  showLoadMore?: boolean;
}): boolean {
  if (input.showLoadMore === true) return false;
  return input.hasOlderSessions === true;
}

/** 右键「暂停」：进行中 / catalog running|queued 时可见。 */
export function shouldShowContextPauseSession(
  session: ProjectSession,
  processingSessions?: Set<string>,
): boolean {
  if (isSessionSidebarCompleted(session.id)) return false;
  if (isSessionSidebarLocked(session.id)) return false;
  const executionStatus = typeof session.executionStatus === 'string' ? session.executionStatus : undefined;
  if (executionStatus === 'paused') return false;
  if (sessionIdSetHas(processingSessions, session.id)) return true;
  return executionStatus === 'running' || executionStatus === 'queued';
}

/** 右键「继续」：catalog 已暂停且未标记完成时可见（对称于 pause）。 */
export function shouldShowContextResumeSession(session: ProjectSession): boolean {
  if (isSessionSidebarCompleted(session.id)) return false;
  if (isSessionSidebarLocked(session.id)) return false;
  return session.executionStatus === 'paused';
}

/** Single sidebar row status icon — completed replaces idle grey dot. */
export type SessionRowVisualStatus =
  | 'completed'
  | 'processing'
  | 'queued'
  | 'needs_user_input'
  | 'interrupted'
  | 'paused'
  | 'unread'
  | 'idle';

export function resolveSessionRowVisualStatus(input: {
  session: ProjectSession;
  sessionId: string;
  isCompleted: boolean;
  isOptimisticRow?: boolean;
  processingSessions?: Set<string>;
  unreadSessionIds?: Set<string>;
  needsUserInputSessionIds?: Set<string>;
  interruptedSessionIds?: Set<string>;
}): SessionRowVisualStatus {
  const {
    session,
    sessionId,
    isCompleted,
    isOptimisticRow,
    processingSessions,
    unreadSessionIds,
    needsUserInputSessionIds,
    interruptedSessionIds,
  } = input;

  if (isCompleted) return 'completed';

  const executionStatus = resolveSidebarSessionExecutionStatus({
    session,
    sessionId,
    isOptimisticRow,
    processingSessions,
  });

  if (executionStatus === 'queued') return 'queued';
  if (executionStatus === 'running') return 'processing';
  if (isOptimisticRow) return 'processing';
  if (sessionIdInProcessingSet(processingSessions, sessionId)) return 'processing';

  if (sessionIdSetHas(needsUserInputSessionIds, sessionId)) return 'needs_user_input';
  if (sessionIdSetHas(interruptedSessionIds, sessionId)) return 'interrupted';
  if (executionStatus === 'paused' && isInterruptedPauseReason(session.pausedReason)) {
    return 'interrupted';
  }
  if (executionStatus === 'paused') return 'paused';
  if (sessionIdSetHas(unreadSessionIds, sessionId)) return 'unread';
  return 'idle';
}
