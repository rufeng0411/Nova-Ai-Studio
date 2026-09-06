// PD-SAAS-FORK: UI fallback when turn succeeds but deliverable still missing
import { useEffect, useRef } from 'react';

import type { TurnCompleteOutcome } from '../../../shared/userFacingErrors';
import { evaluateIncompleteDeliverableContinue } from '../../../shared/evaluateIncompleteDeliverableContinue';
import type { ManualContinueReason } from '../../../shared/manualContinuePolicy';
import { tryTaskResumeSchedule } from './taskResumeCoordinator';
import { readAutoContinueEnabled } from './useAutoRecoveryContinue';

function readAutoContinueDelayMs(): number {
  const fromVite = import.meta.env?.VITE_PILOTDECK_AUTO_CONTINUE_DELAY_MS;
  if (fromVite != null && fromVite !== '') {
    const parsed = Number(fromVite);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if (typeof process !== 'undefined') {
    const raw = process.env?.PILOTDECK_AUTO_CONTINUE_DELAY_MS;
    if (raw != null && raw !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 300;
}

const CONTINUE_DELAY_MS = readAutoContinueDelayMs();

export type UseIncompleteDeliverableAutoContinueOptions = {
  sessionId: string | null | undefined;
  turnBoundaryKey: string;
  turnCompleteSignal: number;
  turnCompleteMeta?: TurnCompleteOutcome;
  lastAssistantText?: string;
  userGoalText?: string;
  isLoading: boolean;
  /** PD-SAAS-FORK: wait for transcript load before deliverable auto-continue. */
  isLoadingSessionMessages?: boolean;
  isConnected?: boolean;
  enabled?: boolean;
  /**
   * PD-SAAS-FORK: true when the engine already marked this turn's acceptance as
   * needs_repair (engine is the repair owner). When set, this UI deliverable
   * fallback steps aside so it never re-opens a generic "继续" turn on top of the
   * engine's repair loop — which would reset the engine's per-turn recovery budget
   * and compound retries. Infrastructure disconnects are still handled separately
   * by useAutoRecoveryContinue via recovery status, and turns where the engine did
   * NOT flag needs_repair (it believed it succeeded) still get this fallback.
   */
  engineRepairOwned?: boolean;
  /** PD-SAAS-FORK: block deliverable auto-continue while user_action_required is active. */
  userActionBlocked?: boolean;
  /** PD-SAAS-FORK (ROG Phase 7 G0): block UI deliverable auto-continue after circuit breaker. */
  circuitBreakerTripped?: boolean;
  /** PD-SAAS-FORK (ROG Phase 8 PR-C1): block UI auto-continue after user acknowledged complete. */
  userAcknowledgedComplete?: boolean;
  /** PD-SAAS-FORK (P0-D): engine passed / circuit terminal — no deliverable UI continue. */
  sessionTerminalComplete?: boolean;
  /** PD-SAAS-FORK: paused / 24h-stale session — only user messages may resume. */
  autoContinueBlocked?: boolean;
  /** PD-SAAS-FORK (ROG Phase 8-2): engine needs_repair after turn ended — UI fallback when non userAction. */
  acceptanceStatus?: string;
  /** PD-SAAS-FORK: block UI auto-continue shortly after in-turn engine repair ended. */
  engineRepairCooldownUntilMs?: number;
  onContinue: (message: string) => void;
  /** PD-SAAS-FORK: manual mode — offer resume without submitTurn. */
  onManualContinueOffer?: (message: string, reason: ManualContinueReason) => void;
  onManualContinueClear?: () => void;
  /** PD-SAAS-FORK (ROG Phase 6 F7): lifecycle UI pending auto-continue signal. */
  onPendingAutoContinue?: (pending: boolean) => void;
};

export function useIncompleteDeliverableAutoContinue({
  sessionId,
  turnBoundaryKey,
  turnCompleteSignal,
  turnCompleteMeta,
  lastAssistantText,
  userGoalText,
  isLoading,
  isLoadingSessionMessages = false,
  isConnected = true,
  enabled = true,
  userActionBlocked = false,
  circuitBreakerTripped = false,
  userAcknowledgedComplete = false,
  sessionTerminalComplete = false,
  autoContinueBlocked = false,
  acceptanceStatus,
  engineRepairOwned = false,
  engineRepairCooldownUntilMs,
  onContinue,
  onManualContinueOffer,
  onManualContinueClear,
  onPendingAutoContinue,
}: UseIncompleteDeliverableAutoContinueOptions): void {
  const lastSignalRef = useRef(turnCompleteSignal);
  const manualOfferKeyRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // PD-SAAS-FORK: acceptance meta can land on the message a tick after the turn
  // completes, so we read the latest value through a ref inside the delayed
  // callback rather than capturing it at schedule time.
  const engineRepairOwnedRef = useRef(engineRepairOwned);
  engineRepairOwnedRef.current = engineRepairOwned;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!userAcknowledgedComplete && !sessionTerminalComplete) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onPendingAutoContinue?.(false);
  }, [onPendingAutoContinue, sessionTerminalComplete, userAcknowledgedComplete]);

  useEffect(() => {
    if (!enabled || !sessionId || !isConnected) return;
    if (userActionBlocked) return;
    if (userAcknowledgedComplete || sessionTerminalComplete) return;
    if (autoContinueBlocked) return;
    if (isLoading || isLoadingSessionMessages) return;
    if (turnCompleteSignal === lastSignalRef.current) return;
    lastSignalRef.current = turnCompleteSignal;

    const evaluation = evaluateIncompleteDeliverableContinue({
      turnCompleteMeta,
      lastAssistantText,
      userGoalText,
      acceptanceStatus,
      engineRepairOwned,
      engineRepairCooldownUntilMs,
      isLoading,
      userActionBlocked,
    });
    if (!evaluation.shouldOffer || !evaluation.message) {
      manualOfferKeyRef.current = '';
      return;
    }

    const autoEnabled = readAutoContinueEnabled();
    // PD-SAAS-FORK: repair circuit stops UI auto-submit only — manual continue stays available.
    if (circuitBreakerTripped && autoEnabled) {
      manualOfferKeyRef.current = '';
      return;
    }
    if (!autoEnabled) {
      const offerKey = `${turnBoundaryKey}:${evaluation.message}`;
      if (manualOfferKeyRef.current !== offerKey) {
        manualOfferKeyRef.current = offerKey;
        onManualContinueOffer?.(evaluation.message, 'incomplete_deliverable');
      }
      return;
    }

    if (!tryTaskResumeSchedule(turnBoundaryKey, 'deliverable_repair')) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    onPendingAutoContinue?.(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onPendingAutoContinue?.(false);
      if (isLoadingRef.current || isLoadingSessionMessages) return;
      if (engineRepairOwnedRef.current) return;
      try {
        onContinue(evaluation.message!);
      } catch (error) {
        console.warn('[incompleteDeliverableAutoContinue] skipped:', error);
      }
    }, CONTINUE_DELAY_MS);
  }, [
    enabled,
    userActionBlocked,
    circuitBreakerTripped,
    engineRepairOwned,
    engineRepairCooldownUntilMs,
    isConnected,
    isLoading,
    isLoadingSessionMessages,
    lastAssistantText,
    onContinue,
    onManualContinueClear,
    onManualContinueOffer,
    sessionId,
    turnBoundaryKey,
    turnCompleteMeta,
    turnCompleteSignal,
    userGoalText,
    userAcknowledgedComplete,
    sessionTerminalComplete,
    autoContinueBlocked,
    acceptanceStatus,
    onPendingAutoContinue,
  ]);
}
