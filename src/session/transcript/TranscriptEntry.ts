import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTurnResult } from "../../agent/protocol/result.js";
import type { TaskDeliverableLedgerRecord } from "../../saas/taskState/taskDeliverableLedger.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import type { TurnInteractionModeRecord } from "../../saas/intent/turnInteractionMode.js";
import type { AcceptedInputAttachmentDescriptor } from "./acceptedInputIdentity.js";
import type { CompositeSlotQualityAssessment } from "../../saas/deliverables/compositeSlotQuality.js";
import type { SessionGoalQualityContract } from "../../saas/constraints/goalQualityContract.js";
import type {
  AssetProvenanceSummary,
} from "../../saas/final-acceptance/deliverableQualityPipeline.js";
import type {
  DeliverableQualityCompletion,
  DeliverableQualityFailure,
} from "../../saas/final-acceptance/deliverableQualityChecks.js";
import type {
  BoundedQualityShadowDiff,
  QualityContractMode,
} from "../../saas/constraints/qualityCanaryPolicy.js";

export type AgentTranscriptEntryType =
  | "accepted_input"
  | "assistant_message"
  | "tool_result_message"
  | "durable_message"
  | "turn_result"
  | "control_boundary"
  | "session_metadata"
  | "subagent_started"
  | "subagent_completed"
  | "turn_progress"
  | "turn_interrupted"
  | "task_deliverable_ledger"
  | "turn_deliverable_meta"
  | "turn_acceptance_meta"
  | "session_deliverable_manifest"
  | "session_goal_quality_contract"
  | "session_task_directory"
  | "turn_interaction_mode";

export type AgentTranscriptEntryBase = {
  type: AgentTranscriptEntryType;
  sessionId: string;
  turnId: string;
  sequence: number;
  createdAt: string;
  entryId?: string;
  parentEntryId?: string | null;
};

export type AgentAcceptedInputTranscriptEntry = AgentTranscriptEntryBase & {
  type: "accepted_input";
  messages: CanonicalMessage[];
  /** PD-SAAS-FORK: Bridge prewrite marker used only for exact legacy/replay handling. */
  synthetic?: boolean;
  /** PD-SAAS-FORK: prompt + safe attachment descriptor identity; never raw attachment payload. */
  inputFingerprint?: string;
  /** PD-SAAS-FORK: replay-safe attachment references without base64 or secret-bearing content. */
  attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  /** PD-SAAS-FORK: explicit proof that this row replaces/folds one durable prewrite. */
  logicalInputEntryId?: string;
  /** PD-SAAS-FORK: stable queue identity used when no Bridge acceptedInputRef exists. */
  queueItemId?: string;
};

export type AgentMessageTranscriptEntry = AgentTranscriptEntryBase & {
  type: "assistant_message" | "tool_result_message" | "durable_message";
  message: CanonicalMessage;
};

export type AgentTurnResultTranscriptEntry = AgentTranscriptEntryBase & {
  type: "turn_result";
  result: AgentTurnResult;
};

export type CompactBoundaryMetadata = {
  trigger: "manual" | "auto" | "reactive";
  preTokens: number;
  postTokens?: number;
  /** Number of messages summarized into the boundary's summary section. */
  messagesSummarized?: number;
  /** Logical parent uuid before compact (for resume relink). */
  logicalParentUuid?: string;
  /** Optional verbatim segment that was preserved across the boundary. */
  preservedSegment?: {
    fromIndex: number;
    toIndex: number;
  };
  /**
   * Tools that were available before compact; used by replay to detect missing
   * tool references after compact.
   */
  preCompactDiscoveredTools?: string[];
  /** Free-form additional metadata. */
  extra?: Record<string, unknown>;
};

export type MicroCompactBoundaryMetadata = {
  trigger: "time_based" | "cached";
  toolCallIds: string[];
  rewrittenBytes?: number;
};

