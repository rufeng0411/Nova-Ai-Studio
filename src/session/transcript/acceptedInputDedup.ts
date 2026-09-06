// PD-SAAS-FORK: skip Gateway duplicate accepted_input when Bridge queue pre-wrote transcript
import { readFile } from "node:fs/promises";
import type { CanonicalMessage } from "../../model/index.js";
import {
  fingerprintAcceptedInputMessages,
  type AcceptedInputAttachmentDescriptor,
} from "./acceptedInputIdentity.js";
import { readTranscriptTailEntries } from "./TranscriptReader.js";

export type AcceptedInputRef = {
  entryId: string;
  turnId: string;
  sequence: number;
  createdAt: string;
};

export async function findAcceptedInputRefInTranscript(
  transcriptPath: string,
  acceptedInputRef: AcceptedInputRef,
  expected: {
    sessionId: string;
    inputFingerprint: string;
  },
): Promise<AcceptedInputRef | null> {
  if (
    !transcriptPath?.trim()
    || !isAcceptedInputRef(acceptedInputRef)
    || !expected.sessionId?.trim()
    || !expected.inputFingerprint?.trim()
  ) {
    return null;
  }
  try {
    const tail = await readTranscriptTailEntries(transcriptPath, {
      maxBytesFromEnd: 64 * 1024,
      maxEntries: 16,
    });
    const tailMatch = tail.entries.find((entry) => (
      acceptedInputEntryMatches(entry, acceptedInputRef, expected)
    ));
    if (tailMatch) return acceptedInputRef;
  } catch {
    // Fall through to the conservative full-file check.
  }

  let content: string;
  try {
    content = await readFile(transcriptPath, "utf8");
  } catch {
    return null;
  }

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        turnId?: string;
        entryId?: string;
        sequence?: number;
        createdAt?: string;
        sessionId?: string;
        inputFingerprint?: string;
      };
      if (!acceptedInputEntryMatches(entry, acceptedInputRef, expected)) continue;
      return {
        entryId: acceptedInputRef.entryId,
        turnId: acceptedInputRef.turnId,
        sequence: acceptedInputRef.sequence,
        createdAt: acceptedInputRef.createdAt,
      };
    } catch {
      // ignore corrupt lines
    }
  }
  return null;
}

function acceptedInputEntryMatches(
  entry: {
    type?: string;
    turnId?: string;
    entryId?: string;
    sequence?: number;
    createdAt?: string;
    sessionId?: string;
    inputFingerprint?: string;
  },
  acceptedInputRef: AcceptedInputRef,
  expected: {
    sessionId: string;
    inputFingerprint: string;
  },
): boolean {
  return entry.type === "accepted_input"
    && entry.entryId === acceptedInputRef.entryId
    && entry.turnId === acceptedInputRef.turnId
    && entry.sequence === acceptedInputRef.sequence
    && entry.createdAt === acceptedInputRef.createdAt
    && normalizeAcceptedInputSessionId(entry.sessionId) === normalizeAcceptedInputSessionId(expected.sessionId)
    && entry.inputFingerprint === expected.inputFingerprint;
}

export function collapseLegacyAcceptedInputDuplicates<T extends {
  type?: string;
  sessionId?: string;
  turnId?: string;
  sequence?: number;
  createdAt?: string;
  synthetic?: boolean;
  inputFingerprint?: string;
  entryId?: string;
  logicalInputEntryId?: string;
  attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  messages?: unknown[];
}>(entries: T[]): T[] {
  const collapsed: T[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const bridgeEntry = entries[index];
    const gatewayEntry = entries[index + 1];
    if (bridgeEntry && gatewayEntry && isLegacyDuplicatePair(bridgeEntry, gatewayEntry)) {
      collapsed.push(gatewayEntry);
      index += 1;
    } else if (bridgeEntry) {
      collapsed.push(bridgeEntry);
    }
  }
  return collapsed;
}

function isLegacyDuplicatePair(entry: {
  type?: string;
  sessionId?: string;
  turnId?: string;
  sequence?: number;
  createdAt?: string;
  synthetic?: boolean;
  inputFingerprint?: string;
  entryId?: string;
  logicalInputEntryId?: string;
  attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  messages?: unknown[];
}, next: {
  type?: string;
  sessionId?: string;
  turnId?: string;
  sequence?: number;
  createdAt?: string;
  synthetic?: boolean;
  inputFingerprint?: string;
  entryId?: string;
  logicalInputEntryId?: string;
  attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  messages?: unknown[];
}): boolean {
  if (entry.type !== "accepted_input" || next.type !== "accepted_input") return false;
  if (!entry.sessionId || entry.sessionId !== next.sessionId) return false;
  if (!entry.entryId || next.logicalInputEntryId !== entry.entryId) return false;
  const bridgeFingerprint = resolveEntryFingerprint(entry);
  const gatewayFingerprint = resolveEntryFingerprint(next);
  return Boolean(
    bridgeFingerprint
    && gatewayFingerprint
    && bridgeFingerprint === gatewayFingerprint,
  );
}

