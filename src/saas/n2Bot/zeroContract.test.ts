import { beforeEach, describe, expect, it } from "vitest";
import { compileSessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";
import { shouldTriggerDeliverableRepair } from "../taskContinuationPolicy.js";
import { shouldSkipDeliverableContract } from "./n2BotFlags.js";

describe("n2_bot zero contract", () => {
  const pptGoal = "须交付：周会.pptx\n做一份周会 PPT";

  beforeEach(() => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
  });

  it("A2 missing kind still compiles PPT", () => {
    const manifest = compileSessionDeliverableManifest({ userGoal: pptGoal, turnId: "t-worker" });
    expect(manifest).not.toBeNull();
    expect((manifest?.slots.length ?? 0) > 0).toBe(true);
  });

  it("A3 n2_bot compiles null", () => {
    expect(shouldSkipDeliverableContract("n2_bot")).toBe(true);
    const manifest = compileSessionDeliverableManifest({
      userGoal: pptGoal,
      turnId: "t-steward",
      sessionKind: "n2_bot",
    });
    expect(manifest).toBeNull();
  });

  it("A4 worker repair true; steward always false", () => {
    expect(shouldTriggerDeliverableRepair({
      userGoal: pptGoal,
      sessionKind: "n2_bot",
    })).toBe(false);
    expect(shouldTriggerDeliverableRepair({
      userGoal: pptGoal,
      validationResult: {
        verified: [],
        missing: ["artifacts/task-x/周会.pptx"],
        broken: [],
        acceptance: "needs_repair",
      },
    })).toBe(true);
  });
});
