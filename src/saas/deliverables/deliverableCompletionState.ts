// PD-SAAS-FORK: Centralize terminal acceptance predicates for engine and UI parity.
export type DeliverableCompletionState =
  | "complete"
  | "accepted_partial"
  | "incomplete"
  | "blocked";

export function isAcceptanceSatisfied(
  state: DeliverableCompletionState | null | undefined,
): boolean {
  return state === "complete" || state === "accepted_partial";
}

export function shouldStopAutomaticContinuation(
  state: DeliverableCompletionState | null | undefined,
): boolean {
  return state === "complete"
    || state === "accepted_partial"
    || state === "blocked";
}
