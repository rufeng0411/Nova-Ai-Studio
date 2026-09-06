import { randomUUID } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTurnResult } from "../../agent/protocol/result.js";
import {
  classifyDurableMessageEntry,
  truncatePreview,
  SUBAGENT_PROMPT_PREVIEW_BYTES,
  SUBAGENT_SUMMARY_PREVIEW_BYTES,
  type AgentControlBoundaryTranscriptEntry,
  type AgentMessageTranscriptEntry,
  type AgentSessionGoalQualityContractTranscriptEntry,
  type AgentTurnAcceptanceMetaTranscriptEntry,
  type AgentSubagentCompletedTranscriptEntry,
  type AgentSubagentStartedTranscriptEntry,
  type AgentTranscriptEntry,
  type AgentTurnDeliverableMetaTranscriptEntry,
  type SessionMetadataValue,
} from "./TranscriptEntry.js";
import type {
  AcceptedInputRecordMetadata,
  AgentTranscriptWriter,
  AgentTranscriptWriterState,
} from "./TranscriptWriter.js";
import type { TaskDeliverableLedgerRecord } from "../../saas/taskState/taskDeliverableLedger.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import type { SessionTaskDirectory } from "../../saas/taskState/sessionTaskDirectory.js";
import { appendTranscriptEntryLocked } from "./lockedTranscriptAppend.js";
import {
  boundSessionGoalQualityContract,
  computeGoalQualityContractHash,
} from "../../saas/constraints/goalQualityContract.js";
import { sanitizeUrlsForPersistence } from "../../saas/security/urlRedaction.js";

export type SubagentTranscriptHandle = {
  /** UUID v4 of the subagent (matches sidechain filename). */
  subagentId: string;
  /** The sidechain writer (independent JSONL file). */
  writer: JsonlTranscriptWriter;
  /** Absolute path of the sidechain transcript. */
  transcriptPath: string;
};

export type JsonlTranscriptWriterOptions = {
  path: string;
  now?: () => Date;
  /**
   * Optional resolver mapping a subagentId → absolute sidechain path. Wired
   * by the parent session so {@link JsonlTranscriptWriter#forSubagent} can
   * derive a sidechain writer without the caller computing paths. Defaults
   * to `<dirname(path)>/<subagentId>.jsonl`.
   */
  subagentTranscriptPath?: (subagentId: string) => string;
};

export class JsonlTranscriptWriter implements AgentTranscriptWriter {
  private sequence = 0;
  private writeChain: Promise<void> = Promise.resolve();
  private lastEntryId: string | null = null;
  private readonly now: () => Date;

