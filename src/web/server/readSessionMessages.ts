/**
 * Read a session's transcript and project it onto Web `WebMessage[]`.
 *
 * The Web UI cannot consume `CanonicalMessage[]` directly because the
 * shape leaks `tool_call_block` / `tool_result_block` / `thinking_block`
 * details that need merging. This reader is the Phase 2 contract:
 *
 *   sessionKey
 *     -> readTranscript(.jsonl)
 *     -> replayTranscriptEntries(...)
 *     -> CanonicalMessage[]
 *     -> WebMessage[]
 *
 * Pagination is offset-based (`cursor` is a stringified integer). We do
 * NOT slice individual content blocks within a message — paging cuts at
 * `WebMessage` boundaries.
 */

import {
  flattenToolResultBlockText,
  type CanonicalContentBlock,
  type CanonicalImageBlock,
  type CanonicalMessage,
} from "../../model/index.js";
import { listProjectSessions, readTranscript, readTranscriptTailEntries, readTranscriptHeadEntries, mergeTranscriptEntries, countTranscriptLines, findLastCompactBoundaryIndex, DEFAULT_MAX_TRANSCRIPT_READ_BYTES, type SessionInfo } from "../../session/index.js";
import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import { collapseLegacyAcceptedInputDuplicates } from "../../session/transcript/acceptedInputDedup.js";
import { resolveLatestSessionManifestFromEntries } from "../../saas/taskState/sessionDeliverableManifest.js";
import { resolveLatestSessionTaskDirectoryFromEntries } from "../../saas/taskState/sessionTaskDirectory.js";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import { isAgentErrorRecoverable } from "../../agent/loop/toolFailureRecovery.js";
import {
  formatUserFacingNotice,
  isAgentRecoveryBoilerplate,
  isUserFacingRecoveryCopyLine,
  DEFAULT_ERROR_LABELS_ZH,
} from "../../agent/errors/userFacingErrors.js";
import { getPilotProjectChatDir } from "../../pilot/index.js";
import { sanitizeSessionIdForPath } from "../../session/storage/ProjectSessionStorage.js";
import { isHistoryTailReadEnabled } from "./historyReadFlags.js";
import type {
  WebReadSessionMessagesInput,
  WebReadSessionMessagesResult,
} from "../client/protocol.js";
import type { WebMessage, WebMessageKind, WebMessageRole } from "../client/webMessage.js";
import {
  buildDeliverableLedgerFromEntries,
  buildLedgerBackedTurnMetaMap,
  type LedgerBackedTurnMeta,
} from "../../saas/taskState/taskDeliverableLedger.js";