function resolveEntryFingerprint(entry: {
  inputFingerprint?: string;
  attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  messages?: unknown[];
}): string | null {
  if (entry.inputFingerprint?.trim()) return entry.inputFingerprint;
  return fingerprintAcceptedInputMessages(
    (entry.messages ?? []) as CanonicalMessage[],
    entry.attachmentDescriptors,
  );
}

export async function shouldSkipGatewayAcceptedInputWrite(input: {
  transcriptPath: string;
  sessionId: string;
  turnId: string;
  acceptedInputRef?: AcceptedInputRef | null;
  inputFingerprint?: string | null;
}): Promise<boolean> {
  if (
    !isAcceptedInputRef(input.acceptedInputRef)
    || !input.sessionId?.trim()
    || !input.inputFingerprint?.trim()
  ) {
    return false;
  }
  const existing = await findAcceptedInputRefInTranscript(
    input.transcriptPath,
    input.acceptedInputRef,
    {
      sessionId: input.sessionId,
      inputFingerprint: input.inputFingerprint,
    },
  );
  return Boolean(existing?.entryId);
}

export function isAcceptedInputRef(value: unknown): value is AcceptedInputRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<AcceptedInputRef>;
  const keys = Object.keys(value).sort();
  return Boolean(
    keys.length === 4
    && keys[0] === "createdAt"
    && keys[1] === "entryId"
    && keys[2] === "sequence"
    && keys[3] === "turnId"
    && typeof candidate.entryId === "string"
    && candidate.entryId.length > 0
    && typeof candidate.turnId === "string"
    && candidate.turnId.length > 0
    && typeof candidate.sequence === "number"
    && Number.isSafeInteger(candidate.sequence)
    && candidate.sequence > 0
    && typeof candidate.createdAt === "string"
    && Number.isFinite(Date.parse(candidate.createdAt)),
  );
}

export function acceptedInputReplayMetadataMatches(
  message: CanonicalMessage,
  input: {
    sessionId: string;
    acceptedInputRef: AcceptedInputRef;
    inputFingerprint: string;
  },
): boolean {
  const replayed = message.metadata?.acceptedInput;
  return Boolean(
    replayed
    && replayed.unresolved === true
    && normalizeAcceptedInputSessionId(replayed.sessionId) === normalizeAcceptedInputSessionId(input.sessionId)
    && replayed.inputFingerprint === input.inputFingerprint
    && refsEqual(replayed.ref, input.acceptedInputRef),
  );
}

export function markAcceptedInputMessages(
  messages: readonly CanonicalMessage[],
  input: {
    sessionId: string;
    acceptedInputRef: AcceptedInputRef;
    inputFingerprint?: string;
    attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
    synthetic?: boolean;
    unresolved?: boolean;
    logicalInputEntryId?: string;
  },
): CanonicalMessage[] {
  return messages.map((message) => ({
    ...message,
    metadata: {
      ...message.metadata,
      acceptedInput: {
        ref: { ...input.acceptedInputRef },
        sessionId: input.sessionId,
        inputFingerprint: input.inputFingerprint,
        attachmentDescriptors: input.attachmentDescriptors?.map((descriptor) => ({ ...descriptor })),
        synthetic: input.synthetic,
        unresolved: input.unresolved,
        logicalInputEntryId: input.logicalInputEntryId,
      },
    },
  }));
}

export function replaceMatchingUnresolvedAcceptedInput(
  messages: readonly CanonicalMessage[],
  input: {
    sessionId: string;
    inputFingerprint?: string;
    acceptedInputRef?: AcceptedInputRef;
  },
): {
  messages: CanonicalMessage[];
  replacedAcceptedInputRef?: AcceptedInputRef;
} {
  const matchedMessage = messages.find((message) => {
    const replayed = message.metadata?.acceptedInput;
    if (
      !replayed?.unresolved
      || !isAcceptedInputRef(replayed.ref)
      || normalizeAcceptedInputSessionId(replayed.sessionId)
        !== normalizeAcceptedInputSessionId(input.sessionId)
    ) {
      return false;
    }
    if (input.acceptedInputRef) {
      return refsEqual(replayed.ref, input.acceptedInputRef)
        && (
          !input.inputFingerprint
          || !replayed.inputFingerprint
          || replayed.inputFingerprint === input.inputFingerprint
        );
    }
    return Boolean(
      input.inputFingerprint
      && replayed.inputFingerprint === input.inputFingerprint,
    );
  });
  const matched = matchedMessage?.metadata?.acceptedInput;
  if (!matched || !isAcceptedInputRef(matched.ref)) {
    return { messages: [...messages] };
  }
  return {
    messages: messages.filter((message) => {
      const replayed = message.metadata?.acceptedInput;
      return !replayed || !refsEqual(replayed.ref, matched.ref);
    }),
    replacedAcceptedInputRef: { ...matched.ref },
  };
}

function refsEqual(left: AcceptedInputRef, right: AcceptedInputRef): boolean {
  return left.entryId === right.entryId
    && left.turnId === right.turnId
    && left.sequence === right.sequence
    && left.createdAt === right.createdAt;
}

function normalizeAcceptedInputSessionId(value: string | undefined): string {
  return String(value ?? "").trim().replace(/web:s_/g, "web-s_");
}
