import { describe, expect, it } from "vitest";
import {
  beginTurnTrace,
  clearCompletedTurnTraces,
  endTurnTrace,
  listCompletedTurnTraces,
  percentile,
  summarizeStageDurations,
} from "./turnTiming.js";

describe("turnTiming", () => {
  it("records stage durations and finalizes trace", () => {
    clearCompletedTurnTraces();
    const trace = beginTurnTrace({ runId: "run-1", sessionId: "sess-1" });
    trace.beginStage("turn.config_reload");
    trace.endStage("turn.config_reload");
    trace.beginStage("turn.model_ttfb");
    trace.endStage("turn.model_ttfb");
    trace.markFirstVisible("text");
    const snap = endTurnTrace("run-1");
    expect(snap?.runId).toBe("run-1");
    expect(snap?.stages.length).toBeGreaterThanOrEqual(3);
    expect(snap?.firstVisibleKind).toBe("text");
    expect(listCompletedTurnTraces()).toHaveLength(1);
  });

  it("summarizes p50/p95 per stage", () => {
    clearCompletedTurnTraces();
    for (let i = 0; i < 5; i += 1) {
      const runId = `run-${i}`;
      const trace = beginTurnTrace({ runId, sessionId: "sess" });
      trace.beginStage("turn.router_judge");
      trace.endStage("turn.router_judge");
      endTurnTrace(runId);
    }
    const summary = summarizeStageDurations(listCompletedTurnTraces());
    expect(summary["turn.router_judge"]?.count).toBe(5);
    expect(percentile([10, 20, 30], 50)).toBe(20);
  });
});
