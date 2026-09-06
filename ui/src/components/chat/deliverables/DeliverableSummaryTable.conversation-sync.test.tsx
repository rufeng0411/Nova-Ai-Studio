// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeliverableDockRow } from '../../../shared/buildDeliverableDockRows';
import DeliverableSummaryTable from './DeliverableSummaryTable';

vi.mock('lucide-react', () => ({
  FolderOpen: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const defaults: Record<string, string> = {
        'deliverables.summaryTitle': '成果清单',
        'deliverables.summaryColName': '成果名称',
        'deliverables.summaryColType': '文件类型',
        'deliverables.summaryColStatus': '状态',
        'deliverables.summaryColLink': '文件链接',
        'deliverables.statusChecking': '校验中…',
        'deliverables.statusDelivered': '已交付',
        'deliverables.statusIncomplete': '未完成',
        'deliverables.statusMissing': '未完成',
      };
      return defaults[key] ?? opts?.defaultValue ?? key;
    },
    i18n: { language: 'zh-CN' },
  }),
  I18nextProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('./DeliverablePreviewOverlay', () => ({
  default: () => null,
}));

vi.mock('./DeliverableSummaryInlinePreview', () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
});

describe('DeliverableSummaryTable conversation sync (P0-A)', () => {
  it('renders authoritative unified rows without folder reconcile recolor', async () => {
    const path = 'artifacts/task-unified/report.md';
    const dockRows: DeliverableDockRow[] = [{
      id: 'report',
      label: '报告',
      path,
      status: 'checking',
      resolvedPath: path,
      previewable: false,
      linkable: false,
    }];

    render(
      <DeliverableSummaryTable
        items={[]}
        folderItems={[{
          id: `document:${path}`,
          path,
          apiPath: path,
          resolvedPath: path,
          kind: 'document',
          source: 'text',
        }]}
        unifiedRowsOverride={dockRows}
        unifiedRowsAuthoritative
        validationSettled={false}
        forceShow
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('deliverable-summary-table')).toBeTruthy();
    });
    expect(screen.getByText(/校验中|Checking/i)).toBeTruthy();
    expect(screen.queryByText(/已完成|已交付/)).toBeNull();
  });

  it('matches dock row labels and statuses one-to-one', async () => {
    const rows: DeliverableDockRow[] = [
      {
        id: 'a',
        label: 'Brief',
        path: 'artifacts/campaign/brief.docx',
        resolvedPath: 'artifacts/campaign/brief.docx',
        status: 'delivered',
        previewable: true,
        linkable: true,
      },
      {
        id: 'b',
        label: '海报',
        path: 'artifacts/campaign/poster.png',
        status: 'missing',
        previewable: false,
        linkable: false,
      },
    ];

    render(
      <DeliverableSummaryTable
        items={[]}
        unifiedRowsOverride={rows}
        unifiedRowsAuthoritative
        validationSettled
        forceShow
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Brief')).toBeTruthy();
    });
    expect(screen.getByText('海报')).toBeTruthy();
    expect(screen.getByText(/已完成|已交付/)).toBeTruthy();
    expect(screen.getByText(/未完成/)).toBeTruthy();
  });
});
