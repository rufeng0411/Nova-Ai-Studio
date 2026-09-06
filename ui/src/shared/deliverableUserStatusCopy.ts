// PD-SAAS-FORK P0-D: unified user-facing deliverable status copy (USN).
import type { SessionTaskPhase } from './sessionTaskLifecycle';
import type {
  DeliverableCompletionStateUi,
  DeliverableQualityCompletionUi,
  TurnContinuationOwner,
} from './turnAcceptanceMeta';
import { isDeliverableTrustCopyV2Enabled } from './perfFeatureFlags';

export type DeliverableUserStatusInput = {
  sessionTaskPhase: SessionTaskPhase;
  acceptanceStatus?: string;
  completionState?: DeliverableCompletionStateUi;
  qualityCompletion?: DeliverableQualityCompletionUi;
  requiredDone?: number;
  requiredTotal?: number;
  continuationOwner?: TurnContinuationOwner;
  autoContinueEnabled: boolean;
  sessionRepairActive?: boolean;
  pendingAutoContinue?: boolean;
  executionStatus?: 'queued' | 'running' | 'paused' | 'completed' | 'failed';
  queuePosition?: number;
  validationSettled?: boolean;
  trustCopyV2Enabled?: boolean;
  isAssistantWorking?: boolean;
};

export type DeliverableUserStatusCopy = {
  composerPlaceholderKey: string;
  composerPlaceholderValues: Record<string, string | number>;
  liveDockTitleKey: string;
  liveDockTitleValues: Record<string, string | number>;
  qualityPresentationKey:
    | 'deliverables.qualityStatus.complete'
    | 'deliverables.qualityStatus.contentPassedAligning'
    | 'deliverables.qualityStatus.needsRepair'
    | 'deliverables.qualityStatus.officialMediaDegraded'
    | 'deliverables.qualityStatus.userAcknowledged'
    | 'deliverables.qualityStatus.blocked'
    | 'deliverables.qualityStatus.notApplicable'
    | null;
  suppressManualContinueHint: boolean;
  showUserAckHint: boolean;
};

function progressValues(input: DeliverableUserStatusInput): { done: number; total: number; remaining: number } {
  const done = Math.max(0, input.requiredDone ?? 0);
  const total = Math.max(0, input.requiredTotal ?? 0);
  return { done, total, remaining: Math.max(0, total - done) };
}

export function isDeliverableRepairInFlight(input: DeliverableUserStatusInput): boolean {
  return input.sessionTaskPhase === 'deliverable_repair_pending'
    || input.continuationOwner === 'deliverable_repair'
    || Boolean(input.sessionRepairActive);
}

export function resolveShowUserAckHint(input: DeliverableUserStatusInput): boolean {
  if (!input.trustCopyV2Enabled && input.trustCopyV2Enabled !== undefined) {
    return input.sessionTaskPhase === 'deliverable_incomplete';
  }
  return input.sessionTaskPhase === 'deliverable_incomplete'
    && !input.sessionRepairActive
    && input.continuationOwner !== 'deliverable_repair'
    && !input.pendingAutoContinue
    && !isDeliverableRepairInFlight(input);
}

