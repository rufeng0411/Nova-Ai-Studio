import type { CanonicalMessage, CanonicalToolCall, CanonicalUsage } from "../../model/index.js";
import type { AgentPermissionDenial } from "./result.js";

export type AgentLoopTransitionReason =
  | "next_turn"
  | "model_error"
  | "max_turns"
  | "aborted_streaming"
  | "aborted_tools"
  | "auto_compact"
  | "tool_recovery"
  | "auto_continue"
  | "soft_fetch_recovery"
  | "deliverable_validate_failed"
  | "acceptance_failed"
  | "large_file_partial_continue"
  | "invalid_tool_input_recovery"
  | "no_progress_read_nudge"
  | "no_progress_ledger_nudge"
  | "visual_media_placeholder_degrade"
  | "visual_media_tool_repeat_degrade";

export type AgentLoopTransition = {
  reason: AgentLoopTransitionReason;
};

export type AgentSessionState = {
  sessionId: string;
  messages: CanonicalMessage[];
  usage: CanonicalUsage;
  permissionDenials: AgentPermissionDenial[];
  status: "idle" | "running" | "aborted" | "failed";
  currentTurnId?: string;
  abortController: AbortController;
};

export type AgentLoopState = {
  sessionId: string;
  turnId: string;
  messages: CanonicalMessage[];
  turnCount: number;
  maxTurns?: number;
  pendingToolCalls: CanonicalToolCall[];
  lastAssistantMessage?: CanonicalMessage;
  usage: CanonicalUsage;
  transition?: AgentLoopTransition;
};
