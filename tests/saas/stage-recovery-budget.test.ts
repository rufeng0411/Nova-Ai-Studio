import { describe, expect, it } from "vitest";
import { resolveStageRecoveryBudget } from "../../src/saas/resilience/stageRecoveryBudget.js";

describe("stageRecoveryBudget", () => {
  it("allocates fair share per stage", () => {
    expect(resolveStageRecoveryBudget({
      stageIndex: 0,
      totalStages: 6,
      globalRemaining: 8,
    })).toBe(1);
  });
});