export function resolveDeliverableUserStatusCopy(
  input: DeliverableUserStatusInput,
): DeliverableUserStatusCopy {
  const trustEnabled = input.trustCopyV2Enabled ?? isDeliverableTrustCopyV2Enabled();
  const { done, total, remaining } = progressValues(input);
  const baseValues = { done, total, remaining, position: input.queuePosition ?? 0 };

  const suppressManualContinueHint = trustEnabled && (
    input.autoContinueEnabled && (
      isDeliverableRepairInFlight(input)
      || input.pendingAutoContinue
      || input.sessionTaskPhase === 'deliverable_repair_pending'
      || input.sessionTaskPhase === 'auto_continue_pending'
      || Boolean(input.isAssistantWorking)
    )
  );

  const showUserAckHint = resolveShowUserAckHint({ ...input, trustCopyV2Enabled: trustEnabled });

  let qualityPresentationKey: DeliverableUserStatusCopy['qualityPresentationKey'] = null;
  if (input.qualityCompletion === 'passed' && input.completionState === 'incomplete') {
    qualityPresentationKey = 'deliverables.qualityStatus.contentPassedAligning';
  } else if (input.completionState === 'complete') {
    qualityPresentationKey = 'deliverables.qualityStatus.complete';
  }

  if (trustEnabled && input.sessionTaskPhase === 'awaiting_preflight') {
    return {
      composerPlaceholderKey: 'composer.preflightAwaitingPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.preflightAwaiting',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint: true,
      showUserAckHint: false,
    };
  }

  if (trustEnabled && (
    input.sessionTaskPhase === 'turn_queued'
    || input.executionStatus === 'queued'
  )) {
    return {
      composerPlaceholderKey: 'composer.deliverableQueuedPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'sidebar.sessions.queued',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint: true,
      showUserAckHint: false,
    };
  }

  const makingInFlight = input.isAssistantWorking
    || input.sessionTaskPhase === 'turn_streaming'
    || input.sessionTaskPhase === 'turn_queued'
    || input.sessionTaskPhase === 'turn_continuing';

  if (trustEnabled && makingInFlight) {
    return {
      composerPlaceholderKey: 'composer.taskInFlightPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.making',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint,
      showUserAckHint: false,
    };
  }

  if (trustEnabled && isDeliverableRepairInFlight(input)) {
    return {
      composerPlaceholderKey: 'composer.deliverableAligningPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.deliverableAligning',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint: true,
      showUserAckHint: false,
    };
  }

  if (
    trustEnabled
    && input.validationSettled === false
    && input.sessionTaskPhase !== 'idle'
  ) {
    return {
      composerPlaceholderKey: 'composer.taskInFlightPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.making',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint,
      showUserAckHint: false,
    };
  }

  if (
    trustEnabled
    && input.sessionTaskPhase === 'deliverable_incomplete'
    && !input.autoContinueEnabled
  ) {
    return {
      composerPlaceholderKey: 'composer.deliverableIncompleteManualPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.deliverableAligning',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint: false,
      showUserAckHint: false,
    };
  }

  if (showUserAckHint && remaining > 0) {
    return {
      composerPlaceholderKey: 'composer.deliverableIncompleteProgressPlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.generating',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint,
      showUserAckHint: true,
    };
  }

  if (input.sessionTaskPhase === 'deliverable_incomplete') {
    return {
      composerPlaceholderKey: 'composer.deliverableIncompletePlaceholder',
      composerPlaceholderValues: baseValues,
      liveDockTitleKey: 'working.generating',
      liveDockTitleValues: baseValues,
      qualityPresentationKey,
      suppressManualContinueHint,
      showUserAckHint: false,
    };
  }

  return {
    composerPlaceholderKey: 'composer.placeholder',
    composerPlaceholderValues: baseValues,
    liveDockTitleKey: 'working.generating',
    liveDockTitleValues: baseValues,
    qualityPresentationKey,
    suppressManualContinueHint,
    showUserAckHint: false,
  };
}

export function buildCompletionStateLabelFromInput(input: {
  completionState?: string;
  requiredDone?: number;
  requiredTotal?: number;
  acceptanceStatus?: string;
  qualityCompletion?: string;
}): string {
  const done = input.requiredDone ?? 0;
  const total = input.requiredTotal ?? 0;
  const passed = input.acceptanceStatus === 'passed' || input.acceptanceStatus === 'degraded_pass';
  switch (input.completionState) {
    case 'complete':
      return total > 0 && passed ? `全部完成（${done}/${total}）` : total > 0 ? `已对齐（${done}/${total}）` : '全部完成';
    case 'accepted_partial':
      return total > 0 ? `已按当前成果结束（${done}/${total}）` : '已按当前成果结束';
    case 'incomplete':
      if (input.acceptanceStatus === 'passed' || input.qualityCompletion === 'passed') {
        return total > 0 ? `清单对齐中（${done}/${total}）` : '清单对齐中';
      }
      return total > 0 ? `补齐中（${done}/${total}）` : '补齐中';
    case 'blocked':
      return '需您处理';
    default:
      return '';
  }
}
