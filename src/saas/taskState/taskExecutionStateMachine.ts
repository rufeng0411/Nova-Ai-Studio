import type { RecoveryOwner, RequiredBlockerReason } from "./taskLifecycle.js";

export type TaskExecutionState =
  | "executing"
  | "validating"
  | "repairing"
  | "infra_resume_pending"
  | "blocked_user_action"
  | "done"
  | "failed_unrecoverable"
  | "aborted_by_user";

export type TaskExecutionEvent =
  | "acceptancePassed"
  | "acceptanceFailed"
  | "needsUserInput"
  | "hardFailed"
  | "recoverableFailed"
  | "infraInterrupted"
  | "userAborted";

export type TaskExecutionInput = {
  state: TaskExecutionState;
  event: TaskExecutionEvent;
  missingPaths?: string[];
  brokenPaths?: string[];
  blockerReason?: RequiredBlockerReason | string;
};

export type TaskExecutionDecision = {
  state: TaskExecutionState;
  owner: RecoveryOwner;
  reason: string;
};

export function reduceTaskExecutionState(input: TaskExecutionInput): TaskExecutionDecision {
  switch (input.event) {
    case "acceptancePassed":
      return { state: "done", owner: "none", reason: "acceptance_passed" };
    case "acceptanceFailed":
      return {
        state: "repairing",
        owner: "deliverable_repair",
        reason: "acceptance_failed",
      };
    case "needsUserInput":
      return {
        state: "blocked_user_action",
        owner: "none",
        reason: input.blockerReason ?? "required_input",
      };
    case "hardFailed":
      return { state: "failed_unrecoverable", owner: "none", reason: "hard_failed" };
    case "recoverableFailed":
      return { state: "repairing", owner: "engine_auto_continue", reason: "recoverable_failed" };
    case "infraInterrupted":
      return {
        state: "infra_resume_pending",
        owner: "infra_interrupt",
        reason: "infra_interrupted",
      };
    case "userAborted":
      return { state: "aborted_by_user", owner: "none", reason: "user_aborted" };
    default: {
      const _exhaustive: never = input.event;
      return _exhaustive;
    }
  }
}
