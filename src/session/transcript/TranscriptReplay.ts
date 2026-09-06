import { cloneMessage, cloneMessages, type CanonicalMessage, type CanonicalUsage } from "../../model/index.js";
import type { AgentEvent } from "../../agent/protocol/events.js";
import type { AgentPermissionDenial, AgentTurnResult } from "../../agent/protocol/result.js";
import type { AgentTranscriptDiagnostic, AgentTranscriptEntry, SessionMetadataValue } from "./TranscriptEntry.js";
import {
  isAcceptedInputRef,
  markAcceptedInputMessages,
} from "./acceptedInputDedup.js";
import {
  fingerprintAcceptedInputMessages,
  type AcceptedInputAttachmentDescriptor,
} from "./acceptedInputIdentity.js";

export type AgentTranscriptReplayResult = {
  messages: CanonicalMessage[];
  usage: CanonicalUsage;
  permissionDenials: AgentPermissionDenial[];
  events: AgentEvent[];
  metadata: SessionMetadataValue;
  diagnostics: AgentTranscriptDiagnostic[];
  /**
   * Index of the last compact_boundary entry consumed during replay. When
   * present, only messages after this entry are kept in `messages`.
   */
  lastCompactBoundaryIndex?: number;
  /** Last compact boundary entry encountered (for resume relink). */
  lastCompactBoundary?: AgentTranscriptEntry & { type: "control_boundary" };
};

/**
 * Find the index of the last compact boundary entry. Used by resume / replay
 * to slice messages after the boundary.
 */
export function findLastCompactBoundaryIndex(entries: AgentTranscriptEntry[]): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      entry.type === "control_boundary" &&
      entry.boundary.kind === "compact" &&
      "subtype" in entry.boundary &&
      entry.boundary.subtype === "compact_boundary"
    ) {
      return index;
    }
  }
  return -1;
}

