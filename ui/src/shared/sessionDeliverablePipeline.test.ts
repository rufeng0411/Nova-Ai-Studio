import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeStableContractHashV2 } from '../../../src/saas/deliverables/deliverableContractBinding';
import type { ChatMessage } from '../components/chat/types/types';
import * as collectModule from './collectDeliverables';
import {
  buildSessionDeliverablePipeline,
  buildPipelineFingerprint,
  computeProcessRailProgress,
} from './sessionDeliverablePipeline';
import * as pipelineCache from './sessionDeliverablePipelineCache';
import { buildTaskFolderSnapshotContractIdentity } from './fetchTaskFolderSnapshot';
import {
  applyRuntimeFeatureFlags,
  resetRuntimeFeatureFlagsForTests,
} from './runtimeFeatureFlags';
import { resolveSessionHistoryDeliverableContext } from './sessionHistoryDeliverableEnvelope';

function makeMessages(count: number): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      id: 'u1',
      type: 'user',
      content: '请交付 artifacts/report.md',
      timestamp: '2026-01-01T00:00:00.000Z',
    },
  ];
  for (let i = 0; i < count; i += 1) {
    messages.push({
      id: `a${i}`,
      type: 'assistant',
      content: `assistant ${i}`,
      timestamp: `2026-01-01T00:0${i % 10}:00.000Z`,
    });
  }
  return messages;
}

