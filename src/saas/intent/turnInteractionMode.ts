// PD-SAAS-FORK: per-turn dialogue / execute / clarify interaction mode (binary intent gate).

export const TURN_INTERACTION_MODE_VERSION = 1 as const;

export type TurnInteractionMode = "dialogue" | "execute" | "clarify";

export type TurnInteractionReasonCode =
  | "explicit_chat_negation"
  | "explicit_execute_action"
  | "explicit_template_or_capability"
  | "chat_first_no_deliverable"
  | "natural_discussion"
  | "continuation_execute"
  | "attachment_needs_read"
  | "ambiguous_continue"
  | "ambiguous_analyze"
  | "mixed_intent_clarify"
  | "mixed_intent_dialogue_first"
  | "mixed_intent_execute"
  | "side_effect_action"
  | "clarify_fuse_dialogue"
  | "fail_safe_execute"
  | "fail_safe_clarify"
  | "gate_disabled_execute";

export type IntentClarificationOption = {
  id: "dialogue" | "execute";
  label: string;
};

export type IntentClarificationPayload = {
  fingerprint: string;
  question: string;
  options: IntentClarificationOption[];
};

export type TurnInteractionModeRecord = {
  version: typeof TURN_INTERACTION_MODE_VERSION;
  mode: TurnInteractionMode;
  reasonCode: TurnInteractionReasonCode;
  source: "rule" | "fail_safe" | "clarify_fuse";
  clarification?: IntentClarificationPayload;
};

export function isTurnInteractionMode(
  mode: string | null | undefined,
): mode is TurnInteractionMode {
  return mode === "dialogue" || mode === "execute" || mode === "clarify";
}

export function shouldSuppressExecuteContinuation(mode: TurnInteractionMode | null | undefined): boolean {
  return mode === "dialogue" || mode === "clarify";
}
