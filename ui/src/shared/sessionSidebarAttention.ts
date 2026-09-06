// PD-SAAS-FORK: sidebar attention flags — needs user input vs unexpected interrupt.
import type { ProjectSession } from '../types/app';
import type { TurnInteractionMode } from '../../../src/saas/intent/turnInteractionMode.js';
import { isFormalRecoveryInterruptCode } from './formalRecoveryInterrupt';
import type { ManualContinueReason } from './manualContinuePolicy';
import type { RecoverySurfacePhase } from './recoverySurfaceState';
import { sessionHasPendingUserActionRequired } from './parseUserActionNotice';
import { resolveTurnInteractionModeForCurrentTurn } from './turnInteractionUiPolicy';
import { isAutoStalePausedReason } from './sessionAutoContinueGate';
import { isSameSessionId, sessionIdSetHas } from './sessionId';

export type SessionSidebarAttention = {
  needsUserInput: boolean;
  interrupted: boolean;
};

type MessageLike = {
  type?: string;
  role?: string;
  content?: string;
  purpose?: string;
  needsUserInput?: boolean;
  metadata?: { purpose?: string; needsUserInput?: boolean; synthetic?: boolean };
};

export function isUserInitiatedPauseReason(reason: unknown): boolean {
  const value = typeof reason === 'string' ? reason.trim() : '';
  return value === 'user_pause' || value === 'user_stop';
}

/** Catalog pause reasons that mean the task stopped unexpectedly — not user pause / 24h stale. */
export function isInterruptedPauseReason(reason: unknown): boolean {
  const value = typeof reason === 'string' ? reason.trim() : '';
  if (!value) return false;
  if (isUserInitiatedPauseReason(value)) return false;
  if (isAutoStalePausedReason(value)) return false;
  return (
    value === 'repair_circuit_tripped'
    || value === 'recovery_exhausted'
    || value === 'infra_interrupt'
    || value === 'system_exhausted'
    || value === 'stale_turn'
    || value === 'agent_tool_error_loop'
  );
}

const INTERRUPT_MANUAL_CONTINUE_REASONS = new Set<ManualContinueReason>([
  'infra_interrupt',
  'reconnect',
  'stale_turn',
  'recovery_pause',
]);

export function deriveSessionSidebarAttention(input: {
  messages?: MessageLike[];
  userActionBlocked?: boolean;
  pendingElicitationCount?: number;
  latestTurnInteractionMode?: TurnInteractionMode;
  isLoading?: boolean;
  isAssistantWorking?: boolean;
  recoveryPhase?: RecoverySurfacePhase;
  manualContinueReason?: ManualContinueReason | null;
  circuitBreakerTripped?: boolean;
  formalErrorCode?: string | null;
  pausedReason?: string | null;
  executionStatus?: ProjectSession['executionStatus'];
  userAcknowledgedComplete?: boolean;
  sessionTerminalComplete?: boolean;
}): SessionSidebarAttention {
  if (input.userAcknowledgedComplete || input.sessionTerminalComplete) {
    return { needsUserInput: false, interrupted: false };
  }

  const clarifyWaiting = input.latestTurnInteractionMode === 'clarify'
    && !input.isLoading
    && !input.isAssistantWorking;

  const needsUserInput = Boolean(
    input.userActionBlocked
    || (input.pendingElicitationCount ?? 0) > 0
    || clarifyWaiting
    || (input.messages?.length
      ? sessionHasPendingUserActionRequired(input.messages)
      : false),
  );

  if (needsUserInput) {
    return { needsUserInput: true, interrupted: false };
  }

  if (input.isLoading || input.isAssistantWorking) {
    return { needsUserInput: false, interrupted: false };
  }

  const manualReason = input.manualContinueReason ?? null;
  const interrupted = Boolean(
    input.recoveryPhase === 'formal_stop'
    || isFormalRecoveryInterruptCode(input.formalErrorCode)
    || input.circuitBreakerTripped
    || isInterruptedPauseReason(input.pausedReason)
    || (input.executionStatus === 'paused' && isInterruptedPauseReason(input.pausedReason))
    || (manualReason && INTERRUPT_MANUAL_CONTINUE_REASONS.has(manualReason)),
  );

  return { needsUserInput: false, interrupted };
}

export function deriveSessionSidebarAttentionFromMessages(
  messages: MessageLike[],
  input: Omit<NonNullable<Parameters<typeof deriveSessionSidebarAttention>[0]>, 'messages' | 'latestTurnInteractionMode'>,
): SessionSidebarAttention {
  return deriveSessionSidebarAttention({
    ...input,
    messages,
    latestTurnInteractionMode: resolveTurnInteractionModeForCurrentTurn(messages),
  });
}

export function patchSessionAttentionSet(
  previous: Set<string>,
  sessionId: string,
  active: boolean,
): Set<string> {
  if (!sessionId.trim()) return previous;
  const found = sessionIdSetHas(previous, sessionId);
  if (active && !found) {
    const next = new Set(previous);
    next.add(sessionId);
    return next;
  }
  if (!active && found) {
    const next = new Set(previous);
    for (const id of previous) {
      if (isSameSessionId(id, sessionId)) {
        next.delete(id);
      }
    }
    return next;
  }
  return previous;
}
