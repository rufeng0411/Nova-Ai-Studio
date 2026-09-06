// PD-SAAS-FORK: gate UI auto-continue against paused / 24h-stale sessions.
import type { ProjectSession } from '../types/app';
import {
  parseSessionLastActivityMs,
  resolveStaleSessionPauseMs,
  shouldBlockUiAutoContinue,
} from '../../../src/saas/concurrency/staleSessionPausePolicy';

export function resolveSessionLastActivityMs(session: ProjectSession | null | undefined): number | null {
  if (!session) return null;
  const raw = session.lastActivity ?? session.updated_at ?? session.created_at ?? session.createdAt;
  return parseSessionLastActivityMs(typeof raw === 'string' || typeof raw === 'number' ? raw : null);
}

export function shouldBlockSessionAutoContinue(input: {
  session: ProjectSession | null | undefined;
  userAcknowledgedComplete?: boolean;
  /** User unmarked sidebar「任务完成」— wait for a real user message before any auto-continue. */
  userRevokedSidebarComplete?: boolean;
  userInitiatedTurnPending?: boolean;
  /** Pass false for recovery/incomplete deliverable auto-continue while queued. */
  syntheticAutoContinue?: boolean;
}): boolean {
  if (input.userRevokedSidebarComplete) return true;
  const session = input.session;
  return shouldBlockUiAutoContinue({
    executionStatus: session?.executionStatus,
    lastActivityMs: resolveSessionLastActivityMs(session),
    userAcknowledgedComplete: input.userAcknowledgedComplete,
    userInitiatedTurnPending: input.userInitiatedTurnPending,
    syntheticAutoContinue: input.syntheticAutoContinue ?? true,
    pauseMs: resolveStaleSessionPauseMs(
      typeof import.meta !== 'undefined'
        ? (import.meta.env as Record<string, string | undefined>)
        : {},
    ),
  });
}

/** Cold-resume / incomplete-turn recovery — do not treat catalog ghost `queued` as a hard stop. */
export function shouldBlockRecoveryAutoContinue(input: {
  session: ProjectSession | null | undefined;
  userAcknowledgedComplete?: boolean;
}): boolean {
  return shouldBlockSessionAutoContinue({
    ...input,
    syntheticAutoContinue: false,
  });
}

export function isAutoStalePausedReason(reason: unknown): boolean {
  return reason === 'auto_stale_24h';
}
