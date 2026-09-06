import { describe, expect, it } from 'vitest';
import {
  buildExportSnapshotEnvelope,
  renderExportSnapshotBanner,
  resolveExportSnapshotCompleteness,
} from './exportSnapshotEnvelope';
import type { AcceptanceCertificateUi } from './turnAcceptanceMeta';

const sampleCertificate: AcceptanceCertificateUi = {
  certificateVersion: 1,
  contractHash: 'abc123',
  evidenceHash: 'ev456',
  goalVersion: 2,
  scopeDir: 'artifacts/task-demo',
  requiredDone: 2,
  requiredTotal: 3,
  completionState: 'accepted_partial',
  acceptanceStatus: 'passed',
  slots: [{ slotId: 'slot_1', status: 'done', resolvedPath: 'artifacts/report.md' }],
};

describe('exportSnapshotEnvelope', () => {
  it('builds snapshotVersion 2 with sanitized certificate', () => {
    const envelope = buildExportSnapshotEnvelope({
      mode: 'diagnostic',
      acceptanceCertificate: sampleCertificate,
      taskKind: 'deliverable',
      completionState: 'accepted_partial',
      contractHash: 'abc123',
      evidenceHash: 'ev456',
    });

    expect(envelope.snapshotVersion).toBe(2);
    expect(envelope.taskKind).toBe('deliverable');
    expect(envelope.snapshotCompleteness).toBe('full');
    expect(envelope.isTerminalSnapshot).toBe(true);
    expect(envelope.mode).toBe('diagnostic');
    expect(envelope.goalVersion).toBe(2);
    expect(envelope.certificate).toEqual({
      certificateVersion: 1,
      contractHash: 'abc123',
      evidenceHash: 'ev456',
      goalVersion: 2,
      completionState: 'accepted_partial',
      requiredDone: 2,
      requiredTotal: 3,
      acceptanceStatus: 'passed',
    });
    expect(envelope.certificate).not.toHaveProperty('contractHashVersion');
    expect(envelope.certificate).not.toHaveProperty('legacyContractHash');
    expect(envelope.certificate).not.toHaveProperty('units');
  });

  it('marks chat-only tasks as chat_only completeness', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'chat',
      mode: 'user_archive',
    });

    expect(envelope.taskKind).toBe('chat');
    expect(envelope.snapshotCompleteness).toBe('chat_only');
    expect(resolveExportSnapshotCompleteness({ taskKind: 'chat' })).toBe('chat_only');
  });

  it('clears orphan deliverable contract fields from chat snapshots', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'chat',
      mode: 'diagnostic',
      scopeDir: 'artifacts/orphan-task',
      contractHash: 'orphan-contract',
      evidenceHash: 'orphan-evidence',
      completionState: 'complete',
      acceptanceCertificate: sampleCertificate,
    });

    expect(envelope.taskKind).toBe('chat');
    expect(envelope.scopeDir).toBeNull();
    expect(envelope.contractHash).toBeNull();
    expect(envelope.evidenceHash).toBeNull();
    expect(envelope.goalVersion).toBeUndefined();
    expect(envelope.manifestVersion).toBeUndefined();
    expect(envelope.certificate).toBeUndefined();
    expect(envelope.completionState).toBeUndefined();
  });

  it('uses lifecycle-only terminal semantics for completed chat snapshots', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'chat',
      mode: 'user_archive',
      lifecyclePhase: 'idle',
      executionStatus: 'completed',
      completionState: 'complete',
      scopeDir: 'artifacts/orphan-chat',
      contractHash: 'orphan-chat-contract',
      evidenceHash: 'orphan-chat-evidence',
      acceptanceCertificate: sampleCertificate,
    });

    expect(envelope.taskKind).toBe('chat');
    expect(envelope.isTerminalSnapshot).toBe(true);
    expect(envelope.completionState).toBeUndefined();
    expect(envelope.scopeDir).toBeNull();
    expect(envelope.contractHash).toBeNull();
    expect(envelope.evidenceHash).toBeNull();
    expect(envelope.goalVersion).toBeUndefined();
    expect(envelope.certificate).toBeUndefined();
    expect(renderExportSnapshotBanner(envelope)).toContain('对话已完成（无成果任务）');
  });

  it('preserves sanitized v2 certificate identity without coercing it to v1', () => {
    const certificate: AcceptanceCertificateUi = {
      ...sampleCertificate,
      certificateVersion: 2,
      contractHashVersion: 2,
      contractHash: 'strict-v2-hash',
      legacyContractHash: 'legacy-v1-hash',
      legacyAcceptanceStatus: 'needs_repair',
      strictAcceptanceStatus: 'passed',
      completionState: 'complete',
      requiredDone: 3,
      requiredTotal: 3,
      units: [],
      slots: [],
    };
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'deliverable',
      acceptanceCertificate: certificate,
    });

    expect(envelope.certificate).toEqual({
      certificateVersion: 2,
      contractHashVersion: 2,
      contractHash: 'strict-v2-hash',
      evidenceHash: 'ev456',
      goalVersion: 2,
      completionState: 'complete',
      requiredDone: 3,
      requiredTotal: 3,
      acceptanceStatus: 'passed',
      legacyContractHash: 'legacy-v1-hash',
      legacyAcceptanceStatus: 'needs_repair',
      strictAcceptanceStatus: 'passed',
    });
    expect(envelope.certificate).not.toHaveProperty('units');
    expect(envelope.certificate).not.toHaveProperty('slots');
  });

  it('marks incomplete deliverable tasks as partial', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'deliverable',
      completionState: 'incomplete',
    });

    expect(envelope.snapshotCompleteness).toBe('partial');
    expect(envelope.isTerminalSnapshot).toBe(false);
  });

  it('serializes the real transcript cursor and source offset', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'chat',
      lifecyclePhase: 'idle',
      executionStatus: 'completed',
      transcriptCursor: '120',
      sourceOffset: 120,
      folderSnapshotComplete: true,
    });

    expect(envelope.transcriptCursor).toBe('120');
    expect(envelope.sourceOffset).toBe(120);
    expect(envelope.folderSnapshotComplete).toBe(true);
  });

  it('keeps a deliverable snapshot partial when the task-folder scan is incomplete', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'deliverable',
      lifecyclePhase: 'idle',
      executionStatus: 'completed',
      completionState: 'complete',
      acceptanceCertificate: {
        ...sampleCertificate,
        completionState: 'complete',
        requiredDone: 3,
        requiredTotal: 3,
      },
      folderSnapshotComplete: false,
    });

    expect(envelope.snapshotCompleteness).toBe('partial');
    expect(envelope.isTerminalSnapshot).toBe(false);
    expect(envelope.folderSnapshotComplete).toBe(false);
  });

  it.each([
    {
      lifecyclePhase: 'turn_streaming' as const,
      executionStatus: 'running' as const,
    },
    {
      lifecyclePhase: 'turn_queued' as const,
      executionStatus: 'queued' as const,
    },
    {
      lifecyclePhase: 'deliverable_repair_pending' as const,
      executionStatus: 'idle' as const,
    },
  ])('keeps $lifecyclePhase exports nonterminal even with a stale complete certificate', ({
    lifecyclePhase,
    executionStatus,
  }) => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'deliverable',
      lifecyclePhase,
      executionStatus,
      completionState: 'complete',
      acceptanceCertificate: {
        ...sampleCertificate,
        completionState: 'complete',
        requiredDone: 3,
        requiredTotal: 3,
      },
    });

    expect(envelope.isTerminalSnapshot).toBe(false);
    expect(renderExportSnapshotBanner(envelope)).toContain('进行中快照');
    expect(renderExportSnapshotBanner(envelope)).toContain('非终态');
    expect(renderExportSnapshotBanner(envelope)).not.toContain('终态快照');
  });

  it('uses the ending-state banner only for terminal snapshots', () => {
    const envelope = buildExportSnapshotEnvelope({
      taskKind: 'deliverable',
      lifecyclePhase: 'idle',
      executionStatus: 'completed',
      completionState: 'complete',
      acceptanceCertificate: {
        ...sampleCertificate,
        completionState: 'complete',
        requiredDone: 3,
        requiredTotal: 3,
      },
    });

    expect(envelope.isTerminalSnapshot).toBe(true);
    expect(renderExportSnapshotBanner(envelope)).toContain('终态快照');
    expect(renderExportSnapshotBanner(envelope)).not.toContain('进行中快照');
  });
});