function shouldHideTranscriptMessage(message: CanonicalMessage): boolean {
  if (message.metadata?.synthetic === true) return true;
  const text = message.content
    .filter((block): block is Extract<CanonicalContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  // PD-SAAS-FORK (Goal Loop P2 H1): never surface task-resume infra XML in history API.
  if (/<task-resume\b/i.test(text)) return true;
  if (isUserFacingRecoveryCopyLine(text)) return true;
  return isAgentRecoveryBoilerplate(text);
}

export type ReadWebSessionMessagesOptions = {
  projectRoot: string;
  pilotHome: string;
  /** PD-SAAS-FORK: absolute transcript path from conversation_catalog. */
  transcriptAbsPath?: string;
  /** Override clock for deterministic tests. */
  now?: () => Date;
};

export async function readWebSessionMessages(
  input: WebReadSessionMessagesInput,
  options: ReadWebSessionMessagesOptions,
): Promise<WebReadSessionMessagesResult> {
  const effectiveProjectRoot = input.projectKey ?? options.projectRoot;
  const sessionInfo = await locateSession(input.sessionKey, {
    ...options,
    projectRoot: effectiveProjectRoot,
  });
  const transcriptPath = options.transcriptAbsPath
    ?? resolve(
      getPilotProjectChatDir(effectiveProjectRoot, options.pilotHome),
      `${sanitizeSessionIdForPath(input.sessionKey)}.jsonl`,
    );

  const useTailRead = isHistoryTailReadEnabled()
    && input.limit != null
    && (input.direction ?? "forward") === "backward";

  const resolvedSessionInfo = sessionInfo ?? null;

  if (useTailRead) {
    return readWebSessionMessagesTail(input, options, transcriptPath, resolvedSessionInfo);
  }

  const readResult = await readTranscript(transcriptPath);
  return projectTranscriptToWebResult(input, options, readResult.entries, {
    truncated: readResult.truncated,
    transcriptDiagnostics: readResult.diagnostics,
    sessionInfo: resolvedSessionInfo,
    transcriptPath,
    useEstimatedTotal: false,
  });
}

const TAIL_READ_OVERFETCH_FACTOR = 4;
const TAIL_READ_MAX_ENTRIES = 2000;
const DEFAULT_TAIL_BYTES = 4 * 1024 * 1024;

async function readWebSessionMessagesTail(
  input: WebReadSessionMessagesInput,
  options: ReadWebSessionMessagesOptions,
  transcriptPath: string,
  sessionInfo: SessionInfo | null,
): Promise<WebReadSessionMessagesResult> {
  const limit = input.limit ?? 120;
  const lineCount = await countTranscriptLines(transcriptPath);
  const endIndex = input.cursor === undefined ? undefined : parseCursor(input.cursor);
  const targetEnd = endIndex ?? Number.MAX_SAFE_INTEGER;

  // Older pages must see the full timeline — fall back to full read when the file fits.
  if (input.cursor !== undefined) {
    try {
      const fileStat = await stat(transcriptPath);
      if (fileStat.size <= DEFAULT_MAX_TRANSCRIPT_READ_BYTES) {
        const full = await readTranscript(transcriptPath);
        return projectTranscriptToWebResult(input, options, full.entries, {
          truncated: full.truncated,
          transcriptDiagnostics: full.diagnostics,
          sessionInfo,
          transcriptPath,
          useEstimatedTotal: false,
        });
      }
    } catch {
      // fall through to tail merge path
    }
  }

  let maxBytes = readTailBytesEnv();
  let maxEntries = Math.min(limit * TAIL_READ_OVERFETCH_FACTOR, TAIL_READ_MAX_ENTRIES);

  let tailResult = await readTranscriptTailEntries(transcriptPath, { maxBytesFromEnd: maxBytes, maxEntries });
  let entries = tailResult.entries;

  while (tailResult.truncated && maxBytes < tailResult.fileSize) {
    maxBytes = Math.min(maxBytes * 2, tailResult.fileSize);
    const expandedMaxEntries = maxBytes >= tailResult.fileSize
      ? Math.max(maxEntries, lineCount)
      : maxEntries;
    tailResult = await readTranscriptTailEntries(transcriptPath, {
      maxBytesFromEnd: maxBytes,
      maxEntries: expandedMaxEntries,
    });
    entries = tailResult.entries;
  }

  // Byte-truncated large transcripts: merge head so the first user turn survives tail-only reads.
  if (tailResult.truncated) {
    const head = await readTranscriptHeadEntries(transcriptPath, {
      maxBytesFromStart: Math.min(512 * 1024, tailResult.fileSize),
      maxEntries: Math.min(300, lineCount),
    });
    entries = mergeTranscriptEntries(head.entries, entries);
  }

  let projected = projectEntriesToWebMessages(input, options, entries);

  if (input.cursor !== undefined && projected.allMessages.length < targetEnd) {
    const full = await readTranscript(transcriptPath);
    return projectTranscriptToWebResult(input, options, full.entries, {
      truncated: full.truncated,
      transcriptDiagnostics: full.diagnostics,
      sessionInfo,
      transcriptPath,
      useEstimatedTotal: false,
    });
  }

  const entryCount = entries.length;
  const ratio = entryCount > 0 ? projected.allMessages.length / entryCount : 1;
  const estimatedTotal = Math.max(
    projected.allMessages.length,
    Math.round(lineCount * ratio),
  );

  const sliced = sliceWebMessages(projected.allMessages, {
    direction: "backward",
    cursor: input.cursor,
    limit,
  });

  let nextCursor = sliced.nextCursor;
  // PD-SAAS-FORK: B1 — truncated first page must not report hasMore=false when more lines exist.
  if (
    tailResult.truncated
    && input.cursor === undefined
    && !nextCursor
    && (lineCount > projected.allMessages.length || estimatedTotal > sliced.messages.length)
  ) {
    nextCursor = "0";
  }

  const total = tailResult.truncated && input.cursor === undefined
    ? Math.max(projected.allMessages.length, estimatedTotal)
    : projected.allMessages.length;

  return appendSessionDeliverableEnvelope({
    messages: sliced.messages,
    nextCursor,
    total,
    ...(projected.turnDeliverableMeta.size > 0
      ? { turnDeliverableMeta: Object.fromEntries(projected.turnDeliverableMeta) }
      : {}),
    ...(tailResult.truncated ? {
      transcriptWarning: tailResult.diagnostics.find((d) => d.code === "transcript_truncated")?.message
        ?? "Older messages were omitted because this conversation transcript is very large.",
    } : {}),
    session: buildSessionMeta(input, sessionInfo),
  }, projected);
}

function readTailBytesEnv(): number {
  const parsed = Number.parseInt(process.env.PILOTDECK_HISTORY_TAIL_BYTES ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TAIL_BYTES;
}

type ProjectedTranscript = {
  allMessages: WebMessage[];
  turnDeliverableMeta: Map<string, LedgerBackedTurnMeta>;
  turnAcceptanceMeta: Map<string, Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>>;
  sessionDeliverableManifest?: ReturnType<typeof resolveLatestSessionManifestFromEntries>;
  sessionTaskDirectory?: ReturnType<typeof resolveLatestSessionTaskDirectoryFromEntries>;
  latestTurnAcceptanceMeta?: Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>;
};

function boundedWireText(value: unknown, maxLength = 256): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function nonNegativeWireInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function normalizeQualityFailuresForWire(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined;
  const failures = value.slice(0, 40).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const row = candidate as Record<string, unknown>;
    const checkId = boundedWireText(row.checkId, 160);
    const reason = boundedWireText(row.reason, 240);
    const domain = row.domain;
    if (
      !checkId
      || !reason
      || typeof row.repairable !== "boolean"
      || (
        domain !== "content"
        && domain !== "official_media"
        && domain !== "tool_policy"
        && domain !== "composite"
      )
    ) {
      return [];
    }
    const expected = typeof row.expected === "number" || typeof row.expected === "string"
      ? row.expected
      : undefined;
    const actual = typeof row.actual === "number" || typeof row.actual === "string"
      ? row.actual
      : undefined;
    return [{
      checkId,
      domain,
      reason,
      repairable: row.repairable,
      ...(boundedWireText(row.path, 512) ? { path: boundedWireText(row.path, 512) } : {}),
      ...(boundedWireText(row.slotId, 120) ? { slotId: boundedWireText(row.slotId, 120) } : {}),
      ...(expected !== undefined
        ? { expected: typeof expected === "string" ? expected.slice(0, 240) : expected }
        : {}),
      ...(actual !== undefined
        ? { actual: typeof actual === "string" ? actual.slice(0, 240) : actual }
        : {}),
    }];
  });
  return failures.length > 0 ? failures : undefined;
}

function normalizeCountMapForWire(
  value: unknown,
  keys: readonly string[],
): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(keys.flatMap((key) => {
    const count = nonNegativeWireInteger(record[key]);
    return count === undefined ? [] : [[key, count]];
  }));
}

