// PD-SAAS-FORK: typed wrapper for shared session-scoped deliverable goal extraction.

import {
  extractDeliverableSessionUserGoal as sharedExtractDeliverableSessionUserGoal,
  goalHasPageCount as sharedGoalHasPageCount,
  isAmbiguousFollowUpText as sharedIsAmbiguousFollowUpText,
  isShortClarificationAnswerText as sharedIsShortClarificationAnswerText,
  resolveClarificationGoal as sharedResolveClarificationGoal,
} from "../../ui/shared/deliverableSessionGoal.mjs";

export type SessionGoalMessage = {
  role?: string;
  type?: string;
  content?: unknown;
  metadata?: { synthetic?: boolean };
};

export function isAmbiguousFollowUpText(text: string): boolean {
  return sharedIsAmbiguousFollowUpText(text);
}

export function extractDeliverableSessionUserGoal(messages: SessionGoalMessage[]): string {
  return sharedExtractDeliverableSessionUserGoal(messages);
}

export function goalHasPageCount(goal: string): boolean {
  return sharedGoalHasPageCount(goal);
}

export function isShortClarificationAnswerText(text: string): boolean {
  return sharedIsShortClarificationAnswerText(text);
}

export function resolveClarificationGoal(messages: SessionGoalMessage[]): string {
  return sharedResolveClarificationGoal(messages);
}
