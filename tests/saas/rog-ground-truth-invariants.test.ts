import { describe, expect, it } from "vitest";
import { reconcileDeliverableGroundTruth } from "../../src/saas/deliverables/deliverableGroundTruth.js";
import { shouldTriggerDeliverableRepair } from "../../src/saas/taskContinuationPolicy.js";
import { applyGroundTruthToValidation } from "../../src/saas/deliverables/deliverableGroundTruth.js";
import type { EngineDeliverableValidation } from "../../src/agent/deliverables/validateDeliverablesEngine.js";

describe("rog-ground-truth-invariants", () => {
  it("INV-1: verified complete + empty gaps → passed and no repair", () => {
    const userGoal = [
      "1. competitive-brief.md 竞品简报",
      "2. sentiment-notes.md 口碑要点",
    ].join("\n");
    const verified = [
      "artifacts/competitive/competitive-brief.md",
      "artifacts/competitive/sentiment-notes.md",
    ];
    const result = reconcileDeliverableGroundTruth({
      userGoal,
      verified,
      missing: [],
      broken: [],
    });
    expect(result.acceptance).toBe("passed");
    expect(
      shouldTriggerDeliverableRepair({
        userGoal,
        validationResult: { verified, missing: [], broken: [] },
        autoRecoveryContinueEnabled: true,
      }),
    ).toBe(false);
  });

  it("INV-3: applyGroundTruth clears continuePrompt on reconcile", () => {
    const validation: EngineDeliverableValidation = {
      verified: ["artifacts/a.md", "artifacts/b.md"],
      missing: [],
      broken: [],
      failures: [],
      acceptance: "needs_repair",
      continuePrompt: "repair please",
    };
    const next = applyGroundTruthToValidation(validation, {
      userGoal: "1. a.md\n2. b.md",
    });
    expect(next.acceptance).toBe("passed");
    expect(next.continuePrompt).toBeUndefined();
  });
});