export type AgentControlBoundaryTranscriptEntry = AgentTranscriptEntryBase & {
  type: "control_boundary";
  boundary:
    | {
        kind: "compact";
        subtype: "compact_boundary";
        compactMetadata: CompactBoundaryMetadata;
      }
    | {
        kind: "compact";
        subtype: "microcompact_boundary";
        microCompactMetadata: MicroCompactBoundaryMetadata;
      }
    | {
        kind: "resume" | "manual";
        metadata?: Record<string, unknown>;
      };
};

export type SessionMetadataValue = {
  title?: string;
  aiTitle?: string;
  tag?: string;
  firstPrompt?: string;
  lastPrompt?: string;
  gitBranch?: string;
  mode?: "normal" | "coordinator";
  linkedPullRequest?: {
    number: number;
    url: string;
    repository: string;
  };
  updatedAt?: string;
};

export type AgentSessionMetadataTranscriptEntry = AgentTranscriptEntryBase & {
  type: "session_metadata";
  metadata: SessionMetadataValue;
};

/**
 * Soft caps for sidechain reference fields. The full directive / final report
 * lives in the sidechain transcript; the parent records only a truncated
 * preview so the parent transcript stays bounded.
 */
export const SUBAGENT_PROMPT_PREVIEW_BYTES = 1024;
export const SUBAGENT_SUMMARY_PREVIEW_BYTES = 4 * 1024;

export type AgentSubagentStartedTranscriptEntry = AgentTranscriptEntryBase & {
  type: "subagent_started";
  /** UUID v4 of the forked subagent (matches sidechain filename). */
  subagentId: string;
  /** Definition id (`general-purpose` / `explore` / `plan`). */
  subagentType: string;
  /**
   * Truncated parent directive — capped at {@link SUBAGENT_PROMPT_PREVIEW_BYTES}
   * to keep main-transcript size bounded. Full directive is the first user
   * message in the sidechain.
   */
  promptPreview: string;
  /** Whether {@link promptPreview} is truncated. */
  promptTruncated: boolean;
  /** Relative path (from session dir) of the sidechain transcript. */
  transcriptRelativePath: string;
  /** Optional sub-session id if the SubAgentSession namespaces sessions. */
  subagentSessionId?: string;
};

export type AgentSubagentCompletedTranscriptEntry = AgentTranscriptEntryBase & {
  type: "subagent_completed";
  subagentId: string;
  subagentType: string;
  /** Truncated final assistant report. */
  summaryPreview: string;
  /** Whether {@link summaryPreview} is truncated. */
  summaryTruncated: boolean;
  /** Aggregate usage from the AgentLoop run. */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    totalTokens?: number;
  };
  /** Number of internal turns the subagent took. */
  turns: number;
  durationMs: number;
  /** True when the run errored (subagent emitted an error result). */
  errored?: boolean;
};

export type AgentTurnProgressTranscriptEntry = AgentTranscriptEntryBase & {
  type: "turn_progress";
  stepIndex: number;
  toolName?: string;
  artifactPaths?: string[];
  summaryZh?: string;
};

export type AgentTurnInterruptedTranscriptEntry = AgentTranscriptEntryBase & {
  type: "turn_interrupted";
  reason: string;
  lastCompletedStep?: number;
};

/** PD-SAAS-FORK: append-only authoritative deliverable ledger row. */
export type AgentTaskDeliverableLedgerTranscriptEntry = AgentTranscriptEntryBase & {
  type: "task_deliverable_ledger";
  record: TaskDeliverableLedgerRecord;
};

/** PD-SAAS-FORK: persisted turn artifact directory for historical deliverable resolve. */
export type AgentTurnDeliverableMetaTranscriptEntry = AgentTranscriptEntryBase & {
  type: "turn_deliverable_meta";
  turnArtifactDir?: string;
  verifiedPaths?: string[];
  alignmentStatus?: "aligned" | "bare_name_risk" | "unrecoverable" | "missing_on_disk" | "cross_deck_phantom";
};

