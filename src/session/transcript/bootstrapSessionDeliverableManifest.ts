// PD-SAAS-FORK: bootstrap SDM on user message accept (before model turn).
import { readFile } from "node:fs/promises";
import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTranscriptWriter } from "../transcript/TranscriptWriter.js";
import {
  resolveLatestSessionManifestFromEntries,
  updateSessionManifestOnUserMessage,
  type SessionDeliverableManifest,
} from "../../saas/taskState/sessionDeliverableManifest.js";
import { isSessionDeliverableManifestEnabled } from "../../saas/resilience/stabilityFlags.js";
import type { AgentTranscriptEntry } from "../transcript/TranscriptEntry.js";
import type { CapabilityBindingContext } from "../../agent/protocol/input.js";
import {
  isCapabilityCompletionTaskResumeInput,
  preserveCapabilityCompletionModeForContinuation,
  type CapabilityCompletionMode,
} from "../../saas/intent/capabilityCompletionMode.js";
import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import {
  scanExpensiveIntentFuseFromMessages,
} from "../../saas/intent/expensiveIntentConflict.js";

export function textFromUserMessages(messages: CanonicalMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    if (message.metadata?.synthetic) continue;
    const parts = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (parts) return parts;
  }
  return "";
}

async function loadTranscriptEntries(transcriptPath: string): Promise<AgentTranscriptEntry[]> {
  if (!transcriptPath) return [];
  try {
    const raw = await readFile(transcriptPath, "utf8");
    const entries: AgentTranscriptEntry[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed) as AgentTranscriptEntry);
      } catch {
        // skip bad lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export async function bootstrapSessionDeliverableManifest(input: {
  sessionId: string;
  turnId: string;
  acceptedMessages: CanonicalMessage[];
  transcript: AgentTranscriptWriter;
  transcriptPath: string;
  capabilityContext?: CapabilityBindingContext;
  /** PD-SAAS-FORK: P0-1 exact capability completion mode. */
  capabilityCompletionMode?: CapabilityCompletionMode;
  /** PD-SAAS-FORK P0-2: strict joint barrier supplies one trusted read snapshot. */
  transcriptEntries?: AgentTranscriptEntry[];
  /** PD-SAAS-FORK: N2 Bot steward skip SDM. */
  sessionKind?: string | null;
}): Promise<{
  manifest?: SessionDeliverableManifest;
  previousManifest?: SessionDeliverableManifest;
  completionMode?: CapabilityCompletionMode;
  versionChanged: boolean;
}> {
  if (!isSessionDeliverableManifestEnabled()) return { versionChanged: false };
  if (typeof input.transcript.recordSessionDeliverableManifest !== "function") return { versionChanged: false };
  if (input.sessionKind === "n2_bot") return { versionChanged: false };

  const userText = textFromUserMessages(input.acceptedMessages);
  if (!userText) return { versionChanged: false };

  const entries = input.transcriptEntries
    ?? await loadTranscriptEntries(input.transcriptPath);
  const previousManifest = resolveLatestSessionManifestFromEntries(entries);
  const fuseMessages: Array<{ role?: string; metadata?: { expensiveIntentFingerprint?: string; expensiveIntentHandled?: boolean; synthetic?: boolean } }> = [];
  for (const entry of entries) {
    if (entry.type === "durable_message" || entry.type === "assistant_message") {
      fuseMessages.push(entry.message);
    }
    if (entry.type === "accepted_input") {
      fuseMessages.push(...entry.messages);
    }
  }
  fuseMessages.push(...input.acceptedMessages);
  const fuseState = scanExpensiveIntentFuseFromMessages(fuseMessages);
  const pendingFingerprint = fuseState.alreadyAskedFingerprint
    && !previousManifest?.expensiveIntentHandled
    && !fuseState.fuseAlreadyHandled
    ? fuseState.alreadyAskedFingerprint
    : null;
  const completionMode = preserveCapabilityCompletionModeForContinuation({
    currentMode: input.capabilityCompletionMode,
    currentSlug: input.capabilityContext?.slug,
    continuationOnly: isContinuationOnlyUserText(userText)
      || isCapabilityCompletionTaskResumeInput(userText),
    previousState: previousManifest,
  });
  if (completionMode === "consultation") {
    return { previousManifest, completionMode, versionChanged: false };
  }

  // PD-SAAS-FORK P0-2: a crash/restart can re-enter bootstrap for the same
  // accepted turn. Do not apply the same goal mutation twice.
  if (previousManifest?.compiledAtTurnId === input.turnId) {
    return {
      manifest: previousManifest,
      previousManifest,
      completionMode,
      versionChanged: false,
    };
  }

  const nextManifest = updateSessionManifestOnUserMessage({
    userText,
    previousManifest,
    capabilitySlug: input.capabilityContext?.slug,
    majorCategory: input.capabilityContext?.majorCategory,
    turnId: input.turnId,
    completionMode,
    pendingFingerprint,
    sessionKind: input.sessionKind,
  });

  if (!nextManifest) {
    return {
      manifest: previousManifest,
      previousManifest,
      completionMode,
      versionChanged: false,
    };
  }

  const versionChanged = !previousManifest
    || nextManifest.manifestVersion !== previousManifest.manifestVersion;
  if (versionChanged) {
    await input.transcript.recordSessionDeliverableManifest(
      input.sessionId,
      input.turnId,
      nextManifest,
    );
  }

  return {
    manifest: nextManifest,
    previousManifest,
    completionMode,
    versionChanged,
  };
}
