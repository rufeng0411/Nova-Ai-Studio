// PD-SAAS-FORK: 导出一致性快照 — 冻结 transcript / 合同 / 生命周期时刻

import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import {
  isSessionTaskInFlight,
  type SessionTaskPhase,
} from './sessionTaskLifecycle';
import type { AcceptanceCertificateUi } from './turnAcceptanceMeta';



export type ExportSnapshotMode = 'user_archive' | 'diagnostic';



export type ExportSnapshotTaskKind = 'chat' | 'deliverable';



export type ExportSnapshotCompleteness = 'full' | 'partial' | 'chat_only';

export type ExportSnapshotTruncationReason =
  | 'message_budget'
  | 'input_budget'
  | 'export_size_limit';


/** PD-SAAS-FORK: 导出 manifest 内证书摘要（不含 slots 明细） */

type ExportSnapshotCertificateBase = {

  contractHash: string;

  evidenceHash: string;

  goalVersion?: number;

  completionState: AcceptanceCertificateUi['completionState'];

  requiredDone: number;

  requiredTotal: number;

  acceptanceStatus?: string;

};

export type ExportSnapshotCertificate =
  | (ExportSnapshotCertificateBase & {
    certificateVersion: 1;
  })
  | (ExportSnapshotCertificateBase & {
    certificateVersion: 2;
    contractHashVersion?: 2;
    legacyContractHash?: string;
    legacyAcceptanceStatus?: string;
    strictAcceptanceStatus?: string;
  });



export type ExportSnapshotEnvelope = {

  snapshotAt: string;

  snapshotVersion: 2;

  transcriptCursor: string | null;

  sourceOffset: number | null;

  lifecyclePhase: SessionTaskPhase | 'unknown';

  executionStatus?: 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'idle';

  manifestVersion?: number;

  goalVersion?: number;

  scopeDir: string | null;

  contractHash: string | null;

  evidenceHash: string | null;

  /** 成果合同完成态；taskKind=chat 时必须省略。 */
  completionState?: string;

  taskKind: ExportSnapshotTaskKind;

  snapshotCompleteness: ExportSnapshotCompleteness;

  certificate?: ExportSnapshotCertificate;

  isTerminalSnapshot: boolean;

  mode: ExportSnapshotMode;

  truncated?: boolean;

  truncationReason?: ExportSnapshotTruncationReason;

  /** P0-4 task-folder snapshot must be complete before a deliverable export is terminal. */
  folderSnapshotComplete?: boolean;

};



export type BuildExportSnapshotInput = {

  mode?: ExportSnapshotMode;

  lifecyclePhase?: SessionTaskPhase | 'unknown';

  executionStatus?: ExportSnapshotEnvelope['executionStatus'];

  sessionManifest?: SessionDeliverableManifestUi | null;

  scopeDir?: string | null;

  contractHash?: string | null;

  evidenceHash?: string | null;

  /** 仅用于成果合同；纯聊天终态由 lifecyclePhase/executionStatus 判定。 */
  completionState?: string;

  acceptanceCertificate?: AcceptanceCertificateUi | null;

  taskKind?: ExportSnapshotTaskKind;

  transcriptCursor?: string | null;

  sourceOffset?: number | null;

  truncated?: boolean;

  truncationReason?: ExportSnapshotTruncationReason;

  /** P0-4 task-folder scan completeness must agree with export terminal state. */
  folderSnapshotComplete?: boolean;

};



export function sanitizeExportCertificate(

  certificate: AcceptanceCertificateUi,

): ExportSnapshotCertificate {

  const shared: ExportSnapshotCertificateBase = {

    contractHash: certificate.contractHash,

    evidenceHash: certificate.evidenceHash,

    goalVersion: certificate.goalVersion,

    completionState: certificate.completionState,

    requiredDone: certificate.requiredDone,

    requiredTotal: certificate.requiredTotal,

    acceptanceStatus: certificate.acceptanceStatus,

  };

  if (certificate.certificateVersion === 2) {
    return {
      ...shared,
      certificateVersion: 2,
      ...(certificate.contractHashVersion === 2 ? { contractHashVersion: 2 } : {}),
      ...(certificate.legacyContractHash
        ? { legacyContractHash: certificate.legacyContractHash }
        : {}),
      ...(certificate.legacyAcceptanceStatus
        ? { legacyAcceptanceStatus: certificate.legacyAcceptanceStatus }
        : {}),
      ...(certificate.strictAcceptanceStatus
        ? { strictAcceptanceStatus: certificate.strictAcceptanceStatus }
        : {}),
    };
  }

  return {
    ...shared,
    certificateVersion: 1,
  };

}



