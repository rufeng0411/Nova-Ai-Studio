import { describe, expect, it } from "vitest";
import { applyGroundTruthToValidation } from "../../src/saas/deliverables/deliverableGroundTruth.js";
import { shouldTriggerDeliverableRepair } from "../../src/saas/taskContinuationPolicy.js";
import type { EngineDeliverableValidation } from "../../src/agent/deliverables/validateDeliverablesEngine.js";

describe("rog-four-line-acceptance-meta", () => {
  it("engine + continuation policy agree after ground truth", () => {
    const userGoal = "1. competitive-brief.md\n2. sentiment-notes.md";
    const base: EngineDeliverableValidation = {
      verified: [
        "artifacts/competitive-brief.md",
        "artifacts/sentiment-notes.md",
      ],
      missing: [],
      broken: [],
      failures: [],
      acceptance: "needs_repair",
    };
    const engine = applyGroundTruthToValidation(base, { userGoal });
    const bridgeStatus = engine.missing.length > 0 || engine.broken.length > 0
      ? "needs_repair"
      : "passed";
    const shouldRepair = shouldTriggerDeliverableRepair({
      userGoal,
      validationResult: engine,
      autoRecoveryContinueEnabled: true,
    });

    expect(engine.acceptance).toBe("passed");
    expect(bridgeStatus).toBe("passed");
    expect(shouldRepair).toBe(false);
  });
});
