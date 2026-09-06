import { describe, expect, it } from "vitest";

import { reduceTaskExecutionState } from "./taskExecutionStateMachine.js";

describe("taskExecutionStateMachine", () => {
  it("routes acceptance failures to engine-owned repair", () => {
    expect(reduceTaskExecutionState({
      state: "validating",
      event: "acceptanceFailed",
      missingPaths: ["artifacts/demo/brief.docx"],
      brokenPaths: [],
    })).toEqual({
      state: "repairing",
      owner: "deliverable_repair",
      reason: "acceptance_failed",
    });
  });

  it("routes irreplaceable user input to blocked state without recovery owner", () => {
    expect(reduceTaskExecutionState({
      state: "executing",
      event: "needsUserInput",
      blockerReason: "missing_key",
    })).toEqual({
      state: "blocked_user_action",
      owner: "none",
      reason: "missing_key",
    });
  });

  it("keeps infrastructure interruption separate from recoverable budget", () => {
    expect(reduceTaskExecutionState({
      state: "executing",
      event: "infraInterrupted",
    })).toEqual({
      state: "infra_resume_pending",
      owner: "infra_interrupt",
      reason: "infra_interrupted",
    });
  });

  it("respects user abort as terminal and non-recoverable", () => {
    expect(reduceTaskExecutionState({
      state: "executing",
      event: "userAborted",
    })).toEqual({
      state: "aborted_by_user",
      owner: "none",
      reason: "user_aborted",
    });
  });
});
