// PD-SAAS-FORK (P0-2): load-time cold-resume initiator.
//
// On a cold start (page reload / reconnect after a full-stack restart) the engine's in-memory
// recovery status is gone, so the status-driven useAutoRecoveryContinue never fires for a turn that
// was genuinely interrupted. This hook asks the SERVER (which owns idempotency + crash-loop budget +
// recency) exactly once per session-load whether a cold resume is warranted. The server decides; the
// UI only initiates. cold_resume ranks LOW in the coordinator, so any live recovery owner preempts it.
//
// Harmless when the server flag (PILOTDECK_COLD_RESUME) is OFF or in single-machine OSS: the endpoint
// returns { allowed:false } and nothing happens.
import { useEffect, useRef } from 'react';

import { api } from '../../../utils/api';
import { readAutoContinueEnabled } from './useAutoRecoveryContinue';
import { markTaskResumeFired, tryTaskResumeSchedule } from './taskResumeCoordinator';

/** Settle delay so a live status (engine still processing) can arrive and take precedence first. */
const COLD_RESUME_PROBE_DELAY_MS = 1500;

export type ColdResumeInitiatorState = {
  sessionId: string | null | undefined;
  enabled: boolean;
  autoContinueEnabled: boolean;
  autoContinueBlocked?: boolean;
  /** PD-SAAS-FORK: repair-turn-queue may flip ghost queued → idle; allow a second probe. */
  executionStatus?: string;
  /** PD-SAAS-FORK: repair circuit — block synthetic cold-resume; user may still send messages. */
  circuitBreakerTripped?: boolean;
  /** PD-SAAS-FORK (P0-D): terminal sessions must not cold-resume on load. */
  sessionTerminalComplete?: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isLoadingSessionMessages: boolean;
  hasMessages: boolean;
  alreadyAttempted: boolean;
};

/** Pure gate: should we probe the server for a cold resume on this load? */
export function shouldProbeColdResume(state: ColdResumeInitiatorState & { userActionBlocked?: boolean; manualMode?: boolean }): boolean {
  if (state.sessionTerminalComplete) return false;
  if (state.circuitBreakerTripped) return false;
  if (state.userActionBlocked) return false;
  if (state.autoContinueBlocked) return false;
  if (!state.enabled) return false;
  if (!state.manualMode && !state.autoContinueEnabled) return false;
  if (!state.sessionId) return false;
  if (!state.isConnected) return false;
  // A turn is actively streaming (or messages still loading) -> a live owner handles it, not us.
  if (state.isLoading || state.isLoadingSessionMessages) return false;
  // Nothing to resume in an empty conversation.
  if (!state.hasMessages) return false;
  if (state.alreadyAttempted) return false;
  return true;
}

export type ColdResumeClaimResponse = {
  allowed?: boolean;
  reason?: string;
  resumeContext?: string | null;
};

export type UseColdResumeInitiatorOptions = {
  sessionId: string | null | undefined;
  turnBoundaryKey: string;
  executionStatus?: string;
  enabled?: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isLoadingSessionMessages: boolean;
  hasMessages: boolean;
  /** PD-SAAS-FORK (Goal Loop P2 H2): block cold resume while user_action_required is active. */
  userActionBlocked?: boolean;
  autoContinueBlocked?: boolean;
  sessionTerminalComplete?: boolean;
  circuitBreakerTripped?: boolean;
  projectName?: string;
  projectPath?: string;
  onContinue: (message: string) => void;
  /** PD-SAAS-FORK: manual mode — store resume payload for composer button. */
  onManualContinueOffer?: (message: string) => void;
};

export function useColdResumeInitiator({
  sessionId,
  turnBoundaryKey,
  executionStatus,
  enabled = true,
  isConnected,
  isLoading,
  isLoadingSessionMessages,
  hasMessages,
  userActionBlocked = false,
  autoContinueBlocked = false,
  sessionTerminalComplete = false,
  circuitBreakerTripped = false,
  projectName,
  projectPath,
  onContinue,
  onManualContinueOffer,
}: UseColdResumeInitiatorOptions): void {
  const attemptedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevExecutionStatusRef = useRef<string | undefined>(undefined);
  const autoContinueEnabled = readAutoContinueEnabled();
  const manualMode = !autoContinueEnabled && Boolean(onManualContinueOffer);

  useEffect(() => {
    const prev = prevExecutionStatusRef.current;
    prevExecutionStatusRef.current = executionStatus;
    if (prev === 'queued' && executionStatus && executionStatus !== 'queued' && sessionId) {
      attemptedRef.current.delete(sessionId);
    }
  }, [executionStatus, sessionId]);

  useEffect(() => {
    const alreadyAttempted = sessionId ? attemptedRef.current.has(sessionId) : true;
    const gate = shouldProbeColdResume({
      sessionId,
      enabled,
      autoContinueEnabled,
      manualMode,
      isConnected,
      isLoading,
      isLoadingSessionMessages,
      hasMessages,
      alreadyAttempted,
      userActionBlocked,
      autoContinueBlocked,
      sessionTerminalComplete,
      circuitBreakerTripped,
    });
    if (!gate || !sessionId) return undefined;

    const sid = sessionId;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      // Re-mark inside the timer so a session switch before the probe doesn't consume the wrong id.
      if (attemptedRef.current.has(sid)) return;
      attemptedRef.current.add(sid);
      void (async () => {
        try {
          const response = await api.sessionColdResume(sid, { projectName, projectPath });
          if (!response.ok) return;
          const payload = (await response.json()) as ColdResumeClaimResponse;
          if (!payload?.allowed) return;
          const message =
            typeof payload.resumeContext === 'string' && payload.resumeContext.trim()
              ? payload.resumeContext.trim()
              : '';
          if (!message) return;
          if (manualMode) {
            onManualContinueOffer?.(message);
            return;
          }
          if (!tryTaskResumeSchedule(turnBoundaryKey, 'cold_resume')) return;
          if (!markTaskResumeFired(turnBoundaryKey, 'cold_resume')) return;
          onContinue(message);
        } catch (error) {
          console.warn('[coldResumeInitiator] probe failed:', error);
        }
      })();
    }, COLD_RESUME_PROBE_DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    sessionId,
    executionStatus,
    enabled,
    isConnected,
    isLoading,
    isLoadingSessionMessages,
    hasMessages,
    userActionBlocked,
    autoContinueBlocked,
    sessionTerminalComplete,
    circuitBreakerTripped,
    turnBoundaryKey,
    projectName,
    projectPath,
    onContinue,
    onManualContinueOffer,
    manualMode,
  ]);
}
