// PD-SAAS-FORK (ROG Phase 6 F7): task lifecycle phases beyond single-turn isLoading.
import { buildCompletionStateLabelFromInput } from './deliverableUserStatusCopy';
export type SessionTaskPhase =
  | 'idle'
  | 'turn_queued'
  | 'turn_streaming'
  | 'turn_continuing'
  | 'auto_continue_pending'
  | 'deliverable_repair_pending'
  | 'deliverable_incomplete'
  | 'awaiting_preflight'
  | 'combo_stage_pending'
  | 'blocked_user_action';

export type ResolveSessionTaskPhaseInput = {
  isLoading: boolean;
  sessionRepairActive?: boolean;
  lastAcceptanceStatus?: string;
  pendingAutoContinue?: boolean;
  userActionBlocked?: boolean;
  isConnected?: boolean;
  /** PD-SAAS-FORK: user marked task complete in sidebar — force idle lifecycle. */
  userAcknowledgedComplete?: boolean;
  /** PD-SAAS-FORK (P0-D): engine passed / circuit / certificate — force idle lifecycle. */
  sessionTerminalComplete?: boolean;
  /** PD-SAAS-FORK (ROG Phase 7 G6): multi-stage combo goal label e.g. "阶段 2/3". */
  comboStageLabel?: string;
  /** PD-SAAS-FORK (Goal Loop R9): dock progress shows incomplete contract while turn idle. */
  deliverableIncomplete?: boolean;
  /** PD-SAAS-FORK: Turn Queue — session accepted but not yet running on Gateway. */
  executionStatus?: 'queued' | 'running' | 'completed' | 'failed' | 'paused';
  queuePosition?: number;
  /** PD-SAAS-FORK Preflight Studio: visual slot awaiting user style selection. */
  awaitingPreflight?: boolean;
};

export function isComboStageUiEnabled(): boolean {
  const raw = import.meta.env?.VITE_PILOTDECK_COMBO_STAGE_UI;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return raw === '1' || raw === 'true' || raw === 'on' || raw === undefined;
}

const COMBO_GOAL_PATTERN =
  /(?:然后|接着|再使用|再用|之后).{0,24}(?:音频|视频|播客|seedance|即梦|生图)/i;

export function detectComboStageLabel(userGoal: string): string | undefined {
  if (!isComboStageUiEnabled()) return undefined;
  const goal = String(userGoal ?? '').trim();
  if (!COMBO_GOAL_PATTERN.test(goal)) return undefined;
  const stages = goal.split(/(?:然后|接着)/i).filter(Boolean);
  if (stages.length < 2) return undefined;
  return `阶段 1/${Math.min(stages.length, 3)}`;
}