function normalizeAssetProvenanceSummaryForWire(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const totalEntries = nonNegativeWireInteger(record.totalEntries);
  const validEntries = nonNegativeWireInteger(record.validEntries);
  const officialEntries = nonNegativeWireInteger(record.officialEntries);
  const invalidEntries = nonNegativeWireInteger(record.invalidEntries);
  const placeholderCount = nonNegativeWireInteger(record.placeholderCount);
  if (
    totalEntries === undefined
    || validEntries === undefined
    || officialEntries === undefined
    || invalidEntries === undefined
    || placeholderCount === undefined
  ) {
    return undefined;
  }
  return {
    totalEntries,
    validEntries,
    officialEntries,
    invalidEntries,
    placeholderCount,
    sourceLevelCounts: normalizeCountMapForWire(
      record.sourceLevelCounts,
      ["L0", "L1", "L2", "L3"],
    ),
    sourceTierCounts: normalizeCountMapForWire(
      record.sourceTierCounts,
      [
        "brand_official",
        "authorized_partner_official",
        "platform_verified_official",
      ],
    ),
    ...(boundedWireText(record.ledgerEvidenceHash, 256)
      ? { ledgerEvidenceHash: boundedWireText(record.ledgerEvidenceHash, 256) }
      : {}),
  };
}

// PD-SAAS-FORK (0717 P0-2): normalize persisted v1/v2 acceptance certificates for history API wire.
function normalizeAcceptanceCertificateForWire(
  certificate: NonNullable<Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>["acceptanceCertificate"]>,
): Record<string, unknown> | undefined {
  const version = certificate.certificateVersion;
  if (version !== 1 && version !== 2) return undefined;
  if (typeof certificate.contractHash !== "string" || typeof certificate.evidenceHash !== "string") {
    return undefined;
  }
  return {
    certificateVersion: version,
    contractHash: certificate.contractHash,
    evidenceHash: certificate.evidenceHash,
    goalVersion: certificate.goalVersion,
    scopeDir: certificate.scopeDir,
    requiredDone: certificate.requiredDone,
    requiredTotal: certificate.requiredTotal,
    completionState: certificate.completionState,
    ...(certificate.acceptanceStatus ? { acceptanceStatus: certificate.acceptanceStatus } : {}),
    ...(certificate.contractHashVersion === 2 ? { contractHashVersion: 2 } : {}),
    ...(certificate.legacyContractHash ? { legacyContractHash: certificate.legacyContractHash } : {}),
    ...(certificate.legacyAcceptanceStatus
      ? { legacyAcceptanceStatus: certificate.legacyAcceptanceStatus }
      : {}),
    ...(certificate.strictAcceptanceStatus
      ? { strictAcceptanceStatus: certificate.strictAcceptanceStatus }
      : {}),
    ...(certificate.qualityContractHashVersion === 1 ? { qualityContractHashVersion: 1 } : {}),
    ...(boundedWireText(certificate.qualityContractHash, 256)
      ? { qualityContractHash: boundedWireText(certificate.qualityContractHash, 256) }
      : {}),
    ...(certificate.qualityEvidenceHashVersion === 1 ? { qualityEvidenceHashVersion: 1 } : {}),
    ...(boundedWireText(certificate.qualityEvidenceHash, 256)
      ? { qualityEvidenceHash: boundedWireText(certificate.qualityEvidenceHash, 256) }
      : {}),
    ...(certificate.qualityCompletion
      ? { qualityCompletion: certificate.qualityCompletion }
      : {}),
    ...(certificate.partialReason ? { partialReason: certificate.partialReason } : {}),
    ...(certificate.blockedReasonType
      ? { blockedReasonType: certificate.blockedReasonType }
      : {}),
    ...(normalizeQualityFailuresForWire(certificate.qualityFailures)
      ? { qualityFailures: normalizeQualityFailuresForWire(certificate.qualityFailures) }
      : {}),
    ...(normalizeAssetProvenanceSummaryForWire(certificate.assetProvenanceSummary)
      ? {
          assetProvenanceSummary:
            normalizeAssetProvenanceSummaryForWire(certificate.assetProvenanceSummary),
        }
      : {}),
    ...(certificate.units ? { units: certificate.units } : {}),
    ...(certificate.slots ? { slots: certificate.slots } : {}),
    ...(certificate.compositeSlotQuality
      ? { compositeSlotQuality: certificate.compositeSlotQuality }
      : {}),
  };
}

function buildTurnAcceptanceMetaPayload(
  acceptanceMeta: Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>,
): Record<string, unknown> {
  const normalizedCertificate = acceptanceMeta.acceptanceCertificate
    ? normalizeAcceptanceCertificateForWire(acceptanceMeta.acceptanceCertificate)
    : undefined;
  return {
    expectedManifest: acceptanceMeta.expectedManifest,
    verifiedPaths: acceptanceMeta.verifiedPaths,
    missingPaths: acceptanceMeta.missingPaths,
    brokenPaths: acceptanceMeta.brokenPaths,
    displayPaths: acceptanceMeta.displayPaths,
    hiddenByPolicyPaths: acceptanceMeta.hiddenByPolicyPaths,
    turnArtifactDir: acceptanceMeta.turnArtifactDir,
    taskArtifactDir: acceptanceMeta.taskArtifactDir,
    scopeId: acceptanceMeta.scopeId,
    resolvedPathMap: acceptanceMeta.resolvedPathMap,
    acceptanceStatus: acceptanceMeta.acceptanceStatus,
    ...(acceptanceMeta.finality ? { finality: acceptanceMeta.finality } : {}),
    ...(acceptanceMeta.qualityContractHashVersion === 1
      ? { qualityContractHashVersion: 1 }
      : {}),
    ...(boundedWireText(acceptanceMeta.qualityContractHash, 256)
      ? { qualityContractHash: boundedWireText(acceptanceMeta.qualityContractHash, 256) }
      : {}),
    ...(acceptanceMeta.qualityEvidenceHashVersion === 1
      ? { qualityEvidenceHashVersion: 1 }
      : {}),
    ...(boundedWireText(acceptanceMeta.qualityEvidenceHash, 256)
      ? { qualityEvidenceHash: boundedWireText(acceptanceMeta.qualityEvidenceHash, 256) }
      : {}),
    ...(acceptanceMeta.qualityCompletion
      ? { qualityCompletion: acceptanceMeta.qualityCompletion }
      : {}),
    ...(acceptanceMeta.completionState
      ? { completionState: acceptanceMeta.completionState }
      : {}),
    ...(acceptanceMeta.partialReason ? { partialReason: acceptanceMeta.partialReason } : {}),
    ...(acceptanceMeta.blockedReasonType
      ? { blockedReasonType: acceptanceMeta.blockedReasonType }
      : {}),
    ...(normalizeQualityFailuresForWire(acceptanceMeta.qualityFailures)
      ? { qualityFailures: normalizeQualityFailuresForWire(acceptanceMeta.qualityFailures) }
      : {}),
    ...(normalizeAssetProvenanceSummaryForWire(acceptanceMeta.assetProvenanceSummary)
      ? {
          assetProvenanceSummary:
            normalizeAssetProvenanceSummaryForWire(acceptanceMeta.assetProvenanceSummary),
        }
      : {}),
    ...(acceptanceMeta.continuationOwner
      ? { continuationOwner: acceptanceMeta.continuationOwner }
      : {}),
    ...(acceptanceMeta.sessionManifestVersion != null
      ? { sessionManifestVersion: acceptanceMeta.sessionManifestVersion }
      : {}),
    ...(acceptanceMeta.goalVersion != null ? { goalVersion: acceptanceMeta.goalVersion } : {}),
    ...(acceptanceMeta.sdmSnapshot ? { sdmSnapshot: acceptanceMeta.sdmSnapshot } : {}),
    ...(acceptanceMeta.currentStageId ? { currentStageId: acceptanceMeta.currentStageId } : {}),
    ...(acceptanceMeta.slotBindings ? { slotBindings: acceptanceMeta.slotBindings } : {}),
    ...(acceptanceMeta.contractSnapshot ? { contractSnapshot: acceptanceMeta.contractSnapshot } : {}),
    ...(acceptanceMeta.compositeSlotQuality
      ? { compositeSlotQuality: acceptanceMeta.compositeSlotQuality }
      : {}),
    ...(normalizedCertificate
      ? { acceptanceCertificate: normalizedCertificate }
      : {}),
    ...(acceptanceMeta.circuitBreakerTripped
      ? { circuitBreakerTripped: acceptanceMeta.circuitBreakerTripped }
      : {}),
  };
}

