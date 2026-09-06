// PD-SAAS-FORK: shadow telemetry for binary intent gate (observe-only).

import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import {
  isBinaryIntentGateEnabled,
  isBinaryIntentGateShadowEnabled,
} from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import type { TurnInteractionModeRecord } from "./turnInteractionMode.js";
import { isTurnInteractionMode } from "./turnInteractionMode.js";

export function recordBinaryIntentShadowTelemetry(input: {
  sessionId: string;
  turnId: string;
  shadowRecord: TurnInteractionModeRecord;
  appliedMode?: TurnInteractionModeRecord["mode"];
}): void {
  if (!isBinaryIntentGateShadowEnabled()) return;
  recordStabilityEvent({
    event: "binary_intent_gate_shadow",
    sessionId: input.sessionId,
    turnId: input.turnId,
    reason: input.shadowRecord.reasonCode,
    detail: {
      shadowMode: input.shadowRecord.mode,
      appliedMode: input.appliedMode ?? "execute",
      gateEnabled: isBinaryIntentGateEnabled(),
    },
  });
}

export function recordBinaryIntentAppliedTelemetry(input: {
  sessionId: string;
  turnId: string;
  record: TurnInteractionModeRecord;
}): void {
  recordStabilityEvent({
    event: "binary_intent_gate_applied",
    sessionId: input.sessionId,
    turnId: input.turnId,
    reason: input.record.reasonCode,
    detail: {
      mode: input.record.mode,
    },
  });
}

export function resolveLatestTurnInteractionModeFromEntries(
  entries: AgentTranscriptEntry[],
): { turnId: string; record: TurnInteractionModeRecord } | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "turn_interaction_mode") continue;
    const record = entry.record;
    if (!record || !isTurnInteractionMode(record.mode)) continue;
    return { turnId: entry.turnId, record };
  }
  return null;
}

export function resolvePriorTurnInteractionContext(entries: AgentTranscriptEntry[]): {
  priorMode: TurnInteractionModeRecord["mode"] | null;
  priorClarifyFingerprint: string | null;
  consecutiveClarifyCount: number;
  sessionHasIncompleteExecute: boolean;
} {
  const latest = resolveLatestTurnInteractionModeFromEntries(entries);
  const completedTurnIds = new Set(
    entries.filter((entry) => entry.type === "turn_result").map((entry) => entry.turnId),
  );
  let consecutiveClarifyCount = 0;
  let priorClarifyFingerprint: string | null = null;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "turn_interaction_mode") continue;
    const mode = entry.record?.mode;
    if (mode === "clarify") {
      consecutiveClarifyCount += 1;
      priorClarifyFingerprint = entry.record?.clarification?.fingerprint ?? null;
      continue;
    }
    break;
  }

  const sessionHasIncompleteExecute = entries.some((entry) => {
    if (entry.type !== "turn_interaction_mode") return false;
    if (entry.record?.mode !== "execute") return false;
    return !completedTurnIds.has(entry.turnId);
  });

  return {
    priorMode: latest?.record.mode ?? null,
    priorClarifyFingerprint,
    consecutiveClarifyCount,
    sessionHasIncompleteExecute,
  };
}