  constructor(private readonly options: JsonlTranscriptWriterOptions) {
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Re-seed the writer's monotonic counters from a previously persisted
   * transcript so that new entries continue with unique, ascending values.
   * Called by the resume path after `readTranscript` has loaded the
   * existing entries.
   */
  restoreState(maxSequence: number, lastEntryId: string | null): void {
    if (!Number.isSafeInteger(maxSequence) || maxSequence < 0) return;
    if (maxSequence > this.sequence) {
      this.sequence = maxSequence;
      this.lastEntryId = lastEntryId;
      return;
    }
    if (maxSequence === this.sequence && lastEntryId !== this.lastEntryId) {
      this.lastEntryId = lastEntryId;
    }
  }

  snapshotState(): AgentTranscriptWriterState {
    return {
      sequence: this.sequence,
      lastEntryId: this.lastEntryId,
    };
  }

  recordAcceptedInput(
    sessionId: string,
    turnId: string,
    messages: CanonicalMessage[],
    metadata?: AcceptedInputRecordMetadata,
  ): Promise<void> {
    return this.recordEntry({
      type: "accepted_input",
      ...this.baseEntry(sessionId, turnId),
      messages,
      inputFingerprint: metadata?.inputFingerprint,
      attachmentDescriptors: metadata?.attachmentDescriptors,
      synthetic: metadata?.synthetic,
      logicalInputEntryId: metadata?.logicalInputEntryId,
      queueItemId: metadata?.queueItemId,
    });
  }

  recordDurableMessage(sessionId: string, turnId: string, message: CanonicalMessage): Promise<void> {
    // PD-SAAS-FORK P0-3: signed URLs and credentials never enter durable tool rows.
    const sanitizedMessage = sanitizeUrlsForPersistence(message);
    const type: AgentMessageTranscriptEntry["type"] =
      classifyDurableMessageEntry(sanitizedMessage);
    return this.recordEntry({
      type,
      ...this.baseEntry(sessionId, turnId),
      message: sanitizedMessage,
    });
  }

  recordTurnResult(sessionId: string, turnId: string, result: AgentTurnResult): Promise<void> {
    return this.recordEntry({
      type: "turn_result",
      ...this.baseEntry(sessionId, turnId),
      // PD-SAAS-FORK P0-3: redact URLs embedded in persisted error details.
      result: sanitizeUrlsForPersistence(result),
    });
  }

  // PD-SAAS-FORK: soft checkpoint progress rows (append-only, optional via env)
  recordTurnProgress(
    sessionId: string,
    turnId: string,
    payload: { stepIndex: number; toolName?: string; artifactPaths?: string[]; summaryZh?: string },
  ): Promise<void> {
    if (process.env.PILOTDECK_TURN_PROGRESS_ENTRIES === "0") {
      return Promise.resolve();
    }
    return this.recordEntry({
      type: "turn_progress",
      ...this.baseEntry(sessionId, turnId),
      stepIndex: payload.stepIndex,
      toolName: payload.toolName,
      artifactPaths: payload.artifactPaths,
      summaryZh: payload.summaryZh,
    });
  }

  recordTurnInterrupted(
    sessionId: string,
    turnId: string,
    payload: { reason: string; lastCompletedStep?: number },
  ): Promise<void> {
    if (process.env.PILOTDECK_TURN_PROGRESS_ENTRIES === "0") {
      return Promise.resolve();
    }
    return this.recordEntry({
      type: "turn_interrupted",
      ...this.baseEntry(sessionId, turnId),
      reason: payload.reason,
      lastCompletedStep: payload.lastCompletedStep,
    });
  }

  // PD-SAAS-FORK: persist turn-scoped artifact directory for deliverable hintDir resolve.
  recordTurnDeliverableMeta(
    sessionId: string,
    turnId: string,
    payload: {
      turnArtifactDir?: string;
      verifiedPaths?: string[];
      alignmentStatus?: string;
    },
  ): Promise<void> {
    if (process.env.PILOTDECK_TURN_DELIVERABLE_META === "0") {
      return Promise.resolve();
    }
    if (!payload.turnArtifactDir && !(payload.verifiedPaths?.length)) {
      return Promise.resolve();
    }
    return this.recordEntry({
      type: "turn_deliverable_meta",
      ...this.baseEntry(sessionId, turnId),
      turnArtifactDir: payload.turnArtifactDir,
      verifiedPaths: payload.verifiedPaths,
      alignmentStatus: payload.alignmentStatus as AgentTurnDeliverableMetaTranscriptEntry["alignmentStatus"],
    });
  }

  // PD-SAAS-FORK: append-only line-0 deliverable ledger for unified display/acceptance projection.
  recordTaskDeliverableLedger(
    sessionId: string,
    turnId: string,
    record: TaskDeliverableLedgerRecord,
  ): Promise<void> {
    if (process.env.PILOTDECK_TASK_DELIVERABLE_LEDGER === "0") {
      return Promise.resolve();
    }
    if (!record.apiPath && !record.resolvedPath) {
      return Promise.resolve();
    }
    return this.recordEntry({
      type: "task_deliverable_ledger",
      ...this.baseEntry(sessionId, turnId),
      record: {
        ...record,
        sessionId: record.sessionId ?? sessionId,
        turnId: record.turnId || turnId,
      },
    });
  }

  // PD-SAAS-FORK: acceptance/display alignment row, append-only and safe to omit.
  recordTurnAcceptanceMeta(
    sessionId: string,
    turnId: string,
    payload: Omit<
      AgentTurnAcceptanceMetaTranscriptEntry,
      "type" | "sessionId" | "turnId" | "sequence" | "createdAt" | "entryId"
    >,
  ): Promise<void> {
    if (process.env.PILOTDECK_TURN_ACCEPTANCE_META === "0") {
      return Promise.resolve();
    }
  // PD-SAAS-FORK: Goal-Loop — persist expectedManifest / continuationOwner even when path lists are empty.
    const hasPathLists = Boolean(
      payload.verifiedPaths?.length
      || payload.missingPaths?.length
      || payload.brokenPaths?.length
      || payload.expectedManifest?.length,
    );
    const hasLifecycleMeta = Boolean(
      payload.continuationOwner
      || payload.circuitBreakerTripped
      || payload.acceptanceStatus
      || payload.sessionManifestVersion != null
      || payload.goalVersion != null
      || payload.sdmSnapshot?.length
      || payload.slotBindings?.length
      || payload.contractSnapshot
      || payload.acceptanceCertificate
      || payload.qualityContractHash
      || payload.qualityContractMode
      || payload.qualityContractShadowDiff
      || payload.turnArtifactDir
      || payload.taskArtifactDir,
    );
    if (!hasPathLists && !hasLifecycleMeta) {
      return Promise.resolve();
    }
    return this.recordEntry({
      type: "turn_acceptance_meta",
      ...this.baseEntry(sessionId, turnId),
      ...payload,
    });
  }

  recordSessionDeliverableManifest(
    sessionId: string,
    turnId: string,
    manifest: SessionDeliverableManifest,
  ): Promise<void> {
    // PD-SAAS-FORK (Train-0A): persist repairCircuit updates even when slots empty.
    if (!manifest?.slots?.length && !manifest?.repairCircuit) return Promise.resolve();
    return this.recordEntry({
      type: "session_deliverable_manifest",
      ...this.baseEntry(sessionId, turnId),
      manifest,
    });
  }

  // PD-SAAS-FORK P0-2: persist only bounded quality semantics and canonical hash.
  recordSessionGoalQualityContract(
    sessionId: string,
    turnId: string,
    payload: Omit<
      AgentSessionGoalQualityContractTranscriptEntry,
      | "type"
      | "sessionId"
      | "turnId"
      | "sequence"
      | "createdAt"
      | "entryId"
      | "parentEntryId"
    >,
  ): Promise<void> {
    const contract = boundSessionGoalQualityContract(payload.contract);
    const qualityContractHash = computeGoalQualityContractHash(contract);
    if (
      payload.qualityContractHash
      && payload.qualityContractHash !== qualityContractHash
    ) {
      return Promise.reject(
        new Error("quality contract hash does not match bounded contract"),
      );
    }
    if (!Number.isSafeInteger(payload.goalVersion) || payload.goalVersion < 1) {
      return Promise.reject(new Error("quality contract goalVersion is invalid"));
    }
    return this.recordEntry({
      type: "session_goal_quality_contract",
      ...this.baseEntry(sessionId, turnId),
      goalVersion: payload.goalVersion,
      qualityContractVersion: 1,
      qualityContractHashVersion: 1,
      qualityContractHash,
      contract,
      compiledAtTurnId: payload.compiledAtTurnId,
      userGoalHash: payload.userGoalHash,
    });
  }

  recordSessionTaskDirectory(
    sessionId: string,
    turnId: string,
    directory: SessionTaskDirectory,
  ): Promise<void> {
    if (process.env.PILOTDECK_SESSION_TASK_DIRECTORY === "0") {
      return Promise.resolve();
    }
    if (!directory?.taskArtifactDir) return Promise.resolve();
    return this.recordEntry({
      type: "session_task_directory",
      ...this.baseEntry(sessionId, turnId),
      taskArtifactDir: directory.taskArtifactDir,
      taskDirKey: directory.taskDirKey,
      goalVersion: directory.goalVersion,
      allocatedAt: directory.allocatedAt,
      displayLabel: directory.displayLabel,
      capabilitySlug: directory.capabilitySlug,
      profileId: directory.profileId,
    });
  }

  recordSessionMetadata(sessionId: string, turnId: string, metadata: SessionMetadataValue): Promise<void> {
    // PD-SAAS-FORK: Phase 5 — catalog is directory authority in SaaS; skip JSONL metadata when flagged.
    if (
      process.env.PILOTDECK_SAAS_MODE === "1"
      && process.env.SAAS_CONVERSATION_CATALOG_STOP_JSONL_METADATA === "1"
    ) {
      return Promise.resolve();
    }
    return this.recordEntry({
      type: "session_metadata",
      ...this.baseEntry(sessionId, turnId),
      metadata,
    });
  }

  recordControlBoundary(
    sessionId: string,
    turnId: string,
    boundary: AgentControlBoundaryTranscriptEntry["boundary"],
  ): Promise<void> {
    return this.recordEntry({
      type: "control_boundary",
      ...this.baseEntry(sessionId, turnId),
      boundary,
    });
  }

  recordEntry(entry: AgentTranscriptEntry): Promise<void> {
    const operation = this.writeChain.catch(() => {}).then(async () => {
      const appended = await appendTranscriptEntryLocked(
        this.options.path,
        (state) => ({
          ...entry,
          sequence: state.nextSequence,
          parentEntryId: state.lastEntryId,
        }),
      );
      this.sequence = appended.sequence;
      this.lastEntryId = appended.entryId ?? this.lastEntryId;
    });
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  /**
   * C3.S1 — record the parent-side `subagent_started` reference. The full
   * directive lives in the sidechain transcript; we keep only a truncated
   * preview to bound the parent transcript size.
   */
  async recordSubagentStarted(
    sessionId: string,
    turnId: string,
    args: {
      subagentId: string;
      subagentType: string;
      prompt: string;
      transcriptRelativePath: string;
      subagentSessionId?: string;
    },
  ): Promise<void> {
    const { preview, truncated } = truncatePreview(args.prompt, SUBAGENT_PROMPT_PREVIEW_BYTES);
    const entry: AgentSubagentStartedTranscriptEntry = {
      type: "subagent_started",
      ...this.baseEntry(sessionId, turnId),
      subagentId: args.subagentId,
      subagentType: args.subagentType,
      promptPreview: preview,
      promptTruncated: truncated,
      transcriptRelativePath: args.transcriptRelativePath,
      subagentSessionId: args.subagentSessionId,
    };
    return this.recordEntry(entry);
  }

  /** C3.S1 — record the parent-side `subagent_completed` reference. */
  async recordSubagentCompleted(
    sessionId: string,
    turnId: string,
    args: {
      subagentId: string;
      subagentType: string;
      summary: string;
      usage?: AgentSubagentCompletedTranscriptEntry["usage"];
      turns: number;
      durationMs: number;
      errored?: boolean;
    },
  ): Promise<void> {
    const { preview, truncated } = truncatePreview(args.summary, SUBAGENT_SUMMARY_PREVIEW_BYTES);
    const entry: AgentSubagentCompletedTranscriptEntry = {
      type: "subagent_completed",
      ...this.baseEntry(sessionId, turnId),
      subagentId: args.subagentId,
      subagentType: args.subagentType,
      summaryPreview: preview,
      summaryTruncated: truncated,
      usage: args.usage,
      turns: args.turns,
      durationMs: args.durationMs,
      errored: args.errored,
    };
    return this.recordEntry(entry);
  }

  /**
   * C3.S2 — derive a sidechain writer for a forked subagent. The new writer
   * is independent (its own sequence counter, its own file path) so the
   * subagent's turn-by-turn entries do not interleave with the parent.
   */
  forSubagent(subagentId: string, now?: () => Date): SubagentTranscriptHandle {
    const path =
      this.options.subagentTranscriptPath?.(subagentId) ??
      defaultSubagentPath(this.options.path, subagentId);
    const writer = new JsonlTranscriptWriter({ path, now: now ?? this.now });
    return { subagentId, writer, transcriptPath: path };
  }

  /**
   * Helper for emitting the relative path to the sidechain that goes into
   * `subagent_started.transcriptRelativePath`. Computed against the parent
   * transcript's directory.
   */
  relativeSubagentPath(subagentId: string): string {
    const sidechain =
      this.options.subagentTranscriptPath?.(subagentId) ??
      defaultSubagentPath(this.options.path, subagentId);
    return relative(dirname(this.options.path), sidechain);
  }

  private baseEntry(
    sessionId: string,
    turnId: string,
  ): Pick<AgentTranscriptEntry, "sessionId" | "turnId" | "sequence" | "createdAt" | "entryId" | "parentEntryId"> {
    return {
      sessionId,
      turnId,
      sequence: 0,
      createdAt: this.now().toISOString(),
      entryId: randomUUID(),
      parentEntryId: null,
    };
  }
}

function defaultSubagentPath(parentPath: string, subagentId: string): string {
  // Default layout: <parentPath dirname>/<parentBaseStem>/subagents/<subagentId>.jsonl
  const dir = dirname(parentPath);
  const stem = basename(parentPath).replace(/\.jsonl$/i, "");
  return join(dir, stem, "subagents", `${subagentId}.jsonl`);
}
