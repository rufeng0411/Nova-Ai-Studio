import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldTriggerDeliverableRepair } from "../taskContinuationPolicy.js";
import {
  mapToolNameToStage,
  observeTaskStage,
  resetTaskStageBudgetClocksForTests,
} from "./taskStageBudget.js";

const recorded: Array<Record<string, unknown>> = [];

vi.mock("../../telemetry/stabilityEvents.js", () => ({
  recordStabilityEvent: (event: Record<string, unknown>) => {
    recorded.push(event);
  },
}));

describe("taskStageBudget", () => {
  beforeEach(() => {
    recorded.length = 0;
    resetTaskStageBudgetClocksForTests();
    process.env.PILOTDECK_TASK_STAGE_BUDGET = "shadow";
  });

  afterEach(() => {
    delete process.env.PILOTDECK_TASK_STAGE_BUDGET;
  });

  it("maps tool names onto stage ids", () => {
    expect(mapToolNameToStage("discover_visual_assets")).toBe("vap_discover");
    expect(mapToolNameToStage("web_search")).toBe("web_search");
    expect(mapToolNameToStage("write_file")).toBe("write_file");
    expect(mapToolNameToStage("generate_image")).toBe("generate_image");
    expect(mapToolNameToStage("generate_video")).toBe("generate_video");
    expect(mapToolNameToStage("read_file")).toBe("other_tool");
  });

  it("records overrun in shadow without throwing", () => {
    const result = observeTaskStage({
      sessionId: "s1",
      stage: "web_search",
      elapsedMs: 120_000,
      retryCount: 0,
      verifiedNet: 0,
    });
    expect(result.overrun).toBe(true);
    expect(result.intendedAction).toBe("skip_to_next_ladder");
    expect(recorded.some((event) => event.event === "task_stage_overrun")).toBe(true);
  });

  it("marks repair overrun after 180s with no verified net", () => {
    const result = observeTaskStage({
      sessionId: "s1",
      stage: "deliverable_repair",
      elapsedMs: 181_000,
      retryCount: 2,
      verifiedNet: 0,
    });
    expect(result.overrun).toBe(true);
    expect(result.intendedAction).toBe("reuse_repair_circuit");
  });

  it("marks retryHot after 3 retries without verified net", () => {
    const result = observeTaskStage({
      sessionId: "s1",
      stage: "write_file",
      elapsedMs: 1_000,
      retryCount: 3,
      verifiedNet: 0,
    });
    expect(result.retryHot).toBe(true);
    expect(recorded.some((event) => event.event === "task_stage_retry_hot")).toBe(true);
  });

  it("does not short-circuit shouldTriggerDeliverableRepair when overrun is true", () => {
    const observed = observeTaskStage({
      sessionId: "s1",
      stage: "deliverable_repair",
      elapsedMs: 200_000,
      retryCount: 4,
      verifiedNet: 0,
    });
    expect(observed.overrun).toBe(true);
    const repair = shouldTriggerDeliverableRepair({
      userGoal: "写一份 HTML 报告，须交付 report.html",
      assistantText: "还差 report.html",
      validationResult: {
        acceptance: "needs_repair",
        verified: [],
        missing: ["artifacts/task-x/report.html"],
        broken: [],
      },
    });
    expect(typeof repair).toBe("boolean");
    expect(observed.overrun).toBe(true);
  });

  it("stays silent when the flag is off", () => {
    process.env.PILOTDECK_TASK_STAGE_BUDGET = "off";
    const result = observeTaskStage({
      sessionId: "s1",
      stage: "web_search",
      elapsedMs: 999_000,
      retryCount: 9,
      verifiedNet: 0,
    });
    expect(result).toEqual({ overrun: false, retryHot: false, intendedAction: "none" });
    expect(recorded).toHaveLength(0);
  });
});
