import { normalizeAnthropicStreamEvent } from "../providers/anthropic/stream.js";
import { createAnthropicStreamState, type AnthropicStreamState } from "../providers/anthropic/stream.js";
import {
  createOpenAIStreamState,
  normalizeOpenAIStreamEvent,
  type OpenAIStreamState,
} from "../providers/openai/stream.js";
import type { CanonicalModelEvent, ModelProtocol } from "../protocol/canonical.js";

export type StreamNormalizerState = {
  anthropic?: AnthropicStreamState;
  openai?: OpenAIStreamState;
};

// PD-SAAS-FORK (P1-C2): `opts.salvageDegenerateWrites` threads the degeneration flag into the
// provider stream-state factories so a truncated runaway-repetition file-write can be salvaged into a
// clean-prefix file instead of discarded. Default off => byte-for-byte unchanged in production.
export function createStreamNormalizerState(
  protocol: ModelProtocol,
  opts: { salvageDegenerateWrites?: boolean } = {},
): StreamNormalizerState {
  return protocol === "anthropic"
    ? { anthropic: createAnthropicStreamState(opts) }
    : { openai: createOpenAIStreamState(opts) };
}

export function normalizeStreamEvent(
  protocol: ModelProtocol,
  raw: unknown,
  state: StreamNormalizerState,
): CanonicalModelEvent[] {
  if (protocol === "anthropic") {
    state.anthropic ??= createAnthropicStreamState();
    return normalizeAnthropicStreamEvent(raw, state.anthropic);
  }

  state.openai ??= createOpenAIStreamState();
  return normalizeOpenAIStreamEvent(raw, state.openai);
}
