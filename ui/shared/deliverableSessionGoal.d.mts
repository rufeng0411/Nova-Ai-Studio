// PD-SAAS-FORK: TypeScript declarations for dual-runtime deliverable goal extraction.

export type DeliverableSessionMessageLike = {
  role?: string;
  type?: string;
  metadata?: {
    synthetic?: boolean;
  };
  content?: unknown;
};

export function sharedUserGoalImpliesDeliverable(text: unknown): boolean;
export function isContinuationOnlyUserText(text: unknown): boolean;
export function isTaskFollowUpComplaintText(text: unknown): boolean;
export function isAmbiguousFollowUpText(text: unknown): boolean;
export function isShortClarificationAnswerText(text: unknown): boolean;
export function goalHasPageCount(goal: unknown): boolean;
export function resolveClarificationGoal(messages?: DeliverableSessionMessageLike[] | null): string;
export function extractDeliverableSessionUserGoal(messages?: DeliverableSessionMessageLike[] | null): string;