/** PD-SAAS-FORK P0-8: shared Bridge/Gateway whitelist for detached history metadata. */
export function sanitizeTurnAcceptanceMetaForHistoryWire(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return buildTurnAcceptanceMetaPayload(
    value as Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>,
  );
}

function resolveLatestTurnAcceptanceMetaFromEntries(
  entries: AgentTranscriptEntry[],
): Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }> | undefined {
  let latestTurnId: string | undefined;
  let latestForTurn: Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }> | undefined;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "turn_acceptance_meta") continue;
    latestTurnId ??= entry.turnId;
    if (entry.turnId !== latestTurnId) break;
    latestForTurn ??= entry;
    if (entry.finality === "final") return entry;
  }
  return latestForTurn;
}

function appendSessionDeliverableEnvelope(
  result: WebReadSessionMessagesResult,
  projected: ProjectedTranscript,
): WebReadSessionMessagesResult {
  const latestTurnAcceptanceMeta = projected.latestTurnAcceptanceMeta
    ? buildTurnAcceptanceMetaPayload(projected.latestTurnAcceptanceMeta)
    : undefined;
  return {
    ...result,
    ...(projected.sessionDeliverableManifest
      ? { sessionDeliverableManifest: projected.sessionDeliverableManifest }
      : {}),
    ...(projected.sessionTaskDirectory
      ? { sessionTaskDirectory: projected.sessionTaskDirectory }
      : {}),
    ...(latestTurnAcceptanceMeta ? { latestTurnAcceptanceMeta } : {}),
  };
}

