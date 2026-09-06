// PD-SAAS-FORK: unified recovery UX surface — copy follows auto-continue behavior.
import { isUserFacingRecoveryCopyLine } from './userFacingErrors';
import type { SessionTaskPhase } from './sessionTaskLifecycle';
import type { TurnInteractionMode } from '../../../src/saas/intent/turnInteractionMode.js';
import { isFormalRecoveryInterruptCode } from './formalRecoveryInterrupt';
import {
  adjustAssistantWorkingForInteractionMode,
  shouldShowLiveToolProcessInDock,
  shouldSuppressSessionRepairUi,
} from './turnInteractionUiPolicy';

export type RecoverySurfacePhase =
  | 'silent'
  | 'working'
  | 'auto_continuing'
  | 'manual_resume_pending'
  | 'blocked_user'
  | 'formal_stop';

export type RecoverySurfaceView = {
  phase: RecoverySurfacePhase;
  /** Show explicit continue button / actionable hints — only when auto-continue is off and formally stopped. */
  showActionableContinue: boolean;
  /** Composer「继续」button — manual resume pending (auto-continue off). */
  showManualContinueButton?: boolean;
  liveDockTitleKey: string;
  suppressDuplicateHints: boolean;
  /** Hide stacked recovery error rows in the transcript (e.g. turn queued — task not running). */
  hideInThreadRecoveryNotices?: boolean;
  isAssistantWorkingAuthoritative: boolean;
  suppressSessionRepairUi: boolean;
  showLiveToolProcessInDock: boolean;
};

export type WorkingStatusLike = {
  statusKind?: string;
  text?: string;
  budgetRemaining?: number;
  interruptKind?: string;
} | null | undefined;

export type RecoverySurfaceInput = {
  enabled?: boolean;
  autoContinueEnabled: boolean;
  recoveryContinuePending: boolean;
  pendingAutoContinue: boolean;
  userActionBlocked: boolean;
  autoContinueBlocked: boolean;
  circuitBreakerTripped: boolean;
  userAcknowledgedComplete: boolean;
  /** PD-SAAS-FORK (P0-D): terminal completion — same UX as user acknowledged. */
  sessionTerminalComplete?: boolean;
  isLoading: boolean;
  sessionTaskPhase: SessionTaskPhase;
  isAssistantWorkingFromLifecycle: boolean;
  workingStatus?: WorkingStatusLike;
  formalErrorCode?: string | null;
  latestTurnInteractionMode?: TurnInteractionMode;
  uiGraceRemaining?: number;
  engineRepairOwned?: boolean;
  /** PD-SAAS-FORK: manual continue offer active (composer button). */
  manualContinuePending?: boolean;
};

function readRecoverySurfaceFlag(): boolean {
  const raw = typeof import.meta !== 'undefined'
    ? (import.meta.env as Record<string, string | undefined>)?.VITE_RECOVERY_SURFACE_V2
    : undefined;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  if (typeof process !== 'undefined') {
    const fromProcess = process.env?.PILOTDECK_RECOVERY_SURFACE_V2;
    if (fromProcess === '0' || fromProcess === 'false' || fromProcess === 'off') return false;
    if (fromProcess === '1' || fromProcess === 'true' || fromProcess === 'on') return true;
  }
  // dev default ON when unset; production pack leaves unset → OFF
  return import.meta.env?.DEV === true || import.meta.env?.MODE === 'development';
}

export function isRecoverySurfaceV2Enabled(): boolean {
  return readRecoverySurfaceFlag();
}

function isRecoveryHandlingStatus(status: WorkingStatusLike): boolean {
  const raw = String(status?.text || '').toLowerCase();
  return status?.statusKind === 'recovery_handling' || raw.includes('recovery_handling');
}

function isRecoveryPauseStatus(status: WorkingStatusLike): boolean {
  const raw = String(status?.text || '').toLowerCase();
  return status?.statusKind === 'recovery_pause' || raw.includes('recovery_pause');
}

function isInfraInterruptStatus(status: WorkingStatusLike): boolean {
  return status?.statusKind === 'infra_interrupt' || status?.interruptKind === 'infra';
}

function isFormalStop(input: RecoverySurfaceInput): boolean {
  if (input.autoContinueBlocked && !input.isLoading) return true;
  if (isFormalRecoveryInterruptCode(input.formalErrorCode)) return true;
  const budget = input.workingStatus?.budgetRemaining;
  if (
    isRecoveryPauseStatus(input.workingStatus)
    && typeof budget === 'number'
    && budget <= 0
    && (input.uiGraceRemaining ?? 0) <= 0
    && !input.recoveryContinuePending
    && !input.pendingAutoContinue
  ) {
    return true;
  }
  return false;
}

