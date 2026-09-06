// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { renderWithProviders } from '../../../test/renderWithProviders';
import DeliverableSummaryTable from './DeliverableSummaryTable';

vi.mock('./DeliverablePreviewOverlay', () => ({
  default: () => null,
}));

vi.mock('./DeliverableSummaryInlinePreview', () => ({
  default: ({ ariaLabel }: { ariaLabel?: string }) => <span aria-label={ariaLabel}>preview</span>,
}));

function item(path: string): DeliverableItem {
  return {
    id: `document:${path}`,
    path,
    apiPath: path,
    resolvedPath: path,
    kind: 'document',
    source: 'text',
  };
}

afterEach(() => {
  cleanup();
});

describe('DeliverableSummaryTable folder reconcile', () => {
  it('marks manifest slot delivered when folder item basename matches (C4/C5)', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        folderItems={[item('artifacts/razer-geo/audit-checklist.md')]}
        expectedManifest={[
          {
            id: 'slot_0',
            label: 'geo-aeo-audit 审计清单',
            kind: 'markdown',
            pathHints: ['01-aeo-audit-checklist.md', 'audit-checklist.md'],
          },
        ]}
        verifiedPaths={['artifacts/razer-geo/audit-checklist.md']}
        forceShow
        validationSettled
      />,
    );

    expect(screen.getByText(/已完成|已交付/)).toBeTruthy();
    expect(screen.getByText('audit-checklist.md')).toBeTruthy();
  });

  it('syncs summary table with session folder items not in turn items', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        folderItems={[
          item('artifacts/sales/intel.md'),
          item('artifacts/sales/battlecard.md'),
        ]}
        expectedManifest={[
          { id: 's1', label: 'intel', path: 'artifacts/sales/intel.md' },
          { id: 's2', label: 'battlecard', path: 'battlecard.md' },
        ]}
        verifiedPaths={[
          'artifacts/sales/intel.md',
          'artifacts/sales/battlecard.md',
        ]}
        forceShow
        validationSettled
      />,
    );

    expect(screen.getAllByText(/已完成|已交付/)).toHaveLength(2);
  });

  it('renders prebuilt unified rows without locally re-promoting them from folder evidence', () => {
    const path = 'artifacts/task-unified/report.md';
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        folderItems={[item(path)]}
        unifiedRowsOverride={[{
          id: 'report',
          label: '报告',
          path,
          status: 'checking',
          resolvedPath: path,
          previewable: false,
          linkable: false,
        }]}
        contractHash="unified-contract-hash"
        verifiedPaths={[path]}
        validationSettled
        forceShow
      />,
    );

    expect(screen.getByText(/校验中/)).toBeTruthy();
    expect(screen.queryByText(/已完成|已交付/)).toBeNull();
    expect(
      screen.getByTestId('deliverable-summary-table').getAttribute('data-contract-hash'),
    ).toBe('unified-contract-hash');
  });

  it('treats an empty prebuilt unified view as authoritative', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[item('artifacts/task-unified/report.md')]}
        folderItems={[item('artifacts/task-unified/report.md')]}
        unifiedRowsOverride={[]}
        validationSettled
      />,
    );

    expect(screen.queryByText('report.md')).toBeNull();
    expect(screen.queryByText(/已完成|已交付/)).toBeNull();
  });
});
