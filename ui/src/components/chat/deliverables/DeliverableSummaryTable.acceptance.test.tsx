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

function item(path: string, validationStatus?: string): DeliverableItem {
  return {
    id: `document:${path}`,
    path,
    apiPath: path,
    kind: 'document',
    source: 'text',
    ...(validationStatus ? { validationStatus } : {}),
  } as DeliverableItem;
}

function videoItem(path: string, validationStatus?: string): DeliverableItem {
  return {
    id: `video:${path}`,
    path,
    apiPath: path,
    kind: 'video',
    source: 'tool',
    ...(validationStatus ? { validationStatus } : {}),
  } as DeliverableItem;
}

afterEach(() => {
  cleanup();
});

describe('DeliverableSummaryTable acceptance rows', () => {
  it('shows delivered and missing acceptance rows together', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[item('artifacts/social-matrix/brief.md')]}
        acceptanceRows={[
          {
            id: 'delivered:artifacts/social-matrix/brief.md',
            label: 'brief.md',
            path: 'artifacts/social-matrix/brief.md',
            kind: 'document',
            status: 'delivered',
          },
          {
            id: 'missing:external:xiaohongshu-draft',
            label: '小红书草稿编号',
            path: 'external:xiaohongshu-draft',
            status: 'missing',
          },
        ]}
      />,
    );

    expect(screen.getByText(/已完成|已交付/)).toBeTruthy();
    expect(screen.getByText('未完成')).toBeTruthy();
    expect(screen.getByText('小红书草稿编号')).toBeTruthy();
  });

  it('shows checking while validation is pending', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[videoItem('artifacts/norway-worldcup-2026/output.mp4', 'pending')]}
        validationSettled={false}
      />,
    );

    expect(screen.getByText('校验中…')).toBeTruthy();
    expect(screen.queryByText('未完成')).toBeNull();
    expect(screen.queryByText(/已完成|已交付/)).toBeNull();
  });

  it('shows incomplete only after validation settles without a file', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[videoItem('artifacts/norway-worldcup-2026/output.mp4', 'pending')]}
        validationSettled
      />,
    );

    expect(screen.getByText('未完成')).toBeTruthy();
    expect(screen.queryByText(/已完成|已交付/)).toBeNull();
  });

  it('shows checking for missing acceptance rows while validation runs', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        acceptanceRows={[
          {
            id: 'missing:artifacts/slides/slide-01.png',
            label: '封面 · 阿根廷·南美之心',
            path: 'artifacts/slides/slide-01.png',
            kind: 'image',
            status: 'missing',
          },
        ]}
        validationSettled={false}
      />,
    );

    expect(screen.getByText('校验中…')).toBeTruthy();
    expect(screen.queryByText('未完成')).toBeNull();
  });

  it('shows repairing copy for missing rows while engine repair is active', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        acceptanceRows={[
          {
            id: 'missing:artifacts/slides/slide-04.png',
            label: '第 4 页',
            path: 'artifacts/slides/slide-04.png',
            status: 'missing',
          },
        ]}
        isDeliverableRepairActive
        forceShow
      />,
    );

    expect(screen.getByText('补齐中…')).toBeTruthy();
    expect(screen.queryByText('未完成')).toBeNull();
  });

  it('shows partial nova deck rows with needContinue for missing pages', () => {
    const turnDir = 'artifacts/slides-argentina';
    renderWithProviders(
      <DeliverableSummaryTable
        items={[1, 2, 3].map((n) => videoItem(`${turnDir}/slide-0${n}.png`, 'verified'))}
        expectedManifest={[{ id: 'required_png', kind: 'png', count: 6, required: true }]}
        turnArtifactDir={turnDir}
        slideManifestPages={[1, 2, 3, 4, 5, 6].map((n) => ({
          page: n,
          path: `${turnDir}/slide-0${n}.png`,
        }))}
        acceptanceRows={[
          { id: 'm4', label: '第 4 页', path: `${turnDir}/slide-04.png`, status: 'missing' },
          { id: 'm5', label: '第 5 页', path: `${turnDir}/slide-05.png`, status: 'missing' },
          { id: 'm6', label: '第 6 页', path: `${turnDir}/slide-06.png`, status: 'missing' },
        ]}
      />,
    );

    expect(screen.getAllByText(/已完成|已交付/)).toHaveLength(3);
    expect(screen.getAllByText('需继续')).toHaveLength(3);
  });

  it('shows basename link for delivered videos instead of a bare dash', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[videoItem('artifacts/norway-worldcup-2026/output.mp4', 'verified')]}
      />,
    );

    expect(screen.getByText(/已完成|已交付/)).toBeTruthy();
    expect(screen.getAllByText('output.mp4').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTitle('/artifacts/norway-worldcup-2026/output.mp4')).toBeTruthy();
  });

  it('MOD-07: forceShow renders 1/5 partial SDM manifest rows', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[item('artifacts/modric/discovery.md', 'verified')]}
        expectedManifest={[1, 2, 3, 4, 5].map((n) => ({
          id: `slot_${n}`,
          label: `成果 ${n}`,
          kind: 'markdown',
          path: n === 1 ? 'artifacts/modric/discovery.md' : `artifacts/modric/item-${n}.md`,
        }))}
        verifiedPaths={['artifacts/modric/discovery.md']}
        forceShow
        validationSettled
      />,
    );

    expect(screen.getByTestId('deliverable-summary-table')).toBeTruthy();
    expect(screen.getAllByText(/已完成|已交付/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('未完成').length).toBeGreaterThanOrEqual(1);
  });

  it('MOD-08: forceShow renders 5/5 all delivered rows', () => {
    const paths = [1, 2, 3, 4, 5].map((n) => `artifacts/modric/item-${n}.md`);
    renderWithProviders(
      <DeliverableSummaryTable
        items={paths.map((p) => item(p))}
        expectedManifest={paths.map((p, i) => ({
          id: `slot_${i + 1}`,
          label: `成果 ${i + 1}`,
          kind: 'markdown',
          path: p,
          status: 'done' as const,
        }))}
        verifiedPaths={paths}
        forceShow
        validationSettled
      />,
    );

    expect(screen.getByTestId('deliverable-summary-table')).toBeTruthy();
    expect(screen.getAllByText(/已完成|已交付/)).toHaveLength(5);
  });

  it.each([
    {
      label: 'complete',
      qualityStatus: { completionState: 'complete', qualityCompletion: 'passed' },
      expected: '质量验收通过',
    },
    {
      label: 'official media degraded',
      qualityStatus: {
        completionState: 'accepted_partial',
        partialReason: 'official_media_degraded',
        qualityCompletion: 'degraded_acceptable',
      },
      expected: '已接受部分成果 · 官方素材已降级',
    },
    {
      label: 'user acknowledged',
      qualityStatus: {
        completionState: 'accepted_partial',
        partialReason: 'user_acknowledged',
        qualityCompletion: 'not_applicable',
      },
      expected: '已按您的确认验收',
    },
    {
      label: 'blocked',
      qualityStatus: {
        completionState: 'blocked',
        blockedReasonType: 'system_exhausted',
        qualityCompletion: 'blocked',
      },
      expected: '质量验收受阻',
    },
  ] as const)('shows final quality status for $label', ({ qualityStatus, expected }) => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        unifiedRowsOverride={[{
          id: 'report',
          label: '报告',
          path: 'artifacts/report.md',
          status: 'delivered',
          resolvedPath: 'artifacts/report.md',
          previewable: true,
          linkable: true,
        }]}
        qualityStatus={qualityStatus}
        validationSettled
        forceShow
      />,
    );

    expect(screen.getByTestId('deliverable-quality-status').textContent).toContain(expected);
  });
});
