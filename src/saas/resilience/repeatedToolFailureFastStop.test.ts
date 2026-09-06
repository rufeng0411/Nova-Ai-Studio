import { describe, expect, it } from "vitest";
import {
  advanceRepeatedToolFailureState,
  createRepeatedToolFailureState,
  REPEATED_TOOL_FAST_STOP_THRESHOLD,
  shouldFastStopRepeatedToolFailure,
} from "./repeatedToolFailureFastStop.js";

describe("repeatedToolFailureFastStop", () => {
  it("fast-stops render_html_video after threshold", () => {
    let state = createRepeatedToolFailureState();
    for (let i = 0; i < REPEATED_TOOL_FAST_STOP_THRESHOLD; i += 1) {
      state = advanceRepeatedToolFailureState(state, [{
        type: "error",
        toolName: "render_html_video",
        toolCallId: `call-${i}`,
        error: { message: "failed", code: "tool_execution_failed" },
      }]);
    }
    expect(shouldFastStopRepeatedToolFailure(state)).toBe(true);
  });

  it("resets on successful tool result", () => {
    let state = advanceRepeatedToolFailureState(createRepeatedToolFailureState(), [{
      type: "error",
      toolName: "render_html_video",
      toolCallId: "call-1",
      error: { message: "failed", code: "tool_execution_failed" },
    }]);
    state = advanceRepeatedToolFailureState(state, [{
      type: "success",
      toolName: "write_file",
      toolCallId: "call-2",
      result: "ok",
    }]);
    expect(state.consecutiveFailures).toBe(0);
  });
});
