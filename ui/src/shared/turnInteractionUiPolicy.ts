// PD-SAAS-FORK: per-turn UI policy for dialogue / execute / clarify modes.

import { resolveCurrentIntent } from '../../../src/saas/intent/resolveCurrentIntent.js';
import type { IntentClarificationPayload, TurnInteractionMode } from '../../../src/saas/intent/turnInteractionMode.js';
import { isTurnInteractionMode, shouldSuppressExecuteContinuation } from '../../../src/saas/intent/turnInteractionMode.js';

export type TurnInteractionModeEnvelope = {
  turnId?: string;
  mode: TurnInteractionMode;
  reasonCode?: string;
  clarification?: IntentClarificationPayload;
};

type MessagePayloadLike = {
  turnId?: string;
  turnInteractionMode?: TurnInteractionMode;
  turnInteractionModeRecord?: TurnInteractionModeEnvelope;
};

type MessageLike = {
  payload?: MessagePayloadLike;
  metadata?: MessagePayloadLike;
};

export function isBinaryIntentGateUiEnabled(): boolean {
  const raw = import.meta.env?.VITE_PILOTDECK_BINARY_INTENT_GATE;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return raw === '1' || raw === 'true' || raw === 'on';
}

export function readTurnInteractionModeFromMessage(
  message: MessageLike | null | undefined,
): TurnInteractionMode | undefined {
  const payload = message?.payload;
  const metadata = message?.metadata;
  const direct = payload?.turnInteractionMode ?? metadata?.turnInteractionMode;
  if (isTurnInteractionMode(direct)) return direct;
  const record = payload?.turnInteractionModeRecord ?? metadata?.turnInteractionModeRecord;
  if (isTurnInteractionMode(record?.mode)) return record.mode;
  return undefined;
}

export function resolveLatestTurnInteractionModeFromMessages(
  messages: MessageLike[],
): TurnInteractionMode | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const mode = readTurnInteractionModeFromMessage(message);
    if (mode) return mode;
  }
  return undefined;
}

function extractLatestUserText(messages: MessageLike[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      type?: string;
      role?: string;
      content?: string;
      metadata?: { synthetic?: boolean };
    };
    if (message?.metadata?.synthetic) continue;
    if (message?.type !== 'user' && message?.role !== 'user') continue;
    return typeof message.content === 'string' ? message.content.trim() : '';
  }
  return '';
}

function findLatestUserMessageIndex(messages: MessageLike[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      type?: string;
      role?: string;
      metadata?: { synthetic?: boolean };
    };
    if (message?.metadata?.synthetic) continue;
    if (message?.type === 'user' || message?.role === 'user') return index;
  }
  return -1;
}

/** Mode attached to the in-flight turn only (latest user bubble and everything after it). */
export function resolveTurnInteractionModeForCurrentTurn(
  messages: MessageLike[],
): TurnInteractionMode | undefined {
  const userIndex = findLatestUserMessageIndex(messages);
  if (userIndex < 0) {
    return resolveLatestTurnInteractionModeFromMessages(messages);
  }
  return resolveLatestTurnInteractionModeFromMessages(messages.slice(userIndex));
}

/** Prefer persisted mode on the current turn; while in-flight, mirror server intent on the latest user text. */
export function resolveEffectiveTurnInteractionMode(input: {
  messages: MessageLike[];
  isLoading?: boolean;
  capabilityContext?: {
    slug?: string;
    majorCategory?: string | null;
    isProcessTemplate?: boolean;
  };
}): TurnInteractionMode | undefined {
  const currentTurnMode = resolveTurnInteractionModeForCurrentTurn(input.messages);
  if (currentTurnMode) return currentTurnMode;

  if (!isBinaryIntentGateUiEnabled() || !input.isLoading) return undefined;

  const userText = extractLatestUserText(input.messages);
  if (!userText) return undefined;
  return resolveCurrentIntent({
    userText,
    capabilityContext: input.capabilityContext,
  }).mode;
}

export function shouldShowLiveProcessDock(input: {
  latestTurnInteractionMode?: TurnInteractionMode;
  isAssistantWorking: boolean;
}): boolean {
  // Always show the dock while working so dialogue/clarify still get instant ack.
  return input.isAssistantWorking;
}

/** Tool steps, phase rail, and SDM progress — hidden for pure-chat turns only. */
export function shouldShowLiveToolProcessInDock(
  latestTurnInteractionMode?: TurnInteractionMode,
): boolean {
  if (!isBinaryIntentGateUiEnabled()) return true;
  if (shouldSuppressExecuteContinuation(latestTurnInteractionMode)) {
    return false;
  }
  return true;
}

export function shouldSuppressSessionRepairUi(
  latestTurnInteractionMode?: TurnInteractionMode,
): boolean {
  if (!isBinaryIntentGateUiEnabled()) return false;
  return shouldSuppressExecuteContinuation(latestTurnInteractionMode);
}

export function shouldSuppressComposerDeliverablesStrip(
  latestTurnInteractionMode?: TurnInteractionMode,
  isAssistantWorking?: boolean,
): boolean {
  if (!isBinaryIntentGateUiEnabled()) return false;
  if (shouldSuppressExecuteContinuation(latestTurnInteractionMode) && !isAssistantWorking) {
    return true;
  }
  return false;
}

export function adjustAssistantWorkingForInteractionMode(input: {
  isAssistantWorking: boolean;
  latestTurnInteractionMode?: TurnInteractionMode;
  isLoading: boolean;
}): boolean {
  if (!isBinaryIntentGateUiEnabled()) {
    return input.isAssistantWorking;
  }
  if (input.isLoading) {
    return input.isAssistantWorking;
  }
  if (shouldSuppressExecuteContinuation(input.latestTurnInteractionMode)) {
    return false;
  }
  return input.isAssistantWorking;
}
