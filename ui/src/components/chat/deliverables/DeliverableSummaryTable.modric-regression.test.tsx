// @vitest-environment jsdom
/**
 * PD-SAAS-FORK: Modric / 品牌官网 / Campaign 交付汇总表回归 — 复现「一律未完成」修复验收。
 */
import { cleanup, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { renderWithProviders } from '../../../test/renderWithProviders';
import DeliverableSummaryTable from './DeliverableSummaryTable';

vi.mock('./DeliverablePreviewOverlay', () => ({
  default: () => null,
}));

vi.mock('./DeliverableSummaryInlinePreview', () => ({
  default: () => null,
}));

import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const fixtureDir = path.join(repoRoot, 'tests/fixtures/deliverable-summary');

function loadFixture(name: string) {
  return JSON.parse(readFileSync(path.join(fixtureDir, name), 'utf8'));
}

function toItem(raw: { path: string; kind?: string; validationStatus?: string }): DeliverableItem {
  return {
    id: `document:${raw.path}`,
    path: raw.path,
    apiPath: raw.path,
    resolvedPath: raw.path,
    kind: (raw.kind as DeliverableItem['kind']) ?? 'document',
    source: 'tool',
    ...(raw.validationStatus ? { validationStatus: raw.validationStatus } : {}),
  } as DeliverableItem;
}

afterEach(() => {
  cleanup();
});

describe('DeliverableSummaryTable Modric regression', () => {
  it('MOD-01 brand website kind-only SDM slots show 已交付 with real files', () => {
    const fx = loadFixture('modric-brand-website-kind-slots.json');
    const items = fx.items.map(toItem);

    renderWithProviders(
      <DeliverableSummaryTable
        items={items}
        expectedManifest={fx.expectedManifest}
        validationSettled
        forceShow
        preferManifestLabels
      />,
    );

    expect(screen.getAllByText(/已完成|已交付/)).toHaveLength(fx.expectDeliveredCount);
    expect(screen.queryByText(/未完成|需继续/)).toBeNull();
    expect(screen.getAllByText('index.html').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('brand-brief.md').length).toBeGreaterThanOrEqual(1);
  });

  it('MOD-02 campaign partial delivery shows mixed 已交付 / 需继续', () => {
    const fx = loadFixture('modric-campaign-partial.json');
    const items = fx.items.map(toItem);

    renderWithProviders(
      <DeliverableSummaryTable
        items={items}
        expectedManifest={fx.expectedManifest}
        validationSettled
        forceShow
        preferManifestLabels
      />,
    );

    const delivered = screen.getAllByText(/已完成|已交付/);
    expect(delivered.length).toBeGreaterThanOrEqual(fx.expectDeliveredMin);
    const incomplete = screen.queryAllByText(/未完成|需继续/);
    expect(incomplete.length).toBeGreaterThanOrEqual(fx.expectMissingMin);
    expect(screen.getByText(/调研|competitive brief/i)).toBeTruthy();
  });

  it('MOD-03 audience profile verifiedPaths without items still shows 已交付', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        expectedManifest={[{ id: 'required_markdown_1', label: 'markdown', kind: 'markdown' }]}
        verifiedPaths={['artifacts/audience-profile/modric-fans-personas.md']}
        validationSettled
        forceShow
      />,
    );

    expect(screen.getByText(/已完成|已交付/)).toBeTruthy();
    expect(screen.getAllByText('modric-fans-personas.md').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/未完成|需继续/)).toBeNull();
  });

  it('MOD-04 historical acceptance rows win over empty kind slots (fallback)', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[toItem({
          path: 'artifacts/co-branding/adidas-modric-plan.md',
          validationStatus: 'verified',
        })]}
        acceptanceRows={[
          {
            id: 'delivered:artifacts/co-branding/adidas-modric-plan.md',
            label: '联名方案',
            path: 'artifacts/co-branding/adidas-modric-plan.md',
            status: 'delivered',
          },
        ]}
        validationSettled
      />,
    );

    expect(screen.getByText(/已完成|已交付/)).toBeTruthy();
    expect(screen.queryByText(/未完成|需继续/)).toBeNull();
  });

  it('MOD-05 assistant text path fallback when kind slots have no files', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        expectedManifest={[
          { id: 'required_html_1', label: 'html', kind: 'html' },
          { id: 'required_markdown_1', label: 'markdown', kind: 'markdown' },
        ]}
        assistantText="交付物：artifacts/modric-legend/modric-legend-brief.md"
        validationSettled={false}
        forceShow
      />,
    );

    expect(screen.getAllByText(/modric legend brief/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/校验中…|Checking…/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/^html$/)).toBeNull();
  });
});
