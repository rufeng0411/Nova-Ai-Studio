// PD-SAAS-FORK: manual task resume — UI never auto-submits when auto-continue is off.
import type { SessionTaskPhase } from './sessionTaskLifecycle';
import type { AutoRecoveryStatus } from '../components/chat-v2/hooks/useAutoRecoveryContinue';

export type ManualContinueReason =
  | 'cold_resume'
  | 'incomplete_deliverable'
  | 'recovery_pause'
  | 'infra_interrupt'
  | 'deliverable_repair'
  | 'stale_turn'
  | 'reconnect';

export type ManualContinueOffer = {
  showButton: boolean;
  hintKey: string;
  resumeMessage: string | null;
  reason: ManualContinueReason | null;
};

export type ManualContinuePolicyInput = {
  autoContinueEnabled: boolean;
  sessionId?: string | null;
  isConnected: boolean;
  userActionBlocked: boolean;
  userAcknowledgedComplete: boolean;
  sessionTerminalComplete: boolean;
  autoContinueBlocked: boolean;
  circuitBreakerTripped: boolean;
  isLoading: boolean;
  isLoadingSessionMessages: boolean;
  sessionTaskPhase: SessionTaskPhase;
  workingStatus?: AutoRecoveryStatus;
  deliverableIncomplete: boolean;
  staleTurnPhase: 'warn' | 'fallback' | null;
  /** Pre-built resume payload from cold-resume / incomplete / reconnect probes. */
  pendingResumeMessage: string | null;
  pendingReason: ManualContinueReason | null;
  /** PD-SAAS-FORK P0-D: suppress hint during auto-continue / deliverable repair. */
  suppressManualContinueHint?: boolean;
};

function isRecoveryPauseStatus(status: AutoRecoveryStatus): boolean {
  return (
    status?.statusKind === 'recovery_pause'
    || String(status?.text || '').toLowerCase() === 'recovery_pause'
  );
}

function isInfraInterruptStatus(status: AutoRecoveryStatus): boolean {
  return (
    status?.statusKind === 'infra_interrupt'
    || status?.interruptKind === 'infra'
  );
}

function isDeliverableRepairStatus(status: AutoRecoveryStatus): boolean {
  return status?.statusKind === 'deliverable_repair';
}

function isBlocked(input: ManualContinuePolicyInput): boolean {
  if (!input.sessionId || !input.isConnected) return true;
  if (input.userActionBlocked) return true;
  if (input.userAcknowledgedComplete || input.sessionTerminalComplete) return true;
  if (input.isLoadingSessionMessages) return true;
  return false;
}

/** When auto-continue is OFF, show composer「继续」instead of silent submitTurn. */
export function resolveManualContinueOffer(input: ManualContinuePolicyInput): ManualContinueOffer {
  const empty: ManualContinueOffer = {
    showButton: false,
    hintKey: '',
    resumeMessage: null,
    reason: null,
  };
  if (input.autoContinueEnabled) return empty;
  if (input.suppressManualContinueHint) return empty;
  if (isBlocked(input)) return empty;

  if (input.pendingResumeMessage?.trim()) {
    return {
      showButton: true,
      hintKey: hintKeyForReason(input.pendingReason ?? 'recovery_pause'),
      resumeMessage: input.pendingResumeMessage.trim(),
      reason: input.pendingReason,
    };
  }

  const status = input.workingStatus;
  if (
    !input.isLoading
    && (
      isRecoveryPauseStatus(status)
      || isInfraInterruptStatus(status)
      || isDeliverableRepairStatus(status)
    )
  ) {
    return {
      showButton: true,
      hintKey: isInfraInterruptStatus(status)
        ? 'composer.manualContinueAfterDisconnect'
        : 'composer.manualContinueHint',
      resumeMessage: null,
      reason: isInfraInterruptStatus(status) ? 'infra_interrupt' : 'recovery_pause',
    };
  }

  if (
    !input.isLoading
    && input.deliverableIncomplete
    && (input.sessionTaskPhase === 'deliverable_incomplete'
      || input.sessionTaskPhase === 'deliverable_repair_pending')
  ) {
    return {
      showButton: true,
      hintKey: 'composer.manualContinueDeliverable',
      resumeMessage: null,
      reason: 'incomplete_deliverable',
    };
  }

  if (input.staleTurnPhase === 'fallback' || input.staleTurnPhase === 'warn') {
    return {
      showButton: true,
      hintKey: 'composer.manualContinueStale',
      resumeMessage: null,
      reason: 'stale_turn',
    };
  }

  return empty;
}

function hintKeyForReason(reason: ManualContinueReason): string {
  switch (reason) {
    case 'cold_resume':
      return 'composer.manualContinueCold';
    case 'incomplete_deliverable':
      return 'composer.manualContinueDeliverable';
    case 'infra_interrupt':
    case 'reconnect':
      return 'composer.manualContinueAfterDisconnect';
    case 'stale_turn':
      return 'composer.manualContinueStale';
    case 'deliverable_repair':
    case 'recovery_pause':
    default:
      return 'composer.manualContinueHint';
  }
}

export function readDefaultAutoContinueEnabled(): boolean {
  const fromVite = import.meta.env?.VITE_DEFAULT_AUTO_RECOVERY_CONTINUE;
  if (fromVite === '1' || fromVite === 'true' || fromVite === 'on') return true;
  if (fromVite === '0' || fromVite === 'false' || fromVite === 'off') return false;
  if (typeof process !== 'undefined') {
    const raw = process.env?.PILOTDECK_DEFAULT_AUTO_RECOVERY_CONTINUE;
    if (raw === '1' || raw === 'true' || raw === 'on') return true;
    if (raw === '0' || raw === 'false' || raw === 'off') return false;
  }
  // PD-SAAS-FORK: stability default — opt-out via settings; manual「继续」when off.
  return true;
}
