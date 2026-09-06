import type { CanonicalMessage, CanonicalUsage } from "../../model/index.js";
import type { AgentError } from "./errors.js";

export type AgentPermissionDenial = {
  toolName: string;
  toolCallId: string;
  errorCode?: string;
};

export type AgentStopReason =
  | "completed"
  | "max_turns"
  | "aborted_streaming"
  | "aborted_tools"
  | "model_error"
  | "prompt_too_long"
  | "tool_error"
  | "unsupported_recovery"
  | "wall_clock_exceeded";

/** PD-SAAS-FORK: stable proof used to acknowledge one durable queued input. */
export type AcceptedInputCompletionReceipt = {
  version: 1;
  entryId?: string;
  queueItemId?: string;
};

export type AgentTurnResult = {
  type: "success" | "error" | "aborted" | "max_turns";
  sessionId: string;
  turnId: string;
  finalMessage?: CanonicalMessage;
  stopReason: AgentStopReason;
  usage: CanonicalUsage;
  permissionDenials: AgentPermissionDenial[];
  turns: number;
  startedAt: string;
  completedAt: string;
  structuredOutput?: unknown;
  errors?: AgentError[];
  /** PD-SAAS-FORK: durable queue acknowledgment proof; present only on successful final completion. */
  acceptedInputReceipt?: AcceptedInputCompletionReceipt;
};
