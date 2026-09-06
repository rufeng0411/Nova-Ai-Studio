import type { CanonicalMessage } from "../../model/index.js";
import type { AgentTurnResult } from "../../agent/protocol/result.js";
import type { SessionDeliverableManifest } from "../../saas/taskState/sessionDeliverableManifest.js";
import type {
  AgentControlBoundaryTranscriptEntry,
  AgentSessionGoalQualityContractTranscriptEntry,
  SessionMetadataValue,
} from "./TranscriptEntry.js";
import type {
  AcceptedInputRecordMetadata,
  AgentTranscriptWriter,
  AgentTranscriptWriterState,
} from "./TranscriptWriter.js";
import {
  boundSessionGoalQualityContract,
  computeGoalQualityContractHash,
} from "../../saas/constraints/goalQualityContract.js";

export type InMemoryTranscriptEntry =
  | {
      type: "accepted_input";
      sessionId: string;
      turnId: string;
      messages: CanonicalMessage[];
      metadata?: AcceptedInputRecordMetadata;
    }
  | { type: "durable_message"; sessionId: string; turnId: string; message: CanonicalMessage }
  | { type: "turn_result"; sessionId: string; turnId: string; result: AgentTurnResult }
  | {
      type: "session_deliverable_manifest";
      sessionId: string;
      turnId: string;
      manifest: SessionDeliverableManifest;
    }
  | {
      type: "session_goal_quality_contract";
      sessionId: string;
      turnId: string;
      payload: Omit<
        AgentSessionGoalQualityContractTranscriptEntry,
        | "type"
        | "sessionId"
        | "turnId"
        | "sequence"
        | "createdAt"
        | "entryId"
        | "parentEntryId"
      >;
    }
  | { type: "session_metadata"; sessionId: string; turnId: string; metadata: SessionMetadataValue }
  | {
      type: "control_boundary";
      sessionId: string;
      turnId: string;
      boundary: AgentControlBoundaryTranscriptEntry["boundary"];
    };

export class InMemoryTranscriptWriter implements AgentTranscriptWriter {
  readonly entries: InMemoryTranscriptEntry[] = [];

  recordAcceptedInput(
    sessionId: string,
    turnId: string,
    messages: CanonicalMessage[],
    metadata?: AcceptedInputRecordMetadata,
  ): void {
    // PD-SAAS-FORK: mirror accepted-input identity metadata in tests and in-memory runtimes.
    this.entries.push({ type: "accepted_input", sessionId, turnId, messages, metadata });
  }

  recordDurableMessage(sessionId: string, turnId: string, message: CanonicalMessage): void {
    this.entries.push({ type: "durable_message", sessionId, turnId, message });
  }

  recordTurnResult(sessionId: string, turnId: string, result: AgentTurnResult): void {
    this.entries.push({ type: "turn_result", sessionId, turnId, result });
  }

  // PD-SAAS-FORK P0-2: mirror both halves of the joint bootstrap in memory.
  recordSessionDeliverableManifest(
    sessionId: string,
    turnId: string,
    manifest: SessionDeliverableManifest,
  ): void {
    this.entries.push({
      type: "session_deliverable_manifest",
      sessionId,
      turnId,
      manifest,
    });
  }

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
  ): void {
    const contract = boundSessionGoalQualityContract(payload.contract);
    this.entries.push({
      type: "session_goal_quality_contract",
      sessionId,
      turnId,
      payload: {
        ...payload,
        qualityContractVersion: 1,
        qualityContractHashVersion: 1,
        qualityContractHash: computeGoalQualityContractHash(contract),
        contract,
      },
    });
  }

  recordSessionMetadata(sessionId: string, turnId: string, metadata: SessionMetadataValue): void {
    this.entries.push({ type: "session_metadata", sessionId, turnId, metadata });
  }

  recordControlBoundary(
    sessionId: string,
    turnId: string,
    boundary: AgentControlBoundaryTranscriptEntry["boundary"],
  ): void {
    this.entries.push({ type: "control_boundary", sessionId, turnId, boundary });
  }

  snapshotState(): AgentTranscriptWriterState {
    return {
      sequence: this.entries.length,
      lastEntryId: null,
    };
  }
}