function buildLegacyRecoverySurfaceView(input: RecoverySurfaceInput): RecoverySurfaceView {
  const isAssistantWorkingAuthoritative = input.isAssistantWorkingFromLifecycle;
  const autoContinue = input.autoContinueEnabled;
  return {
    phase: input.isLoading || input.recoveryContinuePending || input.pendingAutoContinue
      ? 'working'
      : 'working',
    showActionableContinue: !autoContinue,
    liveDockTitleKey: 'working.recoveryPause',
    suppressDuplicateHints: autoContinue,
    isAssistantWorkingAuthoritative,
    suppressSessionRepairUi: false,
    showLiveToolProcessInDock: true,
  };
}

export function resolveRecoverySurfaceState(input: RecoverySurfaceInput): RecoverySurfaceView {
  if (input.enabled === false || !isRecoverySurfaceV2Enabled()) {
    return buildLegacyRecoverySurfaceView(input);
  }

  const suppressSessionRepairUi = shouldSuppressSessionRepairUi(input.latestTurnInteractionMode);
  const showLiveToolProcessInDock = shouldShowLiveToolProcessInDock(input.latestTurnInteractionMode);

  let isAssistantWorkingAuthoritative = input.isAssistantWorkingFromLifecycle;
  isAssistantWorkingAuthoritative = adjustAssistantWorkingForInteractionMode({
    isAssistantWorking: isAssistantWorkingAuthoritative,
    latestTurnInteractionMode: input.latestTurnInteractionMode,
    isLoading: input.isLoading,
  });

  if (input.userAcknowledgedComplete || input.sessionTerminalComplete) {
    return {
      phase: 'silent',
      showActionableContinue: false,
      liveDockTitleKey: 'working.generating',
      suppressDuplicateHints: true,
      isAssistantWorkingAuthoritative: false,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  if (input.sessionTaskPhase === 'turn_queued') {
    return {
      phase: 'silent',
      showActionableContinue: false,
      liveDockTitleKey: 'sidebar.sessions.queued',
      suppressDuplicateHints: true,
      hideInThreadRecoveryNotices: true,
      isAssistantWorkingAuthoritative: input.isAssistantWorkingFromLifecycle,
      suppressSessionRepairUi,
      showLiveToolProcessInDock: false,
    };
  }

  if (input.userActionBlocked) {
    return {
      phase: 'blocked_user',
      showActionableContinue: false,
      liveDockTitleKey: 'working.needsYourInput',
      suppressDuplicateHints: true,
      isAssistantWorkingAuthoritative,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  if (
    input.sessionTaskPhase === 'deliverable_repair_pending'
    || (input.engineRepairOwned && input.isAssistantWorkingFromLifecycle)
  ) {
    return {
      phase: 'silent',
      showActionableContinue: false,
      liveDockTitleKey: 'working.deliverableAligning',
      suppressDuplicateHints: true,
      hideInThreadRecoveryNotices: true,
      isAssistantWorkingAuthoritative: input.isAssistantWorkingFromLifecycle,
      suppressSessionRepairUi,
      showLiveToolProcessInDock: true,
    };
  }

  if (
    !input.autoContinueEnabled
    && input.manualContinuePending
    && !input.isLoading
  ) {
    return {
      phase: 'manual_resume_pending',
      showActionableContinue: false,
      showManualContinueButton: true,
      liveDockTitleKey: 'composer.manualContinueHint',
      suppressDuplicateHints: true,
      isAssistantWorkingAuthoritative: false,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  if (
    input.autoContinueEnabled
    && !input.autoContinueBlocked
    && (input.recoveryContinuePending || input.pendingAutoContinue)
  ) {
    return {
      phase: 'auto_continuing',
      showActionableContinue: false,
      liveDockTitleKey: 'working.autoContinuing',
      suppressDuplicateHints: true,
      isAssistantWorkingAuthoritative: true,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  const formalStop = isFormalStop(input);
  if (formalStop) {
    const canAuto = input.autoContinueEnabled
      && !input.autoContinueBlocked
      && (input.uiGraceRemaining ?? 0) > 0;
    if (canAuto) {
      return {
        phase: 'silent',
        showActionableContinue: false,
        liveDockTitleKey: 'working.autoContinuing',
        suppressDuplicateHints: true,
        isAssistantWorkingAuthoritative: true,
        suppressSessionRepairUi,
        showLiveToolProcessInDock,
      };
    }
    return {
      phase: 'formal_stop',
      showActionableContinue: !input.autoContinueEnabled,
      liveDockTitleKey: 'working.recoveryExhausted',
      suppressDuplicateHints: true,
      isAssistantWorkingAuthoritative: false,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  if (
    input.autoContinueEnabled
    && (isRecoveryPauseStatus(input.workingStatus) || isInfraInterruptStatus(input.workingStatus))
    && !input.autoContinueBlocked
  ) {
    return {
      phase: 'silent',
      showActionableContinue: false,
      liveDockTitleKey: isInfraInterruptStatus(input.workingStatus)
        ? 'working.networkInterruptAutoContinue'
        : 'working.autoContinuing',
      suppressDuplicateHints: true,
      isAssistantWorkingAuthoritative: true,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  if (isRecoveryHandlingStatus(input.workingStatus) || input.isLoading) {
    return {
      phase: 'working',
      showActionableContinue: false,
      liveDockTitleKey: 'working.recoveryHandlingGeneric',
      suppressDuplicateHints: input.autoContinueEnabled,
      isAssistantWorkingAuthoritative,
      suppressSessionRepairUi,
      showLiveToolProcessInDock,
    };
  }

  return {
    phase: 'working',
    showActionableContinue: false,
    liveDockTitleKey: 'working.generating',
    suppressDuplicateHints: input.autoContinueEnabled,
    isAssistantWorkingAuthoritative,
    suppressSessionRepairUi,
    showLiveToolProcessInDock,
  };
}

export function isUnifiedRecoveryNoticeSummary(
  summary: string,
  unifiedHandlingSummary?: string,
): boolean {
  const trimmed = String(summary ?? '').trim();
  if (!trimmed) return false;
  if (isUserFacingRecoveryCopyLine(trimmed)) return true;
  if (unifiedHandlingSummary && trimmed === unifiedHandlingSummary.trim()) return true;
  return false;
}

/** At most one weak recovery hint in the transcript — dock carries live status. */
export function shouldShowRecoveryErrorInThread(input: {
  surface?: RecoverySurfaceView;
  autoContinueEnabled: boolean;
  /** Session-level in-flight (not per-row last message). */
  isSessionInFlight: boolean;
  isLastGlobalRecoveryError: boolean;
  isPermission: boolean;
  showFormalGuidance: boolean;
  summary: string;
  unifiedHandlingSummary?: string;
}): boolean {
  if (input.showFormalGuidance || input.isPermission) return true;
  if (input.surface?.hideInThreadRecoveryNotices) return false;

  const unified = isUnifiedRecoveryNoticeSummary(input.summary, input.unifiedHandlingSummary);
  if (unified) {
    if (input.autoContinueEnabled || input.isSessionInFlight) return false;
    return input.isLastGlobalRecoveryError;
  }

  if (input.isSessionInFlight && !input.isLastGlobalRecoveryError) return false;
  if (input.surface?.suppressDuplicateHints && !input.isLastGlobalRecoveryError) return false;
  return true;
}

/** Same turn: only the last recovery-related error row should render GentleNotice. */
export function shouldRenderRecoveryNoticeForMessage(input: {
  messageType?: string;
  messageTurnId?: string;
  isLastRecoveryErrorInTurn: boolean;
  surface: RecoverySurfaceView;
}): boolean {
  if (input.messageType !== 'error') return true;
  if (input.surface.hideInThreadRecoveryNotices) return false;
  if (!input.surface.suppressDuplicateHints) return true;
  return input.isLastRecoveryErrorInTurn;
}

export function applyRecoverySurfaceToNoticeSummary(input: {
  surface: RecoverySurfaceView;
  defaultSummary: string;
  exhaustedSummary: string;
  handlingSummary: string;
}): { summary: string; hints: string[] } {
  const { surface } = input;
  if (surface.phase === 'silent' || surface.phase === 'auto_continuing') {
    return { summary: input.handlingSummary, hints: [] };
  }
  if (surface.phase === 'blocked_user') {
    return { summary: input.handlingSummary, hints: [] };
  }
  if (surface.phase === 'formal_stop' && surface.showActionableContinue) {
    return { summary: input.exhaustedSummary, hints: [] };
  }
  if (surface.phase === 'formal_stop') {
    return { summary: input.handlingSummary, hints: [] };
  }
  if (surface.suppressDuplicateHints) {
    return { summary: input.handlingSummary, hints: [] };
  }
  return { summary: input.defaultSummary, hints: [] };
}