function projectEntriesToWebMessages(
  input: WebReadSessionMessagesInput,
  options: ReadWebSessionMessagesOptions,
  entries: AgentTranscriptEntry[],
): ProjectedTranscript {
  const turnDeliverableMeta = extractTurnDeliverableMetaMap(entries);
  const turnAcceptanceMeta = extractTurnAcceptanceMetaMap(entries);
  // PD-SAAS-FORK (P0-7): projection-only fold for known Bridge turn-N + Gateway UUID double writes.
  const dedupedEntries = collapseLegacyAcceptedInputDuplicates(entries);
  const webReplay = extractWebVisibleMessages(dedupedEntries);
  const entryTimestamps = webReplay.timestamps;
  const incompleteTurnIds = extractIncompleteTurnIds(entries);

  // PD-SAAS-FORK: 过滤隐藏消息时同步过滤 timestamp/turnId，避免索引错位
  const visibleTuples = webReplay.messages.map((message, index) => ({
    message,
    entryTimestamp: entryTimestamps[index],
    turnId: webReplay.turnIds[index],
  })).filter(({ message }) => !shouldHideTranscriptMessage(message));

  const flattenedPerMessage: WebMessage[][] = visibleTuples.map(({ message, entryTimestamp, turnId }, index) => {
      const flattened = flattenCanonicalMessage(message, {
        index,
        sessionKey: input.sessionKey,
        projectKey: input.projectKey,
        now: options.now,
        entryTimestamp,
      });
      const meta = turnId ? turnDeliverableMeta.get(turnId) : undefined;
      const acceptanceMeta = turnId ? turnAcceptanceMeta.get(turnId) : undefined;
      if (meta || acceptanceMeta) {
        for (const webMessage of flattened) {
          const payload: Record<string, unknown> = webMessage.payload && typeof webMessage.payload === "object"
            ? { ...(webMessage.payload as Record<string, unknown>) }
            : {};
          payload.turnId = turnId;
          payload.turnArtifactDir = meta?.turnArtifactDir ?? acceptanceMeta?.turnArtifactDir;
          payload.verifiedDeliverablePaths = acceptanceMeta?.verifiedPaths ?? meta?.verifiedPaths;
          payload.turnDeliverableUnrecoverable = meta?.alignmentStatus === "unrecoverable";
          webMessage.payload = payload;
          if (acceptanceMeta) {
            Object.assign(payload, {
              missingPaths: acceptanceMeta.missingPaths,
              brokenPaths: acceptanceMeta.brokenPaths,
              displayPaths: acceptanceMeta.displayPaths,
              hiddenByPolicyPaths: acceptanceMeta.hiddenByPolicyPaths,
              expectedManifest: acceptanceMeta.expectedManifest,
              resolvedPathMap: acceptanceMeta.resolvedPathMap,
              acceptanceStatus: acceptanceMeta.acceptanceStatus,
              ...(acceptanceMeta.continuationOwner
                ? { continuationOwner: acceptanceMeta.continuationOwner }
                : {}),
              turnAcceptanceMeta: buildTurnAcceptanceMetaPayload(acceptanceMeta),
              ...(acceptanceMeta.contractSnapshot?.rowsHash
                ? { contractHash: acceptanceMeta.contractSnapshot.rowsHash }
                : {}),
              ...(acceptanceMeta.sessionManifestVersion != null
                ? { sessionManifestVersion: acceptanceMeta.sessionManifestVersion }
                : {}),
              ...(acceptanceMeta.goalVersion != null ? { goalVersion: acceptanceMeta.goalVersion } : {}),
            });
          }
        }
      }
      return flattened;
    });

  const cumulativeWebCounts: number[] = [];
  let cumulative = 0;
  for (const group of flattenedPerMessage) {
    cumulative += group.length;
    cumulativeWebCounts.push(cumulative);
  }

  const allMessages: WebMessage[] = flattenedPerMessage.flat();

  for (const boundary of [...webReplay.compactBoundaries].reverse()) {
    const insertPos =
      boundary.insertAfterMessageIndex >= 0
        ? (cumulativeWebCounts[boundary.insertAfterMessageIndex] ?? 0)
        : 0;
    const meta = boundary.metadata ?? {};
    const compactMsg: WebMessage = {
      id: `${input.sessionKey}-compact-${boundary.timestamp}`,
      sessionKey: input.sessionKey,
      projectKey: input.projectKey,
      createdAt: boundary.timestamp,
      provider: "pilotdeck",
      role: "system",
      kind: "compact_boundary",
      text: "Context compacted",
      payload: meta,
      source: "history",
    };
    allMessages.splice(insertPos, 0, compactMsg);
  }

  injectErrorTurnMessages(entries, allMessages, input.sessionKey, input.projectKey);
  injectEmptyAssistantHistoryPlaceholders(entries, allMessages, input.sessionKey, input.projectKey);
  if (incompleteTurnIds.length > 0) {
    allMessages.push(createIncompleteTurnStatusMessage(input, incompleteTurnIds, options));
  }

  const sessionDeliverableManifest = resolveLatestSessionManifestFromEntries(entries);
  const sessionTaskDirectory = resolveLatestSessionTaskDirectoryFromEntries(entries);
  const latestTurnAcceptanceMeta = resolveLatestTurnAcceptanceMetaFromEntries(entries);
  if (sessionDeliverableManifest || sessionTaskDirectory) {
    for (const webMessage of allMessages) {
      const payload: Record<string, unknown> = webMessage.payload && typeof webMessage.payload === "object"
        ? { ...(webMessage.payload as Record<string, unknown>) }
        : {};
      if (sessionDeliverableManifest) {
        payload.sessionDeliverableManifest = sessionDeliverableManifest;
      }
      if (sessionTaskDirectory) {
        payload.sessionTaskDirectory = sessionTaskDirectory;
      }
      webMessage.payload = payload;
    }
  }

  return {
    allMessages,
    turnDeliverableMeta,
    turnAcceptanceMeta,
    ...(sessionDeliverableManifest ? { sessionDeliverableManifest } : {}),
    ...(sessionTaskDirectory ? { sessionTaskDirectory } : {}),
    ...(latestTurnAcceptanceMeta ? { latestTurnAcceptanceMeta } : {}),
  };
}

function projectTranscriptToWebResult(
  input: WebReadSessionMessagesInput,
  options: ReadWebSessionMessagesOptions,
  entries: AgentTranscriptEntry[],
  ctx: {
    truncated?: boolean;
    transcriptDiagnostics: import("../../session/transcript/TranscriptEntry.js").AgentTranscriptDiagnostic[];
    sessionInfo: SessionInfo | null;
    transcriptPath: string;
    useEstimatedTotal: boolean;
  },
): WebReadSessionMessagesResult {
  const projected = projectEntriesToWebMessages(input, options, entries);
  const sliced = sliceWebMessages(projected.allMessages, {
    direction: input.direction,
    cursor: input.cursor,
    limit: input.limit !== undefined ? input.limit : undefined,
  });

  return appendSessionDeliverableEnvelope({
    messages: sliced.messages,
    nextCursor: sliced.nextCursor,
    total: sliced.total,
    ...(projected.turnDeliverableMeta.size > 0
      ? { turnDeliverableMeta: Object.fromEntries(projected.turnDeliverableMeta) }
      : {}),
    ...(ctx.truncated ? {
      transcriptWarning: ctx.transcriptDiagnostics.find((d) => d.code === "transcript_truncated")?.message
        ?? "Older messages were omitted because this conversation transcript is very large.",
    } : {}),
    session: buildSessionMeta(input, ctx.sessionInfo),
  }, projected);
}

function buildSessionMeta(
  input: WebReadSessionMessagesInput,
  sessionInfo: SessionInfo | null,
): WebReadSessionMessagesResult["session"] {
  return {
    sessionId: sessionInfo?.sessionId ?? input.sessionKey,
    sessionKey: input.sessionKey,
    summary: sessionInfo?.summary ?? input.sessionKey,
    lastModified: sessionInfo?.lastModified ?? 0,
    fileSize: sessionInfo?.fileSize,
    customTitle: sessionInfo?.customTitle,
    aiTitle: sessionInfo?.aiTitle,
    firstPrompt: sessionInfo?.firstPrompt,
    cwd: sessionInfo?.cwd,
    tag: sessionInfo?.tag,
    createdAt: sessionInfo?.createdAt,
  };
}

