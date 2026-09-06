import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTurnResult } from "../../agent/protocol/result.js";
import type {
  AgentControlBoundaryTranscriptEntry,
  AgentSessionDeliverableManifestTranscriptEntry,
  AgentSessionGoalQualityContractTranscriptEntry,
  AgentTranscriptEntry,
  AgentTurnAcceptanceMetaTranscriptEntry,
  SessionMetadataValue,
} from "./TranscriptEntry.js";
import type { TaskDeliverableLedgerRecord } from "../../saas/taskState/taskDeliverableLedger.js";
import type { SessionTaskDirectory } from "../../saas/taskState/sessionTaskDirectory.js";
import type {
  AcceptedInputAttachmentDescriptor,
} from "./acceptedInputIdentity.js";

export type AgentTranscriptWriterState = {
  sequence: number;
  lastEntryId: string | null;
};

export type AcceptedInputRecordMetadata = {
  inputFingerprint?: string;
  attachmentDescriptors?: AcceptedInputAttachmentDescriptor[];
  synthetic?: boolean;
  logicalInputEntryId?: string;
  queueItemId?: string;
};

export type AgentTranscriptWriter = {
  recordAcceptedInput(
    sessionId: string,
    turnId: string,
    messages: CanonicalMessage[],
    metadata?: AcceptedInputRecordMetadata,
  ): void | Promise<void>;
  recordDurableMessage(sessionId: string, turnId: string, message: CanonicalMessage): void | Promise<void>;
  recordTurnResult(sessionId: string, turnId: string, result: AgentTurnResult): void | Promise<void>;
  recordTurnProgress?(
    sessionId: string,
    turnId: string,
    payload: { stepIndex: number; toolName?: string; artifactPaths?: string[]; summaryZh?: string },
  ): void | Promise<void>;
  recordTurnInterrupted?(
    sessionId: string,
    turnId: string,
    payload: { reason: string; lastCompletedStep?: number },
  ): void | Promise<void>;
  recordTurnDeliverableMeta?(
    sessionId: string,
    turnId: string,
    payload: {
      turnArtifactDir?: string;
      verifiedPaths?: string[];
      alignmentStatus?: string;
    },
  ): void | Promise<void>;
  recordTaskDeliverableLedger?(
    sessionId: string,
    turnId: string,
    record: TaskDeliverableLedgerRecord,
  ): void | Promise<void>;
  recordTurnAcceptanceMeta?(
    sessionId: string,
    turnId: string,
    payload: Omit<
      AgentTurnAcceptanceMetaTranscriptEntry,
      "type" | "sessionId" | "turnId" | "sequence" | "createdAt" | "entryId"
    >,
  ): void | Promise<void>;
  recordSessionDeliverableManifest?(
    sessionId: string,
    turnId: string,
    manifest: AgentSessionDeliverableManifestTranscriptEntry["manifest"],
  ): void | Promise<void>;
  /** PD-SAAS-FORK P0-2: append the bounded, independently hashed quality row. */
  recordSessionGoalQualityContract?(
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
  ): void | Promise<void>;
  recordSessionTaskDirectory?(
    sessionId: string,
    turnId: string,
    directory: SessionTaskDirectory,
  ): void | Promise<void>;
  recordSessionMetadata?(sessionId: string, turnId: string, metadata: SessionMetadataValue): void | Promise<void>;
  recordControlBoundary?(
    sessionId: string,
    turnId: string,
    boundary: AgentControlBoundaryTranscriptEntry["boundary"],
  ): void | Promise<void>;
  recordEntry?(entry: AgentTranscriptEntry): void | Promise<void>;
  snapshotState?(): AgentTranscriptWriterState;
  /** PD-SAAS-FORK (P0-7): adopt a verified Bridge prewrite in a cached writer. */
  restoreState?(maxSequence: number, lastEntryId: string | null): void;
};