export function isTaskLifecycleUiEnabled(): boolean {
  const raw = import.meta.env?.VITE_PILOTDECK_TASK_LIFECYCLE_UI;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

export function resolveSessionTaskPhase(input: ResolveSessionTaskPhaseInput): SessionTaskPhase {
  if (input.userAcknowledgedComplete) return 'idle';
  if (input.userActionBlocked) return 'blocked_user_action';
  // PD-SAAS-FORK: user paused — treat as idle so composer reopens; auto-continue gated elsewhere.
  if (input.executionStatus === 'paused') return 'idle';
  if (input.executionStatus === 'queued') return 'turn_queued';
  if (input.awaitingPreflight) return 'awaiting_preflight';
  if (input.isLoading) return 'turn_streaming';
  if (input.pendingAutoContinue) return 'auto_continue_pending';
  if (
    input.sessionRepairActive
    || input.lastAcceptanceStatus === 'needs_repair'
  ) {
    return 'deliverable_repair_pending';
  }
  if (input.deliverableIncomplete) {
    return 'deliverable_incomplete';
  }
  if (input.sessionTerminalComplete) return 'idle';
  if (input.comboStageLabel && isComboStageUiEnabled()) {
    return 'combo_stage_pending';
  }
  return 'idle';
}

export function isSessionTaskInFlight(phase: SessionTaskPhase): boolean {
  switch (phase) {
    case 'turn_queued':
    case 'turn_streaming':
    case 'turn_continuing':
    case 'auto_continue_pending':
    case 'deliverable_repair_pending':
    case 'deliverable_incomplete':
    case 'awaiting_preflight':
    case 'combo_stage_pending':
      return true;
    case 'idle':
    case 'blocked_user_action':
      return false;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function isAssistantWorkingFromPhase(phase: SessionTaskPhase): boolean {
  if (!isTaskLifecycleUiEnabled()) {
    return phase === 'turn_streaming' || phase === 'turn_continuing';
  }
  return isSessionTaskInFlight(phase);
}

export function isComposerDisabledForPhase(phase: SessionTaskPhase): boolean {
  if (!isTaskLifecycleUiEnabled()) {
    return phase === 'turn_streaming' || phase === 'turn_continuing';
  }
  if (phase === 'combo_stage_pending') return false;
  if (phase === 'deliverable_incomplete') return true;
  return isSessionTaskInFlight(phase);
}

export type ShouldShowComposerStopButtonInput = {
  userAcknowledgedComplete?: boolean;
  canAbortSession: boolean;
  isLoading: boolean;
  sessionTaskPhase: SessionTaskPhase;
  executionStatus?: ResolveSessionTaskPhaseInput['executionStatus'];
  sessionInProcessingSet?: boolean;
  /** @deprecated Ignored — dock progress must not replace the send button when the turn is idle. */
  deliverablesInProgress?: boolean;
};

function isActiveTurnExecutionStatus(
  executionStatus: ResolveSessionTaskPhaseInput['executionStatus'] | undefined,
): boolean {
  return executionStatus === 'running' || executionStatus === 'queued';
}

/** Primary action: stop/pause only while a turn is actively running or auto-continuing. */
export function shouldShowComposerStopButton(
  input: ShouldShowComposerStopButtonInput,
): boolean {
  if (input.userAcknowledgedComplete) return false;
  if (input.executionStatus === 'paused') return false;

  const turnActivelyRunning =
    input.isLoading
    || isActiveTurnExecutionStatus(input.executionStatus)
    || (
      Boolean(input.sessionInProcessingSet)
      && (input.isLoading || isActiveTurnExecutionStatus(input.executionStatus))
    );

  if (input.canAbortSession && input.isLoading) return true;
  if (input.executionStatus === 'queued') return true;
  if (input.executionStatus === 'running') {
    return input.isLoading
      || input.canAbortSession
      || Boolean(input.sessionInProcessingSet)
      || input.sessionTaskPhase === 'turn_streaming'
      || input.sessionTaskPhase === 'turn_continuing';
  }
  if (input.sessionInProcessingSet && turnActivelyRunning) return true;

  switch (input.sessionTaskPhase) {
    case 'turn_streaming':
    case 'turn_continuing':
    case 'turn_queued':
    case 'auto_continue_pending':
      return true;
    case 'deliverable_repair_pending':
      return input.isLoading || input.canAbortSession;
    case 'idle':
    case 'blocked_user_action':
    case 'deliverable_incomplete':
    case 'awaiting_preflight':
    case 'combo_stage_pending':
      return false;
    default: {
      const _exhaustive: never = input.sessionTaskPhase;
      return _exhaustive;
    }
  }
}

/** User-facing completion state label (P1 partial semantics). */
export function buildCompletionStateLabel(input: {
  completionState?: string;
  requiredDone?: number;
  requiredTotal?: number;
  acceptanceStatus?: string;
  qualityCompletion?: string;
}): string {
  return buildCompletionStateLabelFromInput(input);
}

/** User-facing hint for partial deliverable progress (0713). */
export function buildDeliverableLifecycleHint(input: {
  done: number;
  total: number;
  pendingWritten?: boolean;
}): string {
  const { done, total, pendingWritten } = input;
  if (total <= 0) return '';
  const remaining = Math.max(0, total - done);
  if (remaining <= 0) return '';
  if (pendingWritten && done > 0) {
    return `已写入 ${done}/${total} 项，待验收补齐 ${remaining} 项`;
  }
  return `补齐剩余 ${remaining} 项成果`;
}