export function replayTranscriptEntries(entries: AgentTranscriptEntry[]): AgentTranscriptReplayResult {
  const lastBoundaryIndex = findLastCompactBoundaryIndex(entries);
  const messages: CanonicalMessage[] = [];
  const events: AgentEvent[] = [];
  const diagnostics: AgentTranscriptDiagnostic[] = [];
  let metadata: SessionMetadataValue = {};
  let usage: CanonicalUsage = {};
  let permissionDenials: AgentPermissionDenial[] = [];
  let lastCompactBoundary: (AgentTranscriptEntry & { type: "control_boundary" }) | undefined;

  const completedTurnIds = new Set(
    entries.filter((entry) => entry.type === "turn_result").map((entry) => entry.turnId),
  );
  const unresolvedAcceptedEntryIds = resolveUnresolvedAcceptedInputEntryIds(entries);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    // Past compact boundary: usage / metadata still merge; messages produced
    // before the boundary are dropped (legacy getMessagesAfterCompactBoundary).
    const beforeBoundary = lastBoundaryIndex !== -1 && index < lastBoundaryIndex;

    switch (entry.type) {
      case "accepted_input":
        if (!beforeBoundary) {
          // PD-SAAS-FORK: retain prewrite identity so TurnRunner can replace only the exact replayed input.
          const ref = {
            entryId: entry.entryId,
            turnId: entry.turnId,
            sequence: entry.sequence,
            createdAt: entry.createdAt,
          };
          const sourceMessages = cloneMessages(entry.messages);
          const inputFingerprint = entry.inputFingerprint
            ?? fingerprintAcceptedInputMessages(sourceMessages, entry.attachmentDescriptors)
            ?? undefined;
          const replayBaseMessages = restoreAcceptedAttachmentReferences(
            sourceMessages,
            entry.attachmentDescriptors,
          );
          const replayedMessages = isAcceptedInputRef(ref)
            ? markAcceptedInputMessages(replayBaseMessages, {
                sessionId: entry.sessionId,
                acceptedInputRef: ref,
                inputFingerprint,
                attachmentDescriptors: entry.attachmentDescriptors,
                synthetic: entry.synthetic,
                unresolved: Boolean(
                  entry.entryId && unresolvedAcceptedEntryIds.has(entry.entryId),
                ),
                logicalInputEntryId: entry.logicalInputEntryId,
              })
            : replayBaseMessages;
          messages.push(...replayedMessages);
          events.push({
            type: "input_accepted",
            sessionId: entry.sessionId,
            turnId: entry.turnId,
            messages: cloneMessages(replayedMessages),
          });
        }
        break;
      case "assistant_message":
      case "tool_result_message":
      case "durable_message":
        if (!completedTurnIds.has(entry.turnId)) {
          diagnostics.push({
            code: "transcript_entry_invalid",
            severity: "warning",
            message: `Skipping durable message for incomplete turn ${entry.turnId}.`,
          });
          break;
        }
        if (beforeBoundary) {
          break;
        }
        messages.push(cloneMessage(entry.message));
        events.push(projectMessageEvent(entry.sessionId, entry.turnId, entry.message));
        break;
      case "turn_result":
        usage = mergeUsage(usage, entry.result.usage);
        permissionDenials = [...permissionDenials, ...entry.result.permissionDenials];
        if (!beforeBoundary) {
          events.push({
            type: "turn_completed",
            sessionId: entry.sessionId,
            turnId: entry.turnId,
            result: cloneTurnResult(entry.result),
          });
        }
        break;
      case "control_boundary":
        if (
          entry.boundary.kind === "compact" &&
          "subtype" in entry.boundary &&
          entry.boundary.subtype === "compact_boundary"
        ) {
          lastCompactBoundary = entry;
        }
        break;
      case "session_metadata":
        metadata = mergeMetadata(metadata, entry.metadata);
        break;
      case "subagent_started":
      case "subagent_completed":
      case "session_goal_quality_contract":
        // C3: lazy-load. The parent transcript replay does NOT expand
        // sidechain content. PD-SAAS-FORK P0-2 quality rows are restored by
        // their dedicated bootstrap resolver and never projected as messages.
        break;
    }
  }

  return {
    messages,
    usage,
    permissionDenials,
    events,
    metadata,
    diagnostics,
    lastCompactBoundaryIndex: lastBoundaryIndex === -1 ? undefined : lastBoundaryIndex,
    lastCompactBoundary,
  };
}

// PD-SAAS-FORK (P0-7): associate terminal results without resolving later queued inputs.
function resolveUnresolvedAcceptedInputEntryIds(
  entries: readonly AgentTranscriptEntry[],
): Set<string> {
  const pending: Array<{
    logicalEntryId: string;
    entryIds: Set<string>;
    queueItemIds: Set<string>;
  }> = [];

  for (const entry of entries) {
    if (entry.type === "accepted_input" && entry.entryId) {
      const logicalEntryId = entry.logicalInputEntryId ?? entry.entryId;
      const existing = pending.find((candidate) => (
        candidate.logicalEntryId === logicalEntryId
      ));
      if (existing) {
        existing.entryIds.add(entry.entryId);
        if (entry.queueItemId) existing.queueItemIds.add(entry.queueItemId);
      } else {
        pending.push({
          logicalEntryId,
          entryIds: new Set([entry.entryId]),
          queueItemIds: new Set(entry.queueItemId ? [entry.queueItemId] : []),
        });
      }
      continue;
    }

    if (entry.type !== "turn_result" || pending.length === 0) continue;
    const receipt = entry.result.acceptedInputReceipt;
    if (receipt?.version === 1 && (receipt.entryId || receipt.queueItemId)) {
      const exactEntryId = typeof receipt.entryId === "string" && receipt.entryId.length > 0
        ? receipt.entryId
        : undefined;
      const queueItemId = typeof receipt.queueItemId === "string" && receipt.queueItemId.length > 0
        ? receipt.queueItemId
        : undefined;
      let exactIndex = exactEntryId
        ? pending.findIndex((candidate) => (
            candidate.logicalEntryId === exactEntryId
            || candidate.entryIds.has(exactEntryId)
          ))
        : -1;
      if (exactIndex < 0 && queueItemId) {
        exactIndex = pending.findIndex((candidate) => (
          candidate.logicalEntryId === queueItemId
          || candidate.entryIds.has(queueItemId)
          || candidate.queueItemIds.has(queueItemId)
        ));
      }
      if (exactIndex >= 0) pending.splice(exactIndex, 1);
      continue;
    }

    // Legacy turn_result rows have no durable link. Consume accepted inputs FIFO
    // so a result for A cannot accidentally resolve later queued B/C inputs.
    pending.shift();
  }

  return new Set(pending.flatMap((candidate) => [...candidate.entryIds]));
}

