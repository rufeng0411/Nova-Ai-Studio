import { describe, expect, it } from 'vitest';
import { mergeFolderItemsIntoDockRows, type DeliverableDockRow } from './buildDeliverableDockRows';
import type { DeliverableItem } from './collectDeliverables';

describe('mergeFolderItemsIntoDockRows', () => {
  it('adds folder files missing from SDM slot rows when no baseline manifest', () => {
    const rows: DeliverableDockRow[] = [
      {
        id: 'stage_brief',
        label: '传播 brief',
        path: 'artifacts/campaign/brief.md',
        status: 'delivered',
        resolvedPath: 'artifacts/campaign/brief.md',
        previewable: true,
        linkable: true,
      },
    ];
    const folderItems: DeliverableItem[] = [
      {
        id: 'f1',
        path: 'artifacts/campaign/brief.md',
        apiPath: 'artifacts/campaign/brief.md',
        kind: 'file',
      },
      {
        id: 'f2',
        path: 'artifacts/campaign/poster.html',
        apiPath: 'artifacts/campaign/poster.html',
        kind: 'html',
      },
    ];

    const merged = mergeFolderItemsIntoDockRows(rows, folderItems);
    expect(merged).toHaveLength(2);
    expect(merged.some((row) => row.path.includes('poster.html'))).toBe(true);
  });

  it('does not add or optimistically deliver rows when an SDM baseline exists', () => {
    const rows: DeliverableDockRow[] = [
      {
        id: 'stage_brief',
        label: '传播 brief',
        path: 'artifacts/campaign/brief.md',
        status: 'missing',
        previewable: false,
        linkable: false,
      },
    ];
    const folderItems: DeliverableItem[] = [
      {
        id: 'f1',
        path: 'artifacts/campaign/brief.md',
        apiPath: 'artifacts/campaign/brief.md',
        kind: 'file',
      },
      {
        id: 'f2',
        path: 'artifacts/campaign/poster.html',
        apiPath: 'artifacts/campaign/poster.html',
        kind: 'html',
      },
    ];

    const merged = mergeFolderItemsIntoDockRows(rows, folderItems, { allowExtraRows: false });
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('missing');
    expect(merged[0].resolvedPath).toBe('artifacts/campaign/brief.md');
    expect(merged.some((row) => row.path.includes('poster.html'))).toBe(false);
  });

  it('skips internal non-user deliverable paths', () => {
    const merged = mergeFolderItemsIntoDockRows([], [{
      id: 's1',
      path: 'skills/foo/SKILL.md',
      kind: 'file',
    }]);
    expect(merged).toHaveLength(0);
  });

  it('enriches delivered rows that only have bare basename paths when no scopeDir', () => {
    const rows: DeliverableDockRow[] = [
      {
        id: 'stage_brief',
        label: '传播 brief',
        path: 'brief.md',
        status: 'delivered',
        resolvedPath: 'brief.md',
        previewable: true,
        linkable: true,
      },
    ];
    const folderItems: DeliverableItem[] = [{
      id: 'f1',
      path: 'artifacts/campaign/brief.md',
      apiPath: 'artifacts/campaign/brief.md',
      resolvedPath: 'artifacts/campaign/brief.md',
      kind: 'file',
    }];

    const merged = mergeFolderItemsIntoDockRows(rows, folderItems, { allowExtraRows: false });
    expect(merged[0].resolvedPath).toBe('artifacts/campaign/brief.md');
    expect(merged[0].linkable).toBe(true);
  });

  it('does not basename-match index.html outside scopeDir (ROG crosstalk)', () => {
    const rows: DeliverableDockRow[] = [
      {
        id: 'html1',
        label: 'index.html',
        path: 'index.html',
        status: 'missing',
        previewable: false,
        linkable: false,
      },
    ];
    const folderItems: DeliverableItem[] = [
      {
        id: 'rog',
        path: 'artifacts/task-20260710-rog12345/index.html',
        apiPath: 'artifacts/task-20260710-rog12345/index.html',
        kind: 'html',
      },
      {
        id: 'current',
        path: 'artifacts/task-20260710-abc12345/index.html',
        apiPath: 'artifacts/task-20260710-abc12345/index.html',
        kind: 'html',
      },
    ];

    const merged = mergeFolderItemsIntoDockRows(rows, folderItems, {
      allowExtraRows: false,
      scopeDir: 'artifacts/task-20260710-abc12345',
    });
    expect(merged[0].resolvedPath).toBe('artifacts/task-20260710-abc12345/index.html');
    expect(merged[0].status).toBe('missing');
  });

  it('keeps unmatched rows checking during an inconclusive snapshot and only enriches matching paths', () => {
    const rows: DeliverableDockRow[] = [
      {
        id: 'report_a',
        label: '报告 A',
        path: 'report-a.md',
        status: 'checking',
        previewable: false,
        linkable: false,
      },
      {
        id: 'report_b',
        label: '报告 B',
        path: 'report-b.md',
        status: 'checking',
        previewable: false,
        linkable: false,
      },
    ];
    const merged = mergeFolderItemsIntoDockRows(rows, [
      {
        id: 'a',
        path: 'artifacts/task-checking/report-a.md',
        apiPath: 'artifacts/task-checking/report-a.md',
        kind: 'document',
        source: 'tool',
      },
      {
        id: 'extra',
        path: 'artifacts/task-checking/extra.md',
        apiPath: 'artifacts/task-checking/extra.md',
        kind: 'document',
        source: 'tool',
      },
    ], {
      allowExtraRows: false,
      scopeDir: 'artifacts/task-checking',
      validationSettled: false,
      verifiedPaths: [],
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      status: 'checking',
      resolvedPath: 'artifacts/task-checking/report-a.md',
      linkable: true,
    });
    expect(merged[0].status).not.toBe('delivered');
    expect(merged[1].status).toBe('checking');
    expect(merged[1].resolvedPath).toBeUndefined();
  });

  it('normalizes trailing punctuation and rejects scope-external and process paths', () => {
    const rows: DeliverableDockRow[] = [{
      id: 'report',
      label: '报告',
      path: 'report.md',
      status: 'checking',
      previewable: false,
      linkable: false,
    }];
    const merged = mergeFolderItemsIntoDockRows(rows, [
      {
        id: 'report',
        path: 'artifacts/task-safe/report.md。',
        apiPath: 'artifacts/task-safe/report.md。',
        kind: 'document',
        source: 'tool',
      },
      {
        id: 'outside',
        path: 'artifacts/other/report.md',
        apiPath: 'artifacts/other/report.md',
        kind: 'document',
        source: 'tool',
      },
      {
        id: 'process',
        path: 'artifacts/task-safe/create-report.py',
        apiPath: 'artifacts/task-safe/create-report.py',
        kind: 'code',
        source: 'tool',
      },
    ], {
      allowExtraRows: false,
      scopeDir: 'artifacts/task-safe',
      validationSettled: false,
      verifiedPaths: [],
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      status: 'checking',
      resolvedPath: 'artifacts/task-safe/report.md',
    });
  });
});