export function resolveExportSnapshotCompleteness(input: {

  taskKind: ExportSnapshotTaskKind;

  completionState?: string;

}): ExportSnapshotCompleteness {

  if (input.taskKind === 'chat') return 'chat_only';

  if (input.completionState === 'complete' || input.completionState === 'accepted_partial') {

    return 'full';

  }

  return 'partial';

}



export function buildExportSnapshotEnvelope(input: BuildExportSnapshotInput): ExportSnapshotEnvelope {

  const taskKind = input.taskKind ?? (

    (input.sessionManifest?.slots?.length ?? 0) > 0 ? 'deliverable' : 'chat'

  );
  const hasDeliverableContract = taskKind === 'deliverable';
  const completionState = hasDeliverableContract
    ? input.completionState ?? input.acceptanceCertificate?.completionState
    : undefined;
  const goalVersion = hasDeliverableContract
    ? input.sessionManifest?.goalVersion ?? input.acceptanceCertificate?.goalVersion
    : undefined;
  const contractHash = hasDeliverableContract
    ? input.contractHash ?? input.acceptanceCertificate?.contractHash ?? null
    : null;
  const evidenceHash = hasDeliverableContract
    ? input.evidenceHash ?? input.acceptanceCertificate?.evidenceHash ?? null
    : null;

  const snapshotCompleteness = hasDeliverableContract && input.folderSnapshotComplete === false
    ? 'partial'
    : resolveExportSnapshotCompleteness({ taskKind, completionState });

  const terminalCompletion = completionState === 'complete' || completionState === 'accepted_partial';

  const lifecycleInFlight = input.lifecyclePhase !== undefined
    && input.lifecyclePhase !== 'unknown'
    && isSessionTaskInFlight(input.lifecyclePhase);

  const executionInFlight = input.executionStatus === 'queued' || input.executionStatus === 'running';

  const chatLifecycleComplete = taskKind === 'chat'
    && !lifecycleInFlight
    && !executionInFlight
    && (
      input.executionStatus === 'completed'
      || (input.executionStatus === undefined && input.lifecyclePhase === 'idle')
    );
  const isTerminalSnapshot = taskKind === 'chat'
    ? chatLifecycleComplete
    : terminalCompletion
      && input.folderSnapshotComplete !== false
      && !lifecycleInFlight
      && !executionInFlight;

  const certificate = hasDeliverableContract && input.acceptanceCertificate

    ? sanitizeExportCertificate(input.acceptanceCertificate)

    : undefined;



  return {

    snapshotVersion: 2,

    snapshotAt: new Date().toISOString(),

    transcriptCursor: input.transcriptCursor ?? null,

    sourceOffset: input.sourceOffset ?? null,

    lifecyclePhase: input.lifecyclePhase ?? 'unknown',

    executionStatus: input.executionStatus,

    manifestVersion: hasDeliverableContract ? input.sessionManifest?.manifestVersion : undefined,

    goalVersion,

    scopeDir: hasDeliverableContract
      ? input.scopeDir ?? input.acceptanceCertificate?.scopeDir ?? null
      : null,

    contractHash,

    evidenceHash,

    completionState,

    taskKind,

    snapshotCompleteness,

    certificate,

    isTerminalSnapshot,

    mode: input.mode ?? 'user_archive',

    ...(input.truncated ? { truncated: true } : {}),

    ...(input.truncationReason ? { truncationReason: input.truncationReason } : {}),

    ...(typeof input.folderSnapshotComplete === 'boolean'
      ? { folderSnapshotComplete: input.folderSnapshotComplete }
      : {}),

  };

}



export function renderExportSnapshotBanner(envelope: ExportSnapshotEnvelope, labels?: { inProgress?: string; terminal?: string }): string {

  const modeLabel = envelope.mode === 'diagnostic' ? '诊断快照' : '归档快照';

  if (envelope.taskKind === 'chat' && envelope.isTerminalSnapshot) {

    return labels?.terminal ?? `对话已完成（无成果任务） · ${envelope.snapshotAt}`;

  }

  if (envelope.isTerminalSnapshot) {

    return labels?.terminal ?? `${modeLabel} · 终态快照 · ${envelope.snapshotAt}`;

  }

  return labels?.inProgress ?? `${modeLabel} · 进行中快照 · 非终态 · ${envelope.snapshotAt}（成果状态可能变化）`;

}