/** PD-SAAS-FORK: final deliverable acceptance + UI display alignment snapshot. */
export type AgentTurnAcceptanceMetaTranscriptEntry = AgentTranscriptEntryBase & {
  type: "turn_acceptance_meta";
  /** PD-SAAS-FORK P0-8: only final rows may drive user-visible quality status. */
  finality?: "draft" | "final";
  userGoalHash?: string;
  /** PD-SAAS-FORK P0-2: bounded quality reference; never the full goal/contract. */
  qualityContractHashVersion?: 1;
  qualityContractHash?: string;
  /** PD-SAAS-FORK P0-7: hashes and verdicts are bounded; raw source URLs stay out. */
  qualityEvidenceHashVersion?: 1;
  qualityEvidenceHash?: string;
  qualityCompletion?: DeliverableQualityCompletion;
  completionState?: "complete" | "accepted_partial" | "incomplete" | "blocked";
  partialReason?: "user_acknowledged" | "official_media_degraded";
  blockedReasonType?: "user_action_required" | "system_exhausted";
  qualityFailures?: DeliverableQualityFailure[];
  assetProvenanceSummary?: AssetProvenanceSummary;
  qualityContractMode?: QualityContractMode;
  qualityContractShadowDiff?: BoundedQualityShadowDiff;
  expectedManifest?: Array<Record<string, unknown>>;
  verifiedPaths?: string[];
  missingPaths?: string[];
  brokenPaths?: string[];
  displayPaths?: string[];
  hiddenByPolicyPaths?: string[];
  turnArtifactDir?: string;
  /** PD-SAAS-FORK (STDA): scope id from taskDirKey for strict path mode. */
  scopeId?: string;
  /** PD-SAAS-FORK (STDA): authoritative task root (same as turnArtifactDir when STDA active). */
  taskArtifactDir?: string;
  resolvedPathMap?: Record<string, string>;
  acceptanceStatus?: "passed" | "needs_repair" | "user_action_required" | "blocked" | "failed";
  continuationOwner?: "none" | "deliverable_repair" | "auto_continue_engine" | "ui_fallback";
  /** PD-SAAS-FORK (ROG Phase 7 G0): session repair circuit breaker tripped — stop UI/engine continue. */
  circuitBreakerTripped?: boolean;
  blockedReason?: string;
  sessionManifestVersion?: number;
  goalVersion?: number;
  sdmSnapshot?: Array<Record<string, unknown>>;
  currentStageId?: string;
  /** PD-SAAS-FORK (UDC R11): per-slot binding snapshot for five-line path alignment. */
  slotBindings?: Array<{
    slotId: string;
    label?: string;
    resolvedPath?: string;
    status: "done" | "pending";
    required?: boolean;
  }>;
  contractSnapshot?: {
    rowsHash: string;
    totalSlots: number;
    doneSlots: number;
    completionState?: "complete" | "accepted_partial" | "incomplete" | "blocked";
    evidenceHash?: string;
  };
  /** PD-SAAS-FORK (0717 P1): optional directory-composite quality assessment. */
  compositeSlotQuality?: CompositeSlotQualityAssessment[];
  /** PD-SAAS-FORK: 终验收证书 v1/v2 — 合同/磁盘/展示唯一权威 */
  acceptanceCertificate?: {
    certificateVersion: 1 | 2;
    contractHash: string;
    evidenceHash: string;
    goalVersion: number;
    scopeDir: string | null;
    requiredDone: number;
    requiredTotal: number;
    completionState: "complete" | "accepted_partial" | "incomplete" | "blocked";
    acceptanceStatus?: string;
    contractHashVersion?: 2;
    legacyContractHash?: string;
    legacyAcceptanceStatus?: string;
    strictAcceptanceStatus?: string;
    qualityContractHashVersion?: 1;
    qualityContractHash?: string;
    qualityEvidenceHashVersion?: 1;
    qualityEvidenceHash?: string;
    qualityCompletion?: DeliverableQualityCompletion;
    partialReason?: "user_acknowledged" | "official_media_degraded";
    blockedReasonType?: "user_action_required" | "system_exhausted";
    qualityFailures?: DeliverableQualityFailure[];
    assetProvenanceSummary?: AssetProvenanceSummary;
    units?: Array<{
      unitId: string;
      slotId: string;
      slotLabel: string;
      expectedPath: string;
      expectedBasename: string;
      kind?: string;
      required: boolean;
    }>;
    slots?: Array<{
      slotId: string;
      label?: string;
      required?: boolean;
      status: string;
      resolvedPath?: string;
      requiredCount?: number;
      matchedCount?: number;
      resolvedPaths?: string[];
    }>;
    compositeSlotQuality?: CompositeSlotQualityAssessment[];
  };
};