function createIncompleteTurnStatusMessage(
  input: WebReadSessionMessagesInput,
  turnIds: string[],
  options: ReadWebSessionMessagesOptions,
): WebMessage {
  const stamp = (options.now ?? (() => new Date()))().toISOString();
  return {
    id: `${input.sessionKey}-incomplete-turn-status-${turnIds.join("-")}`,
    sessionKey: input.sessionKey,
    projectKey: input.projectKey,
    createdAt: stamp,
    provider: "pilotdeck",
    role: "system",
    kind: "status",
    text: "上次运行未正常结束或已中断，已恢复当时产生的工具调用和输出。",
    payload: { incompleteTurnIds: turnIds },
    source: "history",
  };
}

function extractIncompleteTurnIds(entries: AgentTranscriptEntry[]): string[] {
  const completedTurnIds = new Set(
    entries.filter((entry) => entry.type === "turn_result").map((entry) => entry.turnId),
  );
  const incompleteTurnIds = new Set<string>();
  for (const entry of entries) {
    if (
      (entry.type === "assistant_message" ||
        entry.type === "tool_result_message" ||
        entry.type === "durable_message") &&
      !completedTurnIds.has(entry.turnId)
    ) {
      incompleteTurnIds.add(entry.turnId);
    }
  }
  return [...incompleteTurnIds];
}

async function locateSession(
  sessionKey: string,
  options: ReadWebSessionMessagesOptions,
): Promise<SessionInfo | undefined> {
  const chatDir = getPilotProjectChatDir(options.projectRoot, options.pilotHome);
  const safeKey = sanitizeSessionIdForPath(sessionKey);
  const transcriptPath = resolve(chatDir, `${safeKey}.jsonl`);
  try {
    const fileStat = await stat(transcriptPath);
    return {
      sessionId: safeKey,
      summary: sessionKey,
      lastModified: fileStat.mtimeMs,
      fileSize: fileStat.size,
    };
  } catch {
    // Fall back to directory scan when the direct path is missing.
  }

  const sessions = await listProjectSessions({
    projectRoot: options.projectRoot,
    pilotHome: options.pilotHome,
  });
  return sessions.find(
    (session) => session.sessionId === sessionKey || session.sessionId === safeKey,
  );
}