function restoreAcceptedAttachmentReferences(
  sourceMessages: CanonicalMessage[],
  descriptors: AcceptedInputAttachmentDescriptor[] | undefined,
): CanonicalMessage[] {
  if (!descriptors?.length) return sourceMessages;
  const lines = descriptors.map((descriptor) => {
    const label = safeAttachmentReferenceField(
      descriptor.name ?? descriptor.path ?? descriptor.type,
    );
    const location = descriptor.path && descriptor.path !== label
      ? ` path=${safeAttachmentReferenceField(descriptor.path)}`
      : "";
    const mimeType = descriptor.mimeType
      ? ` mime=${safeAttachmentReferenceField(descriptor.mimeType)}`
      : "";
    const bytes = typeof descriptor.bytes === "number" ? ` bytes=${descriptor.bytes}` : "";
    return `- ${label}${location}${mimeType}${bytes}`;
  });
  const referenceBlock = {
    type: "text" as const,
    text: `\n<attachment-references>\n${lines.join("\n")}\n</attachment-references>`,
  };
  let restored = false;
  return sourceMessages.map((message) => {
    if (restored || message.role !== "user") return message;
    restored = true;
    return {
      ...message,
      content: [...message.content, referenceBlock],
    };
  });
}

function safeAttachmentReferenceField(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .slice(0, 1_024);
}

function projectMessageEvent(sessionId: string, turnId: string, message: CanonicalMessage): AgentEvent {
  if (message.role === "assistant") {
    return { type: "assistant_message", sessionId, turnId, message: cloneMessage(message) };
  }
  return { type: "tool_results_projected", sessionId, turnId, message: cloneMessage(message) };
}

function cloneTurnResult(result: AgentTurnResult): AgentTurnResult {
  return {
    ...result,
    usage: { ...result.usage },
    permissionDenials: result.permissionDenials.map((denial) => ({ ...denial })),
    errors: result.errors?.map((error) => ({ ...error })),
  };
}

function mergeUsage(first: CanonicalUsage, second: CanonicalUsage): CanonicalUsage {
  return {
    inputTokens: add(first.inputTokens, second.inputTokens),
    outputTokens: add(first.outputTokens, second.outputTokens),
    cacheReadTokens: add(first.cacheReadTokens, second.cacheReadTokens),
    cacheWriteTokens: add(first.cacheWriteTokens, second.cacheWriteTokens),
    totalTokens: add(first.totalTokens, second.totalTokens),
  };
}

function add(first: number | undefined, second: number | undefined): number | undefined {
  if (first === undefined && second === undefined) {
    return undefined;
  }
  return (first ?? 0) + (second ?? 0);
}

function mergeMetadata(first: SessionMetadataValue, second: SessionMetadataValue): SessionMetadataValue {
  return {
    ...first,
    ...second,
    title: second.title ?? first.title,
    aiTitle: second.aiTitle ?? first.aiTitle,
    linkedPullRequest: second.linkedPullRequest ?? first.linkedPullRequest,
  };
}
