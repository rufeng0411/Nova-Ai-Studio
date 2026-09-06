// PD-SAAS-FORK: durable queue completion receipt lookup for Bridge restart recovery.
import { readFile } from "node:fs/promises";
import type { AcceptedInputCompletionReceipt } from "../../agent/protocol/result.js";
import type { AgentTranscriptEntry } from "./TranscriptEntry.js";
import { readTranscriptTailEntries } from "./TranscriptReader.js";

export type AcceptedInputReceiptIdentity = {
  entryId?: string;
  queueItemId?: string;
};

export async function hasDurableAcceptedInputReceipt(
  transcriptPath: string,
  identity: AcceptedInputReceiptIdentity,
): Promise<boolean> {
  if (!transcriptPath.trim() || (!identity.entryId && !identity.queueItemId)) return false;
  try {
    const tail = await readTranscriptTailEntries(transcriptPath, {
      maxBytesFromEnd: 128 * 1024,
      maxEntries: 128,
    });
    if (tail.entries.some((entry) => transcriptEntryHasReceipt(entry, identity))) return true;
  } catch {
    // Fall through to a full-file check; restart recovery must be conservative.
  }
  try {
    const raw = await readFile(transcriptPath, "utf8");
    return raw.split("\n").some((line) => {
      if (!line.trim()) return false;
      try {
        return transcriptEntryHasReceipt(
          JSON.parse(line) as AgentTranscriptEntry,
          identity,
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function receiptMatchesIdentity(
  receipt: AcceptedInputCompletionReceipt | null | undefined,
  identity: AcceptedInputReceiptIdentity,
): boolean {
  if (!receipt || receipt.version !== 1) return false;
  return Boolean(
    (identity.entryId && receipt.entryId === identity.entryId)
    || (identity.queueItemId && receipt.queueItemId === identity.queueItemId),
  );
}

function transcriptEntryHasReceipt(
  entry: AgentTranscriptEntry,
  identity: AcceptedInputReceiptIdentity,
): boolean {
  return entry.type === "turn_result"
    && receiptMatchesIdentity(entry.result.acceptedInputReceipt, identity);
}