function parseCursor(cursor?: string): number {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export type SliceWebMessagesInput = {
  direction?: "forward" | "backward";
  cursor?: string;
  limit?: number;
};

export type SliceWebMessagesResult = {
  messages: WebMessage[];
  nextCursor?: string;
  startIndex: number;
  total: number;
};

/**
 * Pure pagination over projected WebMessage[].
 * Backward pages load older history; forward preserves legacy offset paging.
 * PD-SAAS-FORK: tail paging for long-session UI.
 */
export function sliceWebMessages(
  allMessages: WebMessage[],
  input: SliceWebMessagesInput,
): SliceWebMessagesResult {
  const total = allMessages.length;
  if (input.limit === undefined) {
    return { messages: allMessages, total, startIndex: 0 };
  }

  const limit = input.limit;
  const direction = input.direction ?? "forward";

  if (direction === "backward") {
    const endIndex = input.cursor === undefined ? total : parseCursor(input.cursor);
    const startIndex = Math.max(0, endIndex - limit);
    const messages = allMessages.slice(startIndex, endIndex);
    const nextCursor = startIndex > 0 ? String(startIndex) : undefined;
    return { messages, nextCursor, startIndex, total };
  }

  const offset = parseCursor(input.cursor);
  const sliceEnd = limit === 0 ? total : offset + limit;
  const messages = allMessages.slice(offset, sliceEnd);
  const nextCursor = offset + messages.length < total ? String(offset + messages.length) : undefined;
  return { messages, nextCursor, startIndex: offset, total };
}

type ProjectionContext = {
  index: number;
  sessionKey: string;
  projectKey?: string;
  now?: () => Date;
  /** Actual transcript entry timestamp — preferred over now(). */
  entryTimestamp?: string;
};

/**
 * Flatten a CanonicalMessage's content blocks into one or more WebMessages.
 * Adjacent text blocks within the same canonical message merge.
 *
 * Tool-result images get special handling: when an `image` block immediately
 * follows a `tool_result` block (as produced by `projectToolResults`), the
 * image is attached to that tool_result WebMessage instead of being emitted as
 * a separate user-role text message. Without this, read_file image responses
 * would render as a "user" bubble on the right side of the chat — see
 * https://github.com/ — the canonical wire format requires role=user, but the
 * UI semantics want the picture rendered alongside the tool result on the
 * assistant/tool side.
 */
export function flattenCanonicalMessage(
  message: CanonicalMessage,
  context: ProjectionContext,
): WebMessage[] {
  const stamp = context.entryTimestamp ?? (context.now ?? (() => new Date()))().toISOString();
  const out: WebMessage[] = [];
  const role: WebMessageRole = message.role === "user" ? "user" : "assistant";
  let textBuffer = "";
  let pendingImages: NonNullable<WebMessage["images"]> = [];
  let lastToolResultMessage: WebMessage | undefined;

  const flushText = (): void => {
    if (!textBuffer && pendingImages.length === 0) return;
    out.push({
      id: `${context.sessionKey}-msg-${context.index}-${out.length}`,
      sessionKey: context.sessionKey,
      projectKey: context.projectKey,
      createdAt: stamp,
      provider: "pilotdeck",
      role,
      kind: "text",
      text: textBuffer,
      ...(pendingImages.length > 0 ? { images: pendingImages } : {}),
      source: "history",
    });
    textBuffer = "";
    pendingImages = [];
  };

  for (const block of message.content) {
    if (block.type !== "image" && block.type !== "tool_result") {
      // Any other block breaks the tool_result → image association.
      lastToolResultMessage = undefined;
    }
    if (block.type === "image" && lastToolResultMessage && role === "user") {
      const existing = lastToolResultMessage.images ?? [];
      lastToolResultMessage.images = [...existing, toWebMessageImage(block)];
      continue;
    }
    flushBlock(block, out, context, stamp, role, () => {
      flushText();
    }, (chunk) => {
      textBuffer += chunk;
    }, (image) => {
      pendingImages.push(toWebMessageImage(image));
    });
    if (block.type === "tool_result") {
      lastToolResultMessage = out[out.length - 1];
    }
  }
  flushText();
  return out;
}

function flushBlock(
  block: CanonicalContentBlock,
  out: WebMessage[],
  context: ProjectionContext,
  stamp: string,
  role: WebMessageRole,
  flushText: () => void,
  appendText: (chunk: string) => void,
  appendImage: (image: CanonicalImageBlock) => void,
): void {
  switch (block.type) {
    case "text":
      appendText(block.text);
      return;
    case "thinking":
      flushText();
      out.push({
        id: `${context.sessionKey}-thinking-${context.index}-${out.length}`,
        sessionKey: context.sessionKey,
        projectKey: context.projectKey,
        createdAt: stamp,
        provider: "pilotdeck",
        role: "assistant",
        kind: "thinking",
        text: block.text,
        source: "history",
      });
      return;
    case "tool_call":
      flushText();
      out.push({
        id: `${context.sessionKey}-tool-${block.id}`,
        sessionKey: context.sessionKey,
        projectKey: context.projectKey,
        createdAt: stamp,
        provider: "pilotdeck",
        role: "tool",
        kind: "tool_use",
        toolCallId: block.id,
        toolName: block.name,
        payload: block.input,
        source: "history",
      });
      return;
    case "tool_result": {
      flushText();
      const resultText = flattenToolResultBlockText(block);
      const errorCode = readToolResultErrorCode(block.raw);
      const planData = readPlanData(block.raw);
      const resultImages: NonNullable<WebMessage["images"]> = [];
      for (const sub of block.content) {
        if (sub.type === "image") {
          resultImages.push(toWebMessageImage(sub));
        }
      }
      out.push({
        id: `${context.sessionKey}-tool-${block.toolCallId}-result`,
        sessionKey: context.sessionKey,
        projectKey: context.projectKey,
        createdAt: stamp,
        provider: "pilotdeck",
        role: "tool",
        kind: "tool_result",
        toolCallId: block.toolCallId,
        ok: !block.isError,
        text: resultText,
        ...(errorCode ? { errorCode } : {}),
        ...(planData ? { payload: planData } : {}),
        ...(resultImages.length > 0 ? { images: resultImages } : {}),
        source: "history",
      });
      return;
    }
    case "tool_result_reference":
      flushText();
      out.push({
        id: `${context.sessionKey}-tool-${block.toolCallId}-result-ref`,
        sessionKey: context.sessionKey,
        projectKey: context.projectKey,
        createdAt: stamp,
        provider: "pilotdeck",
        role: "tool",
        kind: "tool_result",
        toolCallId: block.toolCallId,
        ok: true,
        text: block.preview,
        payload: {
          path: block.path,
          originalBytes: block.originalBytes,
          hasMore: block.hasMore,
          mimeType: block.mimeType,
          reason: block.reason,
        },
        source: "history",
      });
      return;
    case "image":
      if (role === "user") {
        appendImage(block);
        return;
      }
      flushText();
      out.push({
        id: `${context.sessionKey}-attachment-${context.index}-${out.length}`,
        sessionKey: context.sessionKey,
        projectKey: context.projectKey,
        createdAt: stamp,
        provider: "pilotdeck",
        role,
        kind: "status",
        text: `[${block.type} attachment]`,
        payload: { mimeType: block.mimeType, bytes: "bytes" in block ? block.bytes : undefined },
        source: "history",
      });
      return;
    case "pdf":
    case "audio":
      flushText();
      const kind: WebMessageKind = "status";
      out.push({
        id: `${context.sessionKey}-attachment-${context.index}-${out.length}`,
        sessionKey: context.sessionKey,
        projectKey: context.projectKey,
        createdAt: stamp,
        provider: "pilotdeck",
        role,
        kind,
        text: `[${block.type} attachment]`,
        payload: { mimeType: block.mimeType, bytes: "bytes" in block ? block.bytes : undefined },
        source: "history",
      });
      return;
  }
}

function toWebMessageImage(block: CanonicalImageBlock): NonNullable<WebMessage["images"]>[number] {
  return {
    data: block.source === "url" ? block.data : `data:${block.mimeType};base64,${block.data}`,
    mimeType: block.mimeType,
  };
}

/**
 * Web history is allowed to show persisted messages from incomplete turns so
 * users do not lose tool calls they already saw live. Keep this projection
 * local to the web reader: the core transcript replay still skips incomplete
 * durable messages so agent resume never feeds half-finished tool histories
 * back to the model.
 */
type CompactBoundaryInfo = {
  insertAfterMessageIndex: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

function extractTurnDeliverableMetaMap(
  entries: AgentTranscriptEntry[],
): Map<string, LedgerBackedTurnMeta> {
  const legacyMeta = entries
    .filter((entry): entry is Extract<AgentTranscriptEntry, { type: "turn_deliverable_meta" }> => entry.type === "turn_deliverable_meta");
  return buildLedgerBackedTurnMetaMap(
    buildDeliverableLedgerFromEntries(entries),
    legacyMeta,
  );
}

function extractTurnAcceptanceMetaMap(
  entries: AgentTranscriptEntry[],
): Map<string, Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>> {
  const map = new Map<string, Extract<AgentTranscriptEntry, { type: "turn_acceptance_meta" }>>();
  for (const entry of entries) {
    if (entry.type !== "turn_acceptance_meta" || !entry.turnId) continue;
    if (map.get(entry.turnId)?.finality === "final" && entry.finality !== "final") {
      continue;
    }
    map.set(entry.turnId, entry);
  }
  return map;
}

function extractWebVisibleMessages(entries: AgentTranscriptEntry[]): {
  messages: CanonicalMessage[];
  timestamps: string[];
  turnIds: string[];
  compactBoundaries: CompactBoundaryInfo[];
} {
  const lastBoundaryIndex = findLastCompactBoundaryIndex(entries);
  const messages: CanonicalMessage[] = [];
  const timestamps: string[] = [];
  const turnIds: string[] = [];
  const compactBoundaries: CompactBoundaryInfo[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const beforeBoundary = lastBoundaryIndex !== -1 && index < lastBoundaryIndex;

    switch (entry.type) {
      case "accepted_input":
        if (!beforeBoundary) {
          for (const message of entry.messages) {
            messages.push(cloneMessage(message));
            timestamps.push(entry.createdAt);
            turnIds.push(entry.turnId);
          }
        }
        break;
      case "assistant_message":
      case "tool_result_message":
      case "durable_message":
        if (!beforeBoundary) {
          messages.push(cloneMessage(entry.message));
          timestamps.push(entry.createdAt);
          turnIds.push(entry.turnId);
        }
        break;
      case "control_boundary": {
        if (!beforeBoundary && entry.boundary && entry.boundary.kind === "compact") {
          const meta: Record<string, unknown> = {};
          if (entry.boundary.subtype === "compact_boundary" && "compactMetadata" in entry.boundary) {
            const cm = entry.boundary.compactMetadata as Record<string, unknown>;
            meta.trigger = cm.trigger;
            meta.preTokens = cm.preTokens;
            meta.level = cm.level;
            meta.stage = cm.stage;
            meta.stageLabel = cm.stageLabel;
          }
          compactBoundaries.push({
            insertAfterMessageIndex: messages.length - 1,
            timestamp: entry.createdAt,
            metadata: meta,
          });
        }
        break;
      }
    }
  }

  return { messages, timestamps, turnIds, compactBoundaries };
}

function cloneMessage(message: CanonicalMessage): CanonicalMessage {
  if (typeof structuredClone === "function") {
    return structuredClone(message);
  }
  return JSON.parse(JSON.stringify(message)) as CanonicalMessage;
}

/**
 * Scan transcript entries for failed turns (`turn_result` with `type === "error"`)
 * and inject corresponding `WebMessage { kind: 'error' }` into the message list
 * so error banners survive history reload.
 */
function isRecoverableTurnError(result: { stopReason?: string; errors?: Array<{ code?: string }> }): boolean {
  const errorCode = result.errors?.[0]?.code;
  if (isAgentErrorRecoverable(errorCode)) return true;
  return result.stopReason === "max_turns" || result.stopReason === "tool_error";
}

function injectErrorTurnMessages(
  entries: AgentTranscriptEntry[],
  allMessages: WebMessage[],
  sessionKey: string,
  projectKey?: string,
): void {
  const errorMessages: WebMessage[] = [];
  for (const entry of entries) {
    if (entry.type !== "turn_result" || entry.result.type !== "error") continue;
    const errorTexts = entry.result.errors?.map((e) => e.message).filter(Boolean) ?? [];
    const rawText = errorTexts.length > 0
      ? errorTexts.join("\n")
      : `Turn failed: ${entry.result.stopReason}`;
    const text = formatUserFacingNotice(
      { raw: rawText, recoverable: isRecoverableTurnError(entry.result), exhausted: false },
      DEFAULT_ERROR_LABELS_ZH,
    ).summary;
    errorMessages.push({
      id: `${sessionKey}-turn-error-${entry.turnId}`,
      sessionKey,
      projectKey,
      createdAt: entry.createdAt,
      provider: "pilotdeck",
      role: "error",
      kind: "error",
      text,
      payload: { code: entry.result.stopReason, recoverable: isRecoverableTurnError(entry.result) },
      source: "history",
    });
  }
  if (errorMessages.length === 0) return;

  for (const errMsg of errorMessages) {
    let insertAt = allMessages.length;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].createdAt <= errMsg.createdAt) {
        insertAt = i + 1;
        break;
      }
      if (i === 0) insertAt = 0;
    }
    allMessages.splice(insertAt, 0, errMsg);
  }
}

