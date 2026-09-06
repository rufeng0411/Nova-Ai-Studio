// PD-SAAS-FORK (P0-6): completion gate for the agent loop.
//
// When the model wants to STOP (no tool calls) on a deliverable task, the engine already re-runs
// final acceptance against the goal contract and — if a required artifact is missing/broken —
// takes over to repair instead of ending the turn (see AgentLoop's no-tool-calls branch).
//
// This module is the pure, unit-tested decision that gates that takeover behind PILOTDECK_COMPLETION_GATE
// and pins down the two invariants the plan requires:
//   1. profile + goal DOUBLE match — both the goal must imply a concrete deliverable AND a concrete
//      capability profile must require one. Chit-chat / Q&A never gets forced to produce a file.
//   2. triple cap — the engine only takes over while ALL THREE budgets have headroom:
//      the dual-track recovery budget, the general no-progress budget (B / ProgressLedger), and maxTurns.
//
// It never *adds* takeover beyond what the existing path already does; it can only confirm a takeover
// or veto one when a cap is exhausted, so turning the flag on can only make a stuck turn end SOONER.

export type CompletionGateReason =
  | "flag_disabled"
  | "not_deliverable_task"
  | "contract_satisfied"
  | "auto_recovery_disabled"
  | "recovery_budget_exhausted"
  | "progress_budget_exhausted"
  | "max_turns_reached"
  | "engine_takeover";

export interface CompletionGateInput {
  /** PILOTDECK_COMPLETION_GATE. When false the gate is inert (returns flag_disabled). */
  flagEnabled: boolean;
  /** Goal text implies a concrete deliverable (filters chit-chat / Q&A). */
  goalImpliesDeliverable: boolean;
  /** A concrete capability profile (not the "default" fallback) requires a deliverable. */
  profileRequiresDeliverable: boolean;
  /** Final-acceptance found a required artifact missing or broken (contract unmet). */
  acceptanceUnmet: boolean;
  /** Auto-recovery continuation is enabled (resilience config / per-turn gate). */
  autoRecoveryEnabled: boolean;
  /** Remaining dual-track recovery budget for this turn. */
  recoveryBudgetRemaining: number;
  /** General no-progress budget (B) has hit its terminal threshold. */
  progressBudgetTerminal: boolean;
  /** Remaining turns before maxTurns. */
  turnsRemaining: number;
  /** PD-SAAS-FORK (ROG Phase 5): numbered deliverable list steps (≥2 enables takeover). */
  numberedDeliverableSteps?: number;
}

export interface CompletionGateDecision {
  takeover: boolean;
  reason: CompletionGateReason;
}

/**
 * Decide whether the engine should take over (continue to repair) when the model wants to stop.
 * Pure & deterministic: all real-world signals are passed in by the caller.
 */
export function decideCompletionGate(input: CompletionGateInput): CompletionGateDecision {
  if (!input.flagEnabled) {
    return { takeover: false, reason: "flag_disabled" };
  }
  const profileOrNumberedDeliverable = input.profileRequiresDeliverable
    || (input.numberedDeliverableSteps ?? 0) >= 2;
  // (1) profile + goal DOUBLE match — numbered list (≥2 steps) counts as deliverable profile.
  if (!input.goalImpliesDeliverable || !profileOrNumberedDeliverable) {
    return { takeover: false, reason: "not_deliverable_task" };
  }
  // Contract already satisfied -> let the turn complete normally.
  if (!input.acceptanceUnmet) {
    return { takeover: false, reason: "contract_satisfied" };
  }
  // User opted out of auto recovery for this turn -> respect it (soft stop).
  if (!input.autoRecoveryEnabled) {
    return { takeover: false, reason: "auto_recovery_disabled" };
  }
  // (2) triple cap — veto takeover the moment any budget is exhausted, so the turn ends rather than looping.
  if (input.recoveryBudgetRemaining <= 0) {
    return { takeover: false, reason: "recovery_budget_exhausted" };
  }
  if (input.progressBudgetTerminal) {
    return { takeover: false, reason: "progress_budget_exhausted" };
  }
  if (input.turnsRemaining <= 0) {
    return { takeover: false, reason: "max_turns_reached" };
  }
  return { takeover: true, reason: "engine_takeover" };
}

/** Reasons that represent a cap being hit (used to distinguish a veto from a "not applicable"). */
export function isCapExhaustionReason(reason: CompletionGateReason): boolean {
  return (
    reason === "recovery_budget_exhausted"
    || reason === "progress_budget_exhausted"
    || reason === "max_turns_reached"
  );
}