/** PD-SAAS-FORK: Goal Loop Phase 3 — session-level deliverable manifest snapshot. */
export type AgentSessionDeliverableManifestTranscriptEntry = AgentTranscriptEntryBase & {
  type: "session_deliverable_manifest";
  manifest: SessionDeliverableManifest;
};

/** PD-SAAS-FORK P0-2: bounded quality semantics, independently recoverable from SDM. */
export type AgentSessionGoalQualityContractTranscriptEntry =
  AgentTranscriptEntryBase & {
    type: "session_goal_quality_contract";
    goalVersion: number;
    qualityContractVersion: 1;
    qualityContractHashVersion: 1;
    qualityContractHash: string;
    contract: SessionGoalQualityContract;
    compiledAtTurnId: string;
    userGoalHash: string;
  };

/** PD-SAAS-FORK (STDA): system-assigned task artifact directory per goalVersion. */
export type AgentSessionTaskDirectoryTranscriptEntry = AgentTranscriptEntryBase & {
  type: "session_task_directory";
  taskArtifactDir: string;
  taskDirKey: string;
  goalVersion: number;
  allocatedAt: string;
  displayLabel?: string;
  capabilitySlug?: string;
  profileId?: string;
  requiredBasenames?: string[];
};

/** PD-SAAS-FORK: durable per-turn dialogue / execute / clarify decision. */
export type AgentTurnInteractionModeTranscriptEntry = AgentTranscriptEntryBase & {
  type: "turn_interaction_mode";
  record: TurnInteractionModeRecord;
};

export type AgentTranscriptEntry =
  | AgentAcceptedInputTranscriptEntry
  | AgentMessageTranscriptEntry
  | AgentTurnResultTranscriptEntry
  | AgentControlBoundaryTranscriptEntry
  | AgentSessionMetadataTranscriptEntry
  | AgentSubagentStartedTranscriptEntry
  | AgentSubagentCompletedTranscriptEntry
  | AgentTurnProgressTranscriptEntry
  | AgentTurnInterruptedTranscriptEntry
  | AgentTaskDeliverableLedgerTranscriptEntry
  | AgentTurnDeliverableMetaTranscriptEntry
  | AgentTurnAcceptanceMetaTranscriptEntry
  | AgentSessionDeliverableManifestTranscriptEntry
  | AgentSessionGoalQualityContractTranscriptEntry
  | AgentSessionTaskDirectoryTranscriptEntry
  | AgentTurnInteractionModeTranscriptEntry;

export function truncatePreview(input: string, byteCap: number): { preview: string; truncated: boolean } {
  const total = Buffer.byteLength(input, "utf8");
  if (total <= byteCap) return { preview: input, truncated: false };
  // Walk codepoint-by-codepoint so we never cut inside a UTF-8 sequence.
  let bytes = 0;
  let out = "";
  for (const ch of input) {
    const chBytes = Buffer.byteLength(ch, "utf8");
    if (bytes + chBytes > byteCap) break;
    bytes += chBytes;
    out += ch;
  }
  return { preview: out, truncated: true };
}

export type AgentTranscriptDiagnostic = {
  code:
    | "transcript_missing"
    | "transcript_too_large"
    | "transcript_line_invalid"
    | "transcript_entry_invalid"
    | "transcript_truncated";
  severity: "warning" | "error";
  message: string;
  line?: number;
};

export function classifyDurableMessageEntry(message: CanonicalMessage): AgentMessageTranscriptEntry["type"] {
  if (message.role === "assistant") {
    return "assistant_message";
  }

  if (message.content.some((block) => block.type === "tool_result")) {
    return "tool_result_message";
  }

  return "durable_message";
}
