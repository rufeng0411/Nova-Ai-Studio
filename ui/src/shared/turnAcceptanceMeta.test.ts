import { describe, expect, it } from 'vitest';
import {
  buildAcceptanceRowsFromMessage,
  buildSanitizedAcceptanceRowsFromMessage,
  collectSessionAcceptanceRows,
  extractTurnAcceptanceMeta,
  resolveContinuationOwnerFromMessage,
  resolveLatestAcceptanceCertificateState,
  sanitizeAcceptanceMetaForDisplay,
} from './turnAcceptanceMeta';

describe('turnAcceptanceMeta', () => {
  it('uses resolvedPathMap for acceptance rows', () => {
    const rows = buildAcceptanceRowsFromMessage({
      type: 'assistant',
      timestamp: Date.now(),
      content: '完成',
      turnAcceptanceMeta: {
        verifiedPaths: ['index.html'],
        resolvedPathMap: {
          'index.html': 'artifacts/design/worldcup/index.html',
        },
        acceptanceStatus: 'passed',
      },
    });

    expect(rows[0]).toMatchObject({
      status: 'delivered',
      path: 'artifacts/design/worldcup/index.html',
      label: 'index.html',
    });
  });

  it('promotes missing paths with resolvedPathMap to verified on sanitize', () => {
    const sanitized = sanitizeAcceptanceMetaForDisplay({
      verifiedPaths: [],
      missingPaths: ['artifacts/slides-argentina/slide-01.png'],
      brokenPaths: [],
      hiddenByPolicyPaths: [],
      resolvedPathMap: {
        'artifacts/slides-argentina/slide-01.png': 'artifacts/slides-argentina/slide-01.png',
      },
      acceptanceStatus: 'needs_repair',
    });
    expect(sanitized.verifiedPaths).toContain('artifacts/slides-argentina/slide-01.png');
    expect(sanitized.missingPaths).toHaveLength(0);
  });

  it('dedupes verified over missing for same path', () => {
    const sanitized = sanitizeAcceptanceMetaForDisplay({
      verifiedPaths: ['artifacts/slides-argentina/slide-01.png'],
      missingPaths: ['artifacts/slides-argentina/slide-01.png'],
      brokenPaths: [],
      hiddenByPolicyPaths: [],
      resolvedPathMap: {},
      acceptanceStatus: 'needs_repair',
    });
    expect(sanitized.missingPaths).toHaveLength(0);
  });

  it('builds sanitized acceptance rows from bad meta with known verified paths', () => {
    const rows = buildSanitizedAcceptanceRowsFromMessage({
      type: 'assistant',
      timestamp: Date.now(),
      content: '完成',
      turnAcceptanceMeta: {
        verifiedPaths: [],
        missingPaths: ['*.png'],
        acceptanceStatus: 'needs_repair',
      },
    }, {
      turnArtifactDir: 'artifacts/slides-argentina',
      knownVerifiedPaths: [
        'artifacts/slides-argentina/slide-01.png',
        'artifacts/slides-argentina/slide-02.png',
      ],
    });
    expect(rows.some((row) => row.status === 'delivered')).toBe(true);
  });

  it('extracts continuationOwner from nested turnAcceptanceMeta', () => {
    const meta = extractTurnAcceptanceMeta({
      type: 'assistant',
      timestamp: Date.now(),
      content: '完成',
      turnAcceptanceMeta: {
        verifiedPaths: [],
        missingPaths: ['artifacts/slides-argentina/slide-04.png'],
        continuationOwner: 'deliverable_repair',
        acceptanceStatus: 'needs_repair',
      },
    });
    expect(meta?.continuationOwner).toBe('deliverable_repair');
  });

  it('resolveContinuationOwnerFromMessage prefers nested meta', () => {
    expect(resolveContinuationOwnerFromMessage({
      type: 'assistant',
      timestamp: Date.now(),
      content: 'x',
      continuationOwner: 'none',
      turnAcceptanceMeta: {
        continuationOwner: 'auto_continue_engine',
      },
    })).toBe('auto_continue_engine');
  });

  it('whitelists final certificate v2 quality fields for UI and export', () => {
    const meta = extractTurnAcceptanceMeta({
      type: 'assistant',
      timestamp: Date.now(),
      content: '完成',
      turnAcceptanceMeta: {
        finality: 'final',
        acceptanceStatus: 'passed',
        completionState: 'accepted_partial',
        partialReason: 'official_media_degraded',
        qualityContractHashVersion: 1,
        qualityContractHash: 'quality-contract',
        qualityEvidenceHashVersion: 1,
        qualityEvidenceHash: 'quality-evidence',
        qualityCompletion: 'degraded_acceptable',
        qualityFailures: [{
          checkId: 'official_media',
          domain: 'official_media',
          reason: 'official_media_unavailable',
          repairable: false,
          secret: 'must-not-cross-wire',
        }],
        assetProvenanceSummary: {
          totalEntries: 2,
          validEntries: 1,
          officialEntries: 1,
          invalidEntries: 1,
          placeholderCount: 1,
          sourceLevelCounts: { L0: 1, L3: 1 },
          sourceTierCounts: { brand_official: 1 },
          ledgerEvidenceHash: 'ledger-evidence-hash',
        },
        acceptanceCertificate: {
          certificateVersion: 2,
          contractHashVersion: 2,
          contractHash: 'contract-v2',
          legacyContractHash: 'contract-v1',
          evidenceHash: 'evidence-v2',
          goalVersion: 1,
          scopeDir: 'artifacts/task-quality',
          requiredDone: 0,
          requiredTotal: 0,
          completionState: 'accepted_partial',
          partialReason: 'official_media_degraded',
          acceptanceStatus: 'passed',
          legacyAcceptanceStatus: 'passed',
          strictAcceptanceStatus: 'passed',
          qualityContractHashVersion: 1,
          qualityContractHash: 'quality-contract',
          qualityEvidenceHashVersion: 1,
          qualityEvidenceHash: 'quality-evidence',
          qualityCompletion: 'degraded_acceptable',
          qualityFailures: [{
            checkId: 'official_media',
            domain: 'official_media',
            reason: 'official_media_unavailable',
            repairable: false,
            secret: 'must-not-cross-wire',
          }],
          assetProvenanceSummary: {
            totalEntries: 2,
            validEntries: 1,
            officialEntries: 1,
            invalidEntries: 1,
            placeholderCount: 1,
            sourceLevelCounts: { L0: 1, L3: 1 },
            sourceTierCounts: { brand_official: 1 },
            ledgerEvidenceHash: 'ledger-evidence-hash',
          },
          units: [],
          slots: [],
        },
      },
    });

    expect(meta).toMatchObject({
      finality: 'final',
      completionState: 'accepted_partial',
      partialReason: 'official_media_degraded',
      qualityContractHashVersion: 1,
      qualityContractHash: 'quality-contract',
      qualityEvidenceHashVersion: 1,
      qualityEvidenceHash: 'quality-evidence',
      qualityCompletion: 'degraded_acceptable',
      qualityFailures: [{
        checkId: 'official_media',
        domain: 'official_media',
        reason: 'official_media_unavailable',
        repairable: false,
      }],
      acceptanceCertificate: {
        certificateVersion: 2,
        completionState: 'accepted_partial',
        partialReason: 'official_media_degraded',
        qualityCompletion: 'degraded_acceptable',
      },
    });
    expect(meta?.qualityFailures?.[0]).not.toHaveProperty('secret');
    expect(meta?.acceptanceCertificate?.qualityFailures?.[0]).not.toHaveProperty('secret');
  });

  it('collectSessionAcceptanceRows promotes brief when known verified includes brief.md', () => {
    const rows = collectSessionAcceptanceRows([
      {
        type: 'assistant',
        timestamp: Date.now(),
        content: 'brief 完成',
        turnAcceptanceMeta: {
          verifiedPaths: [],
          missingPaths: ['brief.md'],
          acceptanceStatus: 'needs_repair',
        },
      },
    ], {
      knownVerifiedPaths: ['artifacts/campaign/brief.md'],
    });

    expect(rows.some((row) => row.status === 'delivered' && row.path?.includes('brief.md'))).toBe(true);
  });

  it('rejects a v2 count slot whose resolvedPaths repeat the same evidence', () => {
    const resolution = resolveLatestAcceptanceCertificateState([{
      id: 'a1',
      type: 'assistant',
      timestamp: Date.now(),
      content: '完成',
      turnAcceptanceMeta: {
        acceptanceStatus: 'passed',
        acceptanceCertificate: {
          certificateVersion: 2,
          contractHashVersion: 2,
          contractHash: 'contract-v2',
          legacyContractHash: 'contract-v1',
          evidenceHash: 'evidence',
          goalVersion: 1,
          scopeDir: 'artifacts/task-count',
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
              expectedPath: 'artifacts/task-count/article-a.md',
              expectedBasename: 'article-a.md',
              kind: 'markdown',
              required: true,
            },
            {
              unitId: 'articles__2',
              slotId: 'articles',
              slotLabel: '成稿',
              expectedPath: 'artifacts/task-count/article-b.md',
              expectedBasename: 'article-b.md',
              kind: 'markdown',
              required: true,
            },
          ],
          slots: [{
            slotId: 'articles',
            label: '成稿',
            required: true,
            status: 'done',
            resolvedPath: 'artifacts/task-count/article-a.md',
            requiredCount: 2,
            matchedCount: 2,
            resolvedPaths: [
              'artifacts/task-count/article-a.md',
              'artifacts/task-count/article-a.md',
            ],
          }],
        },
      },
    }]);

    expect(resolution).toEqual({
      state: 'corrupt_v2',
      reason: 'v2_slot_evidence_duplicate',
    });
  });

  it('rejects v2 slots that bind one evidence path to two units', () => {
    const sharedPath = 'artifacts/task-count/shared.md';
    const resolution = resolveLatestAcceptanceCertificateState([{
      id: 'a-cross-slot',
      type: 'assistant',
      timestamp: Date.now(),
      content: '完成',
      turnAcceptanceMeta: {
        acceptanceCertificate: {
          certificateVersion: 2,
          contractHashVersion: 2,
          contractHash: 'contract-v2',
          legacyContractHash: 'contract-v1',
          evidenceHash: 'evidence',
          goalVersion: 1,
          scopeDir: 'artifacts/task-count',
          requiredDone: 2,
          requiredTotal: 2,
          completionState: 'complete',
          acceptanceStatus: 'passed',
          legacyAcceptanceStatus: 'passed',
          strictAcceptanceStatus: 'passed',
          units: [
            {
              unitId: 'report',
              slotId: 'report',
              slotLabel: '报告',
              expectedPath: 'artifacts/task-count/report.md',
              expectedBasename: 'report.md',
              required: true,
            },
            {
              unitId: 'appendix',
              slotId: 'appendix',
              slotLabel: '附录',
              expectedPath: 'artifacts/task-count/appendix.md',
              expectedBasename: 'appendix.md',
              required: true,
            },
          ],
          slots: [
            {
              slotId: 'report',
              required: true,
              status: 'done',
              requiredCount: 1,
              matchedCount: 1,
              resolvedPaths: [sharedPath],
            },
            {
              slotId: 'appendix',
              required: true,
              status: 'done',
              requiredCount: 1,
              matchedCount: 1,
              resolvedPaths: [sharedPath],
            },
          ],
        },
      },
    }]);

    expect(resolution).toEqual({
      state: 'corrupt_v2',
      reason: 'v2_slot_evidence_duplicate',
    });
  });
});
