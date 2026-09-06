// PD-SAAS-FORK (P0-D3): server-side terminal gate for cold-resume from transcript entries.
import type { AgentTranscriptEntry } from "../transcript/TranscriptEntry.js";

export type TranscriptTerminalReason = "passed" | "circuit" | "user_ack" | "certificate";

export type TranscriptTerminalDecision = {
  terminal: boolean;
  reason: TranscriptTerminalReason | null;
};

function findTurnAcceptanceMeta(
  entries: AgentTranscriptEntry[],
  turnId?: string,
): AgentTranscriptEntry | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.type !== "turn_acceptance_meta") continue;
    if (!turnId || entry.turnId === turnId) return entry;
  }
  return null;
}

/** Block cold-resume only for hard terminal signals (repair circuit). Sidebar/catalog pause is authoritative for user「完成」. */
export function resolveTerminalCompleteFromTranscript(
  entries: AgentTranscriptEntry[],
  incompleteTurnId?: string | null,
): TranscriptTerminalDecision {
  const meta = findTurnAcceptanceMeta(entries, incompleteTurnId ?? undefined) as {
    circuitBreakerTripped?: boolean;
  } | null;

  if (meta?.circuitBreakerTripped === true) {
    return { terminal: true, reason: "circuit" };
  }
  return { terminal: false, reason: null };
}
