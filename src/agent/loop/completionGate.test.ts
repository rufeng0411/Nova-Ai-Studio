import { describe, expect, it } from "vitest";
import {
  type CompletionGateInput,
  decideCompletionGate,
  isCapExhaustionReason,
} from "./completionGate.js";

const base: CompletionGateInput = {
  flagEnabled: true,
  goalImpliesDeliverable: true,
  profileRequiresDeliverable: true,
  acceptanceUnmet: true,
  autoRecoveryEnabled: true,
  recoveryBudgetRemaining: 5,
  progressBudgetTerminal: false,
  turnsRemaining: 10,
  numberedDeliverableSteps: 0,
};

describe("decideCompletionGate", () => {
  it("takes over for a profile+goal deliverable task with an unmet contract and headroom", () => {
    const d = decideCompletionGate(base);
    expect(d).toEqual({ takeover: true, reason: "engine_takeover" });
  });

  it("is inert when the flag is off (no behavior change in production)", () => {
    expect(decideCompletionGate({ ...base, flagEnabled: false })).toEqual({
      takeover: false,
      reason: "flag_disabled",
    });
  });

  it("does NOT force a deliverable on chit-chat / Q&A (goal half missing)", () => {
    expect(decideCompletionGate({ ...base, goalImpliesDeliverable: false }).reason).toBe(
      "not_deliverable_task",
    );
  });

  it("takes over for numbered deliverable list with ≥2 steps (CG-01)", () => {
    expect(decideCompletionGate({
      ...base,
      profileRequiresDeliverable: false,
      numberedDeliverableSteps: 3,
    })).toEqual({ takeover: true, reason: "engine_takeover" });
  });

  it("does NOT expand axis for single numbered step (CG-02)", () => {
    expect(decideCompletionGate({
      ...base,
      profileRequiresDeliverable: false,
      numberedDeliverableSteps: 1,
    }).reason).toBe("not_deliverable_task");
  });

  it("does NOT fire when no concrete profile requires a deliverable (profile half missing)", () => {
    expect(decideCompletionGate({ ...base, profileRequiresDeliverable: false }).reason).toBe(
      "not_deliverable_task",
    );
  });

  it("lets the turn complete when the contract is already satisfied", () => {
    expect(decideCompletionGate({ ...base, acceptanceUnmet: false })).toEqual({
      takeover: false,
      reason: "contract_satisfied",
    });
  });

  it("respects an explicit auto-recovery opt-out", () => {
    expect(decideCompletionGate({ ...base, autoRecoveryEnabled: false }).reason).toBe(
      "auto_recovery_disabled",
    );
  });

  describe("triple cap", () => {
    it("vetoes takeover when the recovery budget is exhausted", () => {
      const d = decideCompletionGate({ ...base, recoveryBudgetRemaining: 0 });
      expect(d.takeover).toBe(false);
      expect(d.reason).toBe("recovery_budget_exhausted");
    });

    it("vetoes takeover when the no-progress (B) budget is terminal", () => {
      const d = decideCompletionGate({ ...base, progressBudgetTerminal: true });
      expect(d.takeover).toBe(false);
      expect(d.reason).toBe("progress_budget_exhausted");
    });

    it("vetoes takeover when maxTurns is reached", () => {
      const d = decideCompletionGate({ ...base, turnsRemaining: 0 });
      expect(d.takeover).toBe(false);
      expect(d.reason).toBe("max_turns_reached");
    });

    it("treats all three caps as cap-exhaustion reasons", () => {
      expect(isCapExhaustionReason("recovery_budget_exhausted")).toBe(true);
      expect(isCapExhaustionReason("progress_budget_exhausted")).toBe(true);
      expect(isCapExhaustionReason("max_turns_reached")).toBe(true);
      expect(isCapExhaustionReason("engine_takeover")).toBe(false);
      expect(isCapExhaustionReason("contract_satisfied")).toBe(false);
    });
  });

  it("checks the flag before anything else (off short-circuits a capped/unmet task)", () => {
    expect(
      decideCompletionGate({
        ...base,
        flagEnabled: false,
        recoveryBudgetRemaining: 0,
        progressBudgetTerminal: true,
        turnsRemaining: 0,
      }).reason,
    ).toBe("flag_disabled");
  });
});
