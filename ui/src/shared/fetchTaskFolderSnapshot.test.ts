import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../utils/api';
import {
  buildTaskFolderSnapshotContractIdentity,
  clearTaskFolderSnapshotCache,
  fetchTaskFolderSnapshotEnvelope,
  resolveTaskFolderSnapshotCompletenessForValidation,
} from './fetchTaskFolderSnapshot';
import type { SessionDeliverableSlotUi } from './resolveSessionDeliverableManifest';

vi.mock('../utils/api', () => ({
  authenticatedFetch: vi.fn(),
}));

function response(input: {
  ok: boolean;
  body?: unknown;
}): Response {
  return {
    ok: input.ok,
    json: async () => input.body,
  } as Response;
}

describe('fetchTaskFolderSnapshotEnvelope', () => {
  beforeEach(() => {
    clearTaskFolderSnapshotCache();
    vi.mocked(authenticatedFetch).mockReset();
  });

  it('only makes applicable loading or inconclusive snapshots unsettle validation', () => {
    expect(resolveTaskFolderSnapshotCompletenessForValidation('not_applicable')).toBeUndefined();
    expect(resolveTaskFolderSnapshotCompletenessForValidation('loading')).toBe(false);
    expect(resolveTaskFolderSnapshotCompletenessForValidation('inconclusive')).toBe(false);
    expect(resolveTaskFolderSnapshotCompletenessForValidation('complete')).toBe(true);
  });

  it('builds a stable order-independent slot contract identity', () => {
    const slotA = {
      id: 'a',
      label: 'A',
      kind: 'markdown',
      count: 1,
      required: true,
      pathHint: 'A.md',
      pathHints: ['alias-a.md', 'a.md'],
      status: 'active' as const,
    };
    const slotB = {
      id: 'b',
      label: 'B',
      kind: 'html',
      count: 2,
      required: true,
      pathHint: 'b.html',
      pathHints: ['b-alt.html'],
      status: 'active' as const,
    };
    const first = buildTaskFolderSnapshotContractIdentity({ slots: [slotA, slotB] });
    const reordered = buildTaskFolderSnapshotContractIdentity({
      slots: [
        { ...slotB },
        { ...slotA, pathHints: [...slotA.pathHints].reverse() },
      ],
    });
    const changedCount = buildTaskFolderSnapshotContractIdentity({
      slots: [slotA, { ...slotB, count: 3 }],
    });

    expect(reordered).toBe(first);
    expect(changedCount).not.toBe(first);
    const hashBound = buildTaskFolderSnapshotContractIdentity({
      slots: [slotA],
      contractHash: 'contract-v2',
    });
    const hashBoundLabelChange = buildTaskFolderSnapshotContractIdentity({
      slots: [{ ...slotA, label: 'A changed' }],
      contractHash: 'contract-v2',
    });
    expect(hashBound).toContain('contract:contract-v2');
    expect(hashBoundLabelChange).not.toBe(hashBound);
  });

  it('changes identity for every field that affects active contract binding', () => {
    const baseSlot = {
      id: 'report',
      label: '报告',
      kind: 'markdown',
      count: 1,
      required: true,
      status: 'active' as const,
      pathHint: 'report.md',
      pathHints: ['report.md', 'report-alias.md'],
    };
    const baseline = buildTaskFolderSnapshotContractIdentity({ slots: [baseSlot] });
    const variants: ReadonlyArray<readonly [string, SessionDeliverableSlotUi]> = [
      ['id', { ...baseSlot, id: 'report_v2' }],
      ['label', { ...baseSlot, label: '报告新版' }],
      ['kind', { ...baseSlot, kind: 'html' }],
      ['count', { ...baseSlot, count: 2 }],
      ['required', { ...baseSlot, required: false }],
      ['status', { ...baseSlot, status: 'removed' as const }],
      ['pathHint', { ...baseSlot, pathHint: 'report-v2.md' }],
      ['pathHints', { ...baseSlot, pathHints: ['report.md', 'report-v2.md'] }],
    ];

    for (const [field, variant] of variants) {
      expect(
        buildTaskFolderSnapshotContractIdentity({ slots: [variant] }),
        field,
      ).not.toBe(baseline);
    }
  });

  it('returns all snapshot-v2 completeness fields on success', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(response({
      ok: true,
      body: {
        files: [{
          path: 'artifacts/task/report.md',
          basename: 'report.md',
          inContract: true,
          slotId: 'report',
          unitId: 'report',
          snapshotState: 'inconclusive',
        }],
        snapshotVersion: 2,
        truncated: true,
        scannedCount: 501,
        excludedCount: 3,
        snapshotComplete: false,
        truncationReason: 'file_budget_exceeded',
        binding: {
          requiredCount: 2,
          matchedCount: 1,
          complete: false,
          incompleteReason: 'unbound_units:1',
        },
      },
    }));

    const result = await fetchTaskFolderSnapshotEnvelope({
      projectName: 'general',
      scopeDir: 'artifacts/task',
      force: true,
    });

    expect(result.files).toHaveLength(1);
    expect(result.snapshotVersion).toBe(2);
    expect(result.truncated).toBe(true);
    expect(result.scannedCount).toBe(501);
    expect(result.excludedCount).toBe(3);
    expect(result.snapshotComplete).toBe(false);
    expect(result.status).toBe('inconclusive');
    expect(result.truncationReason).toBe('file_budget_exceeded');
    expect(result.files[0]).toMatchObject({ slotId: 'report', unitId: 'report', inContract: true });
    expect(result.binding).toMatchObject({ requiredCount: 2, matchedCount: 1, complete: false });
  });

  it('marks cached fallback inconclusive after a failed refresh', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({
        ok: true,
        body: {
          files: [{
            path: 'artifacts/task/report.md',
            basename: 'report.md',
          }],
          snapshotVersion: 2,
          truncated: false,
          scannedCount: 1,
          excludedCount: 0,
          snapshotComplete: true,
          binding: {
            requiredCount: 1,
            matchedCount: 1,
            complete: true,
          },
        },
      }))
      .mockResolvedValueOnce(response({ ok: false }));

    const input = {
      projectName: 'general',
      scopeDir: 'artifacts/task',
      force: true,
    };
    const complete = await fetchTaskFolderSnapshotEnvelope(input);
    const fallback = await fetchTaskFolderSnapshotEnvelope(input);

    expect(complete.snapshotComplete).toBe(true);
    expect(complete.status).toBe('complete');
    expect(fallback.files).toEqual(complete.files);
    expect(fallback.snapshotComplete).toBe(false);
    expect(fallback.status).toBe('inconclusive');
    expect(fallback.truncated).toBe(true);
    expect(fallback.truncationReason).toBe('request_failed_cached_fallback');
  });

  it('returns not_applicable when scope prerequisites or v2 metadata are absent', async () => {
    const invalidScope = await fetchTaskFolderSnapshotEnvelope({
      projectName: '',
      scopeDir: '',
    });
    expect(invalidScope.status).toBe('not_applicable');

    const unrelatedScope = await fetchTaskFolderSnapshotEnvelope({
      projectName: 'general',
      scopeDir: 'other/artifacts/task',
    });
    expect(unrelatedScope.status).toBe('not_applicable');
    expect(authenticatedFetch).not.toHaveBeenCalled();

    vi.mocked(authenticatedFetch).mockResolvedValueOnce(response({
      ok: true,
      body: {
        files: [{
          path: 'artifacts/task/legacy.md',
          basename: 'legacy.md',
        }],
      },
    }));
    const legacy = await fetchTaskFolderSnapshotEnvelope({
      projectName: 'general',
      scopeDir: 'artifacts/task',
      force: true,
    });
    expect(legacy.status).toBe('not_applicable');
    expect(legacy.files).toHaveLength(1);
  });

  it('uses the full slot contract identity in the cache key', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(response({
        ok: true,
        body: {
          files: [{ path: 'artifacts/task/a.md', basename: 'a.md' }],
          snapshotVersion: 2,
          truncated: false,
          scannedCount: 1,
          excludedCount: 0,
          snapshotComplete: true,
          binding: { requiredCount: 1, matchedCount: 1, complete: true },
        },
      }))
      .mockResolvedValueOnce(response({
        ok: true,
        body: {
          files: [{ path: 'artifacts/task/b.md', basename: 'b.md' }],
          snapshotVersion: 2,
          truncated: false,
          scannedCount: 1,
          excludedCount: 0,
          snapshotComplete: true,
          binding: { requiredCount: 1, matchedCount: 1, complete: true },
        },
      }));

    const baseInput = {
      projectName: 'general',
      scopeDir: 'artifacts/task',
    };
    const first = await fetchTaskFolderSnapshotEnvelope({
      ...baseInput,
      slots: [{
        id: 'a',
        label: 'A',
        kind: 'markdown',
        count: 1,
        pathHint: 'a.md',
        pathHints: ['a.md'],
        status: 'active',
      }],
    });
    const second = await fetchTaskFolderSnapshotEnvelope({
      ...baseInput,
      slots: [{
        id: 'b',
        label: 'B',
        kind: 'markdown',
        count: 1,
        pathHint: 'b.md',
        pathHints: ['b.md'],
        status: 'active',
      }],
    });

    expect(first.files[0]?.path).toContain('a.md');
    expect(second.files[0]?.path).toContain('b.md');
    expect(authenticatedFetch).toHaveBeenCalledTimes(2);
  });
});