/**
 * PD-SAAS-FORK (Goal Loop P2 Phase 0b): when a turn ended in model/provider error but the
 * assistant bubble in JSONL is empty, inject a gentle assistant placeholder on history reload
 * so the UI is not blank between the user message and the error banner.
 */
function injectEmptyAssistantHistoryPlaceholders(
  entries: AgentTranscriptEntry[],
  allMessages: WebMessage[],
  sessionKey: string,
  projectKey?: string,
): void {
  for (const entry of entries) {
    if (entry.type !== "turn_result" || entry.result.type !== "error") continue;
    const turnId = entry.turnId;
    const hasAssistantText = allMessages.some((msg) => {
      if (msg.role !== "assistant" || msg.kind !== "text") return false;
      const payloadTurnId = msg.payload && typeof msg.payload === "object"
        ? (msg.payload as { turnId?: string }).turnId
        : undefined;
      if (payloadTurnId && payloadTurnId !== turnId) return false;
      return (msg.text?.trim().length ?? 0) > 12;
    });
    if (hasAssistantText) continue;

    const errorTexts = entry.result.errors?.map((e) => e.message).filter(Boolean) ?? [];
    const rawText = errorTexts.length > 0
      ? errorTexts.join("\n")
      : `Turn failed: ${entry.result.stopReason}`;
    const text = formatUserFacingNotice(
      { raw: rawText, recoverable: isRecoverableTurnError(entry.result), exhausted: false },
      DEFAULT_ERROR_LABELS_ZH,
    ).summary;
    if (!text.trim()) continue;

    let insertAt = allMessages.length;
    for (let i = allMessages.length - 1; i >= 0; i -= 1) {
      if (allMessages[i].createdAt <= entry.createdAt) {
        insertAt = i + 1;
        break;
      }
      if (i === 0) insertAt = 0;
    }
    allMessages.splice(insertAt, 0, {
      id: `${sessionKey}-assistant-placeholder-${turnId}`,
      sessionKey,
      projectKey,
      createdAt: entry.createdAt,
      provider: "pilotdeck",
      role: "assistant",
      kind: "text",
      text,
      payload: { turnId, synthetic: true, source: "empty_assistant_history_inject" },
      source: "history",
    });
  }
}

function readToolResultErrorCode(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const error = (raw as { error?: unknown }).error;
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

function readPlanData(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = (raw as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const d = data as Record<string, unknown>;
  if (typeof d.planFilePath !== "string") return undefined;
  return {
    planFilePath: d.planFilePath,
    planTitle: d.planTitle,
    planSummary: d.planSummary,
  };
}