describe('sessionDeliverablePipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pipelineCache.clearPipelineCache();
    resetRuntimeFeatureFlagsForTests();
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: false,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
    });
  });

  afterEach(() => {
    resetRuntimeFeatureFlagsForTests();
  });

  it('buildPipelineFingerprint changes when message count changes', () => {
    const a = buildPipelineFingerprint({ sessionId: 's1', messages: makeMessages(2) });
    const b = buildPipelineFingerprint({ sessionId: 's1', messages: makeMessages(3) });
    expect(a).not.toBe(b);
  });

  it('fingerprints sorted snapshot binding content instead of only length', () => {
    const messages = makeMessages(2);
    const first = buildPipelineFingerprint({
      sessionId: 's1',
      messages,
      diskSnapshotComplete: true,
      diskSnapshot: [
        {
          path: 'artifacts/task/a.md',
          basename: 'a.md',
          inContract: true,
          slotId: 'slot_a',
          unitId: 'slot_a',
          snapshotState: 'verified',
        },
        {
          path: 'artifacts/task/b.md',
          basename: 'b.md',
          inContract: false,
          snapshotState: 'verified',
        },
      ],
    });
    const changedBinding = buildPipelineFingerprint({
      sessionId: 's1',
      messages,
      diskSnapshotComplete: true,
      diskSnapshot: [
        {
          path: 'artifacts/task/a.md',
          basename: 'a.md',
          inContract: true,
          slotId: 'slot_b',
          unitId: 'slot_b',
          snapshotState: 'verified',
        },
        {
          path: 'artifacts/task/b.md',
          basename: 'b.md',
          inContract: false,
          snapshotState: 'verified',
        },
      ],
    });
    const reordered = buildPipelineFingerprint({
      sessionId: 's1',
      messages,
      diskSnapshotComplete: true,
      diskSnapshot: [
        {
          path: 'artifacts/task/b.md',
          basename: 'b.md',
          inContract: false,
          snapshotState: 'verified',
        },
        {
          path: 'artifacts/task/a.md',
          basename: 'a.md',
          inContract: true,
          slotId: 'slot_a',
          unitId: 'slot_a',
          snapshotState: 'verified',
        },
      ],
    });

    expect(changedBinding).not.toBe(first);
    expect(reordered).toBe(first);
  });

  it('fingerprints canonical contract identity and every global binding field', () => {
    const messages = makeMessages(2);
    const diskSnapshot = [{
      path: 'artifacts/task/report.md',
      basename: 'report.md',
      inContract: true,
      slotId: 'report',
      unitId: 'report',
      snapshotState: 'verified' as const,
    }];
    const contractIdentity = buildTaskFolderSnapshotContractIdentity({
      slots: [{
        id: 'report',
        label: '报告',
        kind: 'markdown',
        count: 1,
        required: true,
        status: 'active',
        pathHint: 'report.md',
      }],
    });
    const baselineInput = {
      sessionId: 's-binding',
      messages,
      diskSnapshot,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: true,
      diskSnapshotContractIdentity: contractIdentity,
      diskSnapshotBinding: {
        requiredCount: 1,
        matchedCount: 1,
        complete: true,
        incompleteReason: '',
      },
    };
    const baseline = buildPipelineFingerprint(baselineInput);
    const variants = [
      {
        ...baselineInput,
        diskSnapshotContractIdentity: `${contractIdentity}:new-slot`,
      },
      {
        ...baselineInput,
        diskSnapshotBinding: { ...baselineInput.diskSnapshotBinding, requiredCount: 2 },
      },
      {
        ...baselineInput,
        diskSnapshotBinding: { ...baselineInput.diskSnapshotBinding, matchedCount: 0 },
      },
      {
        ...baselineInput,
        diskSnapshotBinding: { ...baselineInput.diskSnapshotBinding, complete: false },
      },
      {
        ...baselineInput,
        diskSnapshotBinding: {
          ...baselineInput.diskSnapshotBinding,
          incompleteReason: 'unbound_units:1',
        },
      },
    ];

    for (const variant of variants) {
      expect(buildPipelineFingerprint(variant)).not.toBe(baseline);
    }
  });

  it('fingerprints validation settlement and same-id manifest scope updates', () => {
    const manifestMessage = (scopeDir: string): ChatMessage[] => [
      {
        id: 'u1',
        type: 'user',
        content: '请交付报告',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a1',
        type: 'assistant',
        content: '',
        timestamp: '2026-01-01T00:00:01.000Z',
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: '请交付报告',
          taskArtifactDir: scopeDir,
          slots: [{
            id: 'report',
            label: '报告',
            kind: 'markdown',
            pathHint: 'report.md',
            required: true,
            status: 'active',
          }],
        },
      },
    ];
    const base = {
      sessionId: 's-same-id',
      messages: manifestMessage('artifacts/task-a'),
      validationSettled: true,
    };

    expect(buildPipelineFingerprint({
      ...base,
      validationSettled: false,
    })).not.toBe(buildPipelineFingerprint(base));
    expect(buildPipelineFingerprint({
      ...base,
      messages: manifestMessage('artifacts/task-b'),
    })).not.toBe(buildPipelineFingerprint(base));
  });

  it('fingerprints every render-relevant pipeline input', () => {
    const messages = makeMessages(2);
    const baselineInput = {
      sessionId: 's-render-inputs',
      messages,
      projectRoot: '/project-a',
      hasMoreMessages: false,
      sessionTaskDirectory: {
        taskArtifactDir: 'artifacts/task-a',
        taskDirKey: 'task-a',
        goalVersion: 1,
        allocatedAt: '2026-01-01T00:00:00.000Z',
        displayLabel: '任务 A',
      },
      sessionRepairActive: false,
      isAssistantWorking: false,
    };
    const baseline = buildPipelineFingerprint(baselineInput);
    const variants = [
      { ...baselineInput, sessionId: 's-render-inputs-b' },
      { ...baselineInput, projectRoot: '/project-b' },
      { ...baselineInput, hasMoreMessages: true },
      {
        ...baselineInput,
        sessionTaskDirectory: {
          ...baselineInput.sessionTaskDirectory,
          displayLabel: '任务 A（更新）',
        },
      },
      { ...baselineInput, sessionRepairActive: true },
      { ...baselineInput, isAssistantWorking: true },
    ];

    for (const variant of variants) {
      expect(buildPipelineFingerprint(variant)).not.toBe(baseline);
    }
  });

  it('fingerprints every resolved unit evidence path even when certificate hashes are stale', () => {
    const messagesWithSecondEvidence = (secondPath: string): ChatMessage[] => [{
      id: 'a1',
      type: 'assistant',
      content: '完成',
      timestamp: '2026-01-01T00:00:01.000Z',
      turnAcceptanceMeta: {
        acceptanceStatus: 'passed',
        acceptanceCertificate: {
          certificateVersion: 2,
          contractHashVersion: 2,
          contractHash: 'same-contract',
          legacyContractHash: 'legacy-contract',
          evidenceHash: 'stale-evidence-hash',
          goalVersion: 1,
          scopeDir: 'artifacts/task-evidence',
          requiredDone: 2,
          requiredTotal: 2,
          completionState: 'complete',
          acceptanceStatus: 'passed',
          legacyAcceptanceStatus: 'passed',
          strictAcceptanceStatus: 'passed',
          units: [
            {
              unitId: 'articles__1',
              slotId: 'articles',
              slotLabel: '成稿',
              expectedPath: 'artifacts/task-evidence/article-a.md',
              expectedBasename: 'article-a.md',
              kind: 'markdown',
              required: true,
            },
            {
              unitId: 'articles__2',
              slotId: 'articles',
              slotLabel: '成稿',
              expectedPath: secondPath,
              expectedBasename: secondPath.split('/').pop(),
              kind: 'markdown',
              required: true,
            },
          ],
          slots: [{
            slotId: 'articles',
            label: '成稿',
            required: true,
            status: 'done',
            resolvedPath: 'artifacts/task-evidence/article-a.md',
            requiredCount: 2,
            matchedCount: 2,
            resolvedPaths: [
              'artifacts/task-evidence/article-a.md',
              secondPath,
            ],
          }],
        },
      },
    }];

    const hashB = buildPipelineFingerprint({
      sessionId: 's-evidence',
      messages: messagesWithSecondEvidence('artifacts/task-evidence/article-b.md'),
    });
    const hashC = buildPipelineFingerprint({
      sessionId: 's-evidence',
      messages: messagesWithSecondEvidence('artifacts/task-evidence/article-c.md'),
    });

    expect(hashB).not.toBe(hashC);
  });

  it('fingerprints in-place deliverable tool updates with the same message id', () => {
    const messagesWithPath = (path: string): ChatMessage[] => [{
      id: 'tool-same-id',
      type: 'assistant',
      timestamp: 1,
      isToolUse: true,
      toolName: 'write_file',
      toolInput: { file_path: path },
      toolResult: { output: `Wrote ${path}` },
    }];

    const hashA = buildPipelineFingerprint({
      sessionId: 's-same-tool-id',
      messages: messagesWithPath('artifacts/task-same/report-a.md'),
    });
    const hashB = buildPipelineFingerprint({
      sessionId: 's-same-tool-id',
      messages: messagesWithPath('artifacts/task-same/report-b.md'),
    });

    expect(hashA).not.toBe(hashB);
  });

  it('misses pipeline cache when identical files gain an unmatched contract slot', () => {
    const messages = makeMessages(2);
    const reportSlot = {
      id: 'report',
      label: '报告',
      kind: 'markdown',
      count: 1,
      required: true,
      status: 'active' as const,
      pathHint: 'report.md',
    };
    const diskSnapshot = [{
      path: 'artifacts/task/report.md',
      basename: 'report.md',
      inContract: true,
      slotId: 'report',
      unitId: 'report',
      snapshotState: 'verified' as const,
    }];
    const baseInput = {
      sessionId: 's-contract-cache',
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      diskSnapshot,
      diskSnapshotVersion: 2,
      diskSnapshotComplete: true,
      diskSnapshotContractIdentity: buildTaskFolderSnapshotContractIdentity({
        slots: [reportSlot],
      }),
      diskSnapshotBinding: {
        requiredCount: 1,
        matchedCount: 1,
        complete: true,
      },
    };
    const first = buildSessionDeliverablePipeline(baseInput);
    const second = buildSessionDeliverablePipeline({
      ...baseInput,
      diskSnapshotContractIdentity: buildTaskFolderSnapshotContractIdentity({
        slots: [
          reportSlot,
          {
            id: 'appendix',
            label: '附录',
            kind: 'markdown',
            count: 1,
            required: true,
            status: 'active',
            pathHint: 'appendix.md',
          },
        ],
      }),
      diskSnapshotBinding: {
        requiredCount: 2,
        matchedCount: 1,
        complete: false,
        incompleteReason: 'unbound_units:1',
      },
    });

    expect(second).not.toBe(first);
    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it('builds a fresh pure bundle and relies on the React caller for memoization', () => {
    const spy = vi.spyOn(collectModule, 'collectDeliverablesFromMessagesInScope');
    const messages = makeMessages(20);
    const input = {
      sessionId: 'sess-1',
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
      turnBoundaryKey: 'tb1',
    };
    const first = buildSessionDeliverablePipeline(input);
    const firstBuildCalls = spy.mock.calls.length;
    const second = buildSessionDeliverablePipeline(input);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(second.unifiedView.rows).toBe(second.dockState.rows);
    expect(second.unifiedView.progress).toBe(second.dockState.progress);
    expect(second.unifiedView.contractHash).toBe(second.dockState.contractHash);
    expect(second.contract.expectedEntries).toBe(second.unifiedView.expectedManifest);
    expect(second.contract.totalSlots).toBe(second.unifiedView.totalSlots);
    expect(second.processRailProgress).toBe(second.unifiedView.progress);
    expect(firstBuildCalls).toBeLessThanOrEqual(2);
    expect(spy.mock.calls.length).toBe(firstBuildCalls * 2);
  });

  it('does not read or write the module LRU during a pipeline build', () => {
    const getSpy = vi.spyOn(pipelineCache, 'getPipelineCacheEntry');
    const setSpy = vi.spyOn(pipelineCache, 'setPipelineCacheEntry');

    buildSessionDeliverablePipeline({
      sessionId: 's-render-pure',
      messages: makeMessages(1),
      projectRoot: '/proj',
      hasMoreMessages: false,
    });

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('invalidates the cache when runtime certificate authority changes', () => {
    const scopeDir = 'artifacts/task-pipeline-certificate';
    const manifest = {
      manifestVersion: 1,
      goalVersion: 1,
      sessionGoalAnchor: '交付报告',
      compiledAtTurnId: 'a1',
      taskArtifactDir: scopeDir,
      slots: [{
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: 'report.md',
        required: true,
        status: 'active' as const,
      }],
    };
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '请交付报告',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'm1',
        type: 'assistant',
        content: '',
        timestamp: '2026-01-01T00:00:30.000Z',
        sessionDeliverableManifest: manifest,
      },
      {
        id: 'a1',
        type: 'assistant',
        content: '已完成',
        timestamp: '2026-01-01T00:01:00.000Z',
        verifiedDeliverablePaths: [`${scopeDir}/report.md`],
        turnAcceptanceMeta: {
          acceptanceStatus: 'passed',
          verifiedPaths: [`${scopeDir}/report.md`],
        },
      },
    ];
    const input = {
      sessionId: 's-cert-cache',
      messages,
      projectRoot: '/project',
      hasMoreMessages: false,
      turnBoundaryKey: 'done',
    };

    const legacy = buildSessionDeliverablePipeline(input);
    expect(legacy.unifiedView.rows[0]?.status).toBe('delivered');

    applyRuntimeFeatureFlags({
      deliverableCertificateUi: true,
      deliverableQualityUi: true,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
    });
    const strict = buildSessionDeliverablePipeline(input);

    expect(strict).not.toBe(legacy);
    expect(strict.fingerprint).not.toBe(legacy.fingerprint);
    expect(strict.unifiedView.rows[0]?.status).toBe('checking');
  });

  it('consumes latestTurnAcceptanceMeta from the history response envelope', () => {
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: true,
      deliverableQualityUi: true,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
    });
    const scopeDir = 'artifacts/task-history-meta';
    const manifest = {
      manifestVersion: 1,
      goalVersion: 3,
      sessionGoalAnchor: '交付报告',
      compiledAtTurnId: 'a1',
      taskArtifactDir: scopeDir,
      slots: [{
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: 'report.md',
        required: true,
        status: 'active' as const,
      }],
    };
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '请交付报告',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'a1',
        type: 'assistant',
        content: '已完成',
        timestamp: '2026-01-01T00:01:00.000Z',
      },
    ];
    const path = `${scopeDir}/report.md`;
    const latestTurnAcceptanceMeta = {
      finality: 'final',
      acceptanceStatus: 'passed',
      verifiedPaths: [path],
      taskArtifactDir: scopeDir,
      acceptanceCertificate: {
        certificateVersion: 2,
        contractHashVersion: 2,
        contractHash: computeStableContractHashV2(manifest),
        legacyContractHash: 'legacy',
        evidenceHash: 'evidence',
        goalVersion: 3,
        scopeDir,
        requiredDone: 1,
        requiredTotal: 1,
        completionState: 'complete',
        acceptanceStatus: 'passed',
        legacyAcceptanceStatus: 'passed',
        strictAcceptanceStatus: 'passed',
        qualityContractHashVersion: 1,
        qualityContractHash: 'quality-contract',
        qualityEvidenceHashVersion: 1,
        qualityEvidenceHash: 'quality-evidence',
        qualityCompletion: 'passed',
        qualityFailures: [],
        assetProvenanceSummary: {
          totalEntries: 0,
          validEntries: 0,
          officialEntries: 0,
          invalidEntries: 0,
          placeholderCount: 0,
          sourceLevelCounts: {},
          sourceTierCounts: {},
        },
        units: [{
          unitId: 'report',
          slotId: 'report',
          slotLabel: '报告',
          expectedPath: path,
          expectedBasename: 'report.md',
          kind: 'markdown',
          required: true,
        }],
        slots: [{
          slotId: 'report',
          label: '报告',
          required: true,
          status: 'done',
          resolvedPath: path,
          requiredCount: 1,
          matchedCount: 1,
          resolvedPaths: [path],
        }],
      },
    };

    const bundle = buildSessionDeliverablePipeline({
      sessionId: 's-history-meta',
      messages,
      projectRoot: '/project',
      hasMoreMessages: false,
      latestTurnAcceptanceMeta,
      sessionDeliverableManifest: manifest,
      sessionTaskDirectory: {
        taskArtifactDir: scopeDir,
        taskDirKey: 'task-history-meta',
        goalVersion: 3,
        allocatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(bundle.unifiedView.rows).toHaveLength(1);
    expect(bundle.unifiedView.rows[0]).toMatchObject({
      id: 'report',
      status: 'delivered',
      resolvedPath: path,
    });
    expect(bundle.unifiedView.qualityStatus).toEqual({
      completionState: 'complete',
      qualityCompletion: 'passed',
      qualityContractHash: 'quality-contract',
      qualityEvidenceHash: 'quality-evidence',
    });
    expect(bundle.dockState.qualityStatus).toEqual(bundle.unifiedView.qualityStatus);
    expect(bundle.validationSession.latestAcceptanceMeta?.acceptanceStatus).toBe('passed');
  });

  it('retains a detached history envelope when the loaded page has no assistant message', () => {
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: true,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
    });
    const scopeDir = 'artifacts/task-20260718-de7ac4ed';
    const path = `${scopeDir}/report.md`;
    const manifest = {
      manifestVersion: 1,
      goalVersion: 4,
      sessionGoalAnchor: '交付报告',
      compiledAtTurnId: 'a-history',
      taskArtifactDir: scopeDir,
      slots: [{
        id: 'report',
        label: '报告',
        kind: 'markdown',
        pathHint: 'report.md',
        required: true,
        status: 'active' as const,
      }],
    };
    const messages: ChatMessage[] = [{
      id: 'u-history',
      type: 'user',
      content: '请交付报告',
      timestamp: '2026-01-01T00:00:00.000Z',
    }];
    const latestTurnAcceptanceMeta = {
      acceptanceStatus: 'passed',
      verifiedPaths: [path],
      taskArtifactDir: scopeDir,
      acceptanceCertificate: {
        certificateVersion: 2,
        contractHashVersion: 2,
        contractHash: computeStableContractHashV2(manifest),
        legacyContractHash: 'legacy',
        evidenceHash: 'evidence',
        goalVersion: 4,
        scopeDir,
        requiredDone: 1,
        requiredTotal: 1,
        completionState: 'complete',
        acceptanceStatus: 'passed',
        legacyAcceptanceStatus: 'passed',
        strictAcceptanceStatus: 'passed',
        units: [{
          unitId: 'report',
          slotId: 'report',
          slotLabel: '报告',
          expectedPath: path,
          expectedBasename: 'report.md',
          kind: 'markdown',
          required: true,
        }],
        slots: [{
          slotId: 'report',
          label: '报告',
          required: true,
          status: 'done',
          resolvedPath: path,
          requiredCount: 1,
          matchedCount: 1,
          resolvedPaths: [path],
        }],
      },
    };
    const detachedContext = resolveSessionHistoryDeliverableContext(messages, {
      latestTurnAcceptanceMeta,
      sessionDeliverableManifest: manifest,
    });

    const bundle = buildSessionDeliverablePipeline({
      sessionId: 's-detached-history',
      messages,
      projectRoot: '/project',
      hasMoreMessages: true,
      latestTurnAcceptanceMeta,
      sessionDeliverableManifest: manifest,
      sessionTaskDirectory: {
        taskArtifactDir: scopeDir,
        taskDirKey: 'task-20260718-de7ac4ed',
        goalVersion: 4,
        allocatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(detachedContext.messages).toBe(messages);
    expect(detachedContext.messages).toHaveLength(1);
    expect(detachedContext.detachedEnvelope?.latestTurnAcceptanceMeta).toEqual(
      expect.objectContaining(latestTurnAcceptanceMeta),
    );
    expect(bundle.frozenManifest).toEqual(manifest);
    expect(bundle.unifiedView.certificateObservation).toBeUndefined();
    expect(bundle.unifiedView.rows).toEqual([
      expect.objectContaining({
        id: 'report',
        status: 'delivered',
        resolvedPath: path,
      }),
    ]);
    expect(bundle.validationSession.latestAcceptanceMeta?.acceptanceStatus).toBe('passed');
  });

  it('retains status-only detached acceptance metadata', () => {
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: true,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
    });
    const scopeDir = 'artifacts/task-20260718-57a7a500';
    const bundle = buildSessionDeliverablePipeline({
      sessionId: 's-detached-status',
      messages: [{
        id: 'u-detached-status',
        type: 'user',
        content: '请交付报告',
        timestamp: '2026-01-01T00:00:00.000Z',
      }],
      projectRoot: '/project',
      hasMoreMessages: true,
      latestTurnAcceptanceMeta: {
        acceptanceStatus: 'needs_repair',
      },
      sessionDeliverableManifest: {
        manifestVersion: 1,
        goalVersion: 1,
        sessionGoalAnchor: '交付报告',
        taskArtifactDir: scopeDir,
        slots: [{
          id: 'report',
          label: '报告',
          pathHint: 'report.md',
          required: true,
          status: 'active',
        }],
      },
      sessionTaskDirectory: {
        taskArtifactDir: scopeDir,
        taskDirKey: 'task-20260718-57a7a500',
        goalVersion: 1,
        allocatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(bundle.validationSession.latestAcceptanceMeta?.acceptanceStatus).toBe('needs_repair');
    expect(bundle.unifiedView.rows).toEqual([
      expect.objectContaining({ id: 'report', status: 'checking' }),
    ]);
  });

  it('computeProcessRailProgress returns null when no slots', () => {
    const result = computeProcessRailProgress({
      verifiedPaths: [],
      contract: { totalSlots: 0, expectedEntries: [] },
    });
    expect(result).toBeNull();
  });
});
