// PD-SAAS-FORK: shared gate for incomplete-deliverable resume (auto + manual paths).
import {
  buildAutoRecoveryContinueMessage,
  isHardTurnCompleteStop,
  looksLikeTaskDelivered,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  shouldAutoContinueAfterTurnOutcome,
  type TurnCompleteOutcome,
} from './userFacingErrors';

export type EvaluateIncompleteDeliverableInput = {
  turnCompleteMeta?: TurnCompleteOutcome;
  lastAssistantText?: string;
  userGoalText?: string;
  acceptanceStatus?: string;
  engineRepairOwned?: boolean;
  engineRepairCooldownUntilMs?: number;
  isLoading?: boolean;
  userActionBlocked?: boolean;
};

export type EvaluateIncompleteDeliverableResult = {
  shouldOffer: boolean;
  message: string | null;
};

export function evaluateIncompleteDeliverableContinue(
  input: EvaluateIncompleteDeliverableInput,
): EvaluateIncompleteDeliverableResult {
  const {
    turnCompleteMeta,
    lastAssistantText = '',
    userGoalText,
    acceptanceStatus,
    engineRepairOwned = false,
    engineRepairCooldownUntilMs,
    isLoading = false,
    userActionBlocked = false,
  } = input;

  if (userActionBlocked || isLoading) {
    return { shouldOffer: false, message: null };
  }
  if (engineRepairOwned) {
    return { shouldOffer: false, message: null };
  }
  if (engineRepairCooldownUntilMs && Date.now() < engineRepairCooldownUntilMs) {
    return { shouldOffer: false, message: null };
  }
  if (!turnCompleteMeta) {
    return { shouldOffer: false, message: null };
  }
  if (isHardTurnCompleteStop(turnCompleteMeta)) {
    return { shouldOffer: false, message: null };
  }
  if (acceptanceStatus === 'passed') {
    return { shouldOffer: false, message: null };
  }

  const assistantText = lastAssistantText ?? '';
  const recoverableTurnStop = shouldAutoContinueAfterTurnOutcome({
    ...turnCompleteMeta,
    assistantText,
    userGoalText,
  });

  if (recoverableTurnStop && !turnCompleteMeta.aborted) {
    return { shouldOffer: false, message: null };
  }
  if (turnCompleteMeta.aborted && !recoverableTurnStop) {
    return { shouldOffer: false, message: null };
  }
  if (!recoverableTurnStop && shouldAutoContinueAfterTurnOutcome(turnCompleteMeta)) {
    return { shouldOffer: false, message: null };
  }

  const needsRepairFallback =
    acceptanceStatus === 'needs_repair'
    && !userActionBlocked
    && !isLoading;

  if (!needsRepairFallback) {
    if (looksLikeTaskDelivered(assistantText, { userGoal: userGoalText })) {
      return { shouldOffer: false, message: null };
    }
    if (
      !recoverableTurnStop
      && !shouldAutoContinueAfterIncompleteDeliverableStop(assistantText, { userGoalText })
    ) {
      return { shouldOffer: false, message: null };
    }
  }

  const lang = typeof document !== 'undefined' && document.documentElement.lang.startsWith('en')
    ? 'en' as const
    : 'zh' as const;
  return {
    shouldOffer: true,
    message: buildAutoRecoveryContinueMessage(lang),
  };
}
