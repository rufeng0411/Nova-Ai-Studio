/**
 * PD-SAAS-FORK: build turn-summary context from gateway transcript jsonl.
 */
import { resolve } from "node:path";
import { TOOL_RECOVERY_USER_MESSAGE_EN, TOOL_RECOVERY_USER_MESSAGE_ZH } from "../agent/loop/toolFailureRecovery.js";
import { getPilotProjectChatDir } from "../pilot/index.js";
import { readTranscript } from "../session/index.js";
import { sanitizeSessionIdForPath } from "../session/storage/ProjectSessionStorage.js";
import type { AgentTranscriptEntry } from "../session/transcript/TranscriptEntry.js";
import type { CanonicalMessage } from "../model/index.js";
import { isUserOptOutMemoryText, type TurnSummaryContext } from "./projectContinuity.js";
import {
  inspectTranscriptMessage,
  isCommandOnlyUserText,
  isSessionStartupMarkerText,
} from "edgeclaw-memory-core";

const DELIVERABLE_PATH_LIMIT = 10;
const TAIL_ENTRY_LIMIT = 120;

function isRecoveryUserText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith(TOOL_RECOVERY_USER_MESSAGE_EN)
    || trimmed.startsWith(TOOL_RECOVERY_USER_MESSAGE_ZH)
    || trimmed.includes("Failed tools:")
    || trimmed.includes("失败工具");
}

function shouldUseAsAnchorUser(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isRecoveryUserText(trimmed)) return false;
  if (isSessionStartupMarkerText(trimmed)) return false;
  if (isCommandOnlyUserText(trimmed)) return false;
  return true;
}

function messageText(message: CanonicalMessage | undefined): string {
  if (!message) return "";
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractDeliverablePaths(entries: AgentTranscriptEntry[]): string[] {
  const paths = new Set<string>();
  for (const entry of entries) {
    if (entry.type !== "tool_result_message") continue;
    const message = entry.message;
    for (const block of message.content) {
      if (block.type === "tool_result") {
        const raw = block.raw;
        if (raw && typeof raw === "object" && "data" in raw) {
          const data = (raw as { data?: unknown }).data;
          if (data && typeof data === "object") {
            const filePath = (data as { filePath?: unknown }).filePath;
            if (typeof filePath === "string" && filePath.trim()) {
              paths.add(filePath.trim());
            }
          }
        }
        for (const part of block.content) {
          if (part.type !== "text") continue;
          const created = part.text.match(/(?:Created|Overwrote|Updated|Wrote)\s+([^\s]+\.[A-Za-z0-9]+)/i);
          if (created?.[1]) paths.add(created[1]);
        }
      }
    }
  }
  return [...paths].slice(0, DELIVERABLE_PATH_LIMIT);
}

function collectTurnMessages(entries: AgentTranscriptEntry[]): CanonicalMessage[] {
  const messages: CanonicalMessage[] = [];
  let lastTurnResultIdx = -1;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i]?.type === "turn_result") {
      lastTurnResultIdx = i;
      break;
    }
  }
  const sliceStart = lastTurnResultIdx >= 0 ? lastTurnResultIdx + 1 : Math.max(0, entries.length - TAIL_ENTRY_LIMIT);
  const tail = entries.slice(sliceStart);
  for (const entry of tail) {
    if (entry.type === "accepted_input") {
      for (const message of entry.messages) messages.push(message);
    } else if (
      entry.type === "assistant_message"
      || entry.type === "durable_message"
      || entry.type === "tool_result_message"
    ) {
      messages.push(entry.message);
    }
  }
  return messages;
}

export async function buildTurnSummaryContextFromTranscript(input: {
  sessionKey: string;
  projectRoot: string;
  pilotHome: string;
}): Promise<TurnSummaryContext | undefined> {
  const transcriptPath = resolve(
    getPilotProjectChatDir(input.projectRoot, input.pilotHome),
    `${sanitizeSessionIdForPath(input.sessionKey)}.jsonl`,
  );
  const { entries } = await readTranscript(transcriptPath);
  if (entries.length === 0) return undefined;

  const turnMessages = collectTurnMessages(entries);
  let anchorUserText = "";
  for (const message of turnMessages) {
    if (message.role !== "user") continue;
    const text = messageText(message);
    if (shouldUseAsAnchorUser(text)) {
      anchorUserText = text;
      break;
    }
  }
  if (!anchorUserText) {
    for (let i = turnMessages.length - 1; i >= 0; i -= 1) {
      const message = turnMessages[i];
      if (message?.role !== "user") continue;
      const info = inspectTranscriptMessage(message);
      if (info.role === "user" && info.content && !isRecoveryUserText(info.content)) {
        anchorUserText = info.content;
        break;
      }
    }
  }

  let assistantDeliveryText = "";
  for (let i = turnMessages.length - 1; i >= 0; i -= 1) {
    const message = turnMessages[i];
    if (message?.role !== "assistant") continue;
    const text = messageText(message);
    if (!text) continue;
    const hasToolCall = message.content.some((block) => block.type === "tool_call");
    if (hasToolCall) continue;
    assistantDeliveryText = text;
    break;
  }

  const deliverablePaths = extractDeliverablePaths(entries.slice(-TAIL_ENTRY_LIMIT));
  const optOut = isUserOptOutMemoryText(anchorUserText);

  if (!anchorUserText && !assistantDeliveryText && deliverablePaths.length === 0) {
    return undefined;
  }

  return {
    anchorUserText,
    assistantDeliveryText,
    deliverablePaths,
    optOut,
  };
}
