import { describe, expect, it } from "vitest";
import { resolveTerminalCompleteFromTranscript } from "./sessionTerminalFromTranscript.js";

describe("resolveTerminalCompleteFromTranscript", () => {
  it("allows cold-resume when turn_acceptance_meta is passed (no invisible lock)", () => {
    const entries = [
      { type: "accepted_input", turnId: "t1", content: "goal" },
      { type: "turn_acceptance_meta", turnId: "t1", acceptanceStatus: "passed" },
    ] as never[];
    expect(resolveTerminalCompleteFromTranscript(entries, "t1")).toEqual({
      terminal: false,
      reason: null,
    });
  });

  it("blocks when circuit breaker tripped", () => {
    const entries = [
      { type: "accepted_input", turnId: "t1", content: "goal" },
      {
        type: "turn_acceptance_meta",
        turnId: "t1",
        acceptanceStatus: "needs_repair",
        circuitBreakerTripped: true,
      },
    ] as never[];
    expect(resolveTerminalCompleteFromTranscript(entries, "t1").reason).toBe("circuit");
  });

  it("allows user deliverable acknowledgment without blocking cold-resume", () => {
    const entries = [
      { type: "accepted_input", turnId: "t1", content: "写报告" },
      { type: "accepted_input", turnId: "t2", content: "已完成" },
    ] as never[];
    expect(resolveTerminalCompleteFromTranscript(entries, "t2").terminal).toBe(false);
  });

  it("allows needs_repair without ack", () => {
    const entries = [
      { type: "accepted_input", turnId: "t1", content: "写报告" },
      { type: "turn_acceptance_meta", turnId: "t1", acceptanceStatus: "needs_repair" },
    ] as never[];
    expect(resolveTerminalCompleteFromTranscript(entries, "t1").terminal).toBe(false);
  });
});
