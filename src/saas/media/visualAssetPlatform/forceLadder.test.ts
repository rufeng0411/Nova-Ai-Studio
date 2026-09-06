import { describe, expect, it, beforeEach } from "vitest";
import {
  noteVisualFetchFailure,
  resetForceLadderStateForTests,
  resolveVapOrchestratorBudgetMs,
  shouldForceVisualLadder,
} from "./forceLadder.js";

describe("forceLadder", () => {
  beforeEach(() => {
    resetForceLadderStateForTests();
    delete process.env.PILOTDECK_VAP_ORCHESTRATOR_BUDGET_MS;
    process.env.PILOTDECK_VAP_FORCE_LADDER = "1";
  });

  it("forces after two failures", () => {
    noteVisualFetchFailure("s1");
    expect(shouldForceVisualLadder("s1")).toBe(false);
    noteVisualFetchFailure("s1");
    expect(shouldForceVisualLadder("s1")).toBe(true);
  });

  it("uses 60s budget when goal has URL", () => {
    expect(
      resolveVapOrchestratorBudgetMs("见 https://www.bfgoodrich.com.cn/km3.html"),
    ).toBeGreaterThanOrEqual(60_000);
  });
});
