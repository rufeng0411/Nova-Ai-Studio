import { describe, expect, it } from 'vitest';
import {
  applyValidatedDeliverablePaths,
  buildValidatedDeliverableSet,
  dedupeValidatedByPriority,
  filterDisplayDeliverables,
  rankDeliverableSource,
  shouldDisplayValidatedDeliverable,
  type ValidatedDeliverable,
} from './validateDeliverables';
import type { DeliverableItem } from './collectDeliverables';

describe('validateDeliverables', () => {
  it('ranks tool source above text', () => {
    expect(rankDeliverableSource('tool')).toBeGreaterThan(rankDeliverableSource('text'));
  });

  it('dedupes by basename keeping verified tool item', () => {
    const items: ValidatedDeliverable[] = [
      { id: '1', path: 'report.md', apiPath: 'report.md', kind: 'file', source: 'text', validationStatus: 'phantom' },
      { id: '2', path: 'artifacts/report.md', apiPath: 'artifacts/report.md', kind: 'file', source: 'tool', validationStatus: 'verified' },
    ];
    const deduped = dedupeValidatedByPriority(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].source).toBe('tool');
    expect(deduped[0].validationStatus).toBe('verified');
  });

  it('dedupes slide deck deliverables by full path, not basename only', () => {
    const items: ValidatedDeliverable[] = [
      {
        id: '1',
        path: 'artifacts/slides-ming-arch/slide-manifest.json',
        apiPath: 'artifacts/slides-ming-arch/slide-manifest.json',
        kind: 'code',
        source: 'text',
        validationStatus: 'verified',
      },
      {
        id: '2',
        path: 'artifacts/slides-ai-business/slide-manifest.json',
        apiPath: 'artifacts/slides-ai-business/slide-manifest.json',
        kind: 'code',
        source: 'tool',
        validationStatus: 'verified',
      },
    ];
    const deduped = dedupeValidatedByPriority(items);
    expect(deduped).toHaveLength(2);
  });

  it('builds display set from verified items while preserving folder set and resolved paths', () => {
    const raw: DeliverableItem[] = [
      { id: '1', path: 'index.html', apiPath: 'index.html', kind: 'file', source: 'text' },
      { id: '2', path: 'missing.pdf', apiPath: 'missing.pdf', kind: 'file', source: 'text' },
    ];
    const validated: ValidatedDeliverable[] = [
      {
        ...raw[0],
        path: 'artifacts/campaign/demo/index.html',
        apiPath: 'artifacts/campaign/demo/index.html',
        resolvedPath: 'artifacts/campaign/demo/index.html',
        validationStatus: 'verified',
      },
      {
        ...raw[1],
        validationStatus: 'broken',
      },
    ];

    const set = buildValidatedDeliverableSet(raw, validated);

    expect(set.displayItems.map((item) => item.apiPath)).toEqual([
      'artifacts/campaign/demo/index.html',
    ]);
    expect(set.folderItems.map((item) => item.apiPath)).toContain('missing.pdf');
    expect(set.resolvedItems[0]).toMatchObject({
      logicalPath: 'index.html',
      resolvedPath: 'artifacts/campaign/demo/index.html',
      hintDir: 'artifacts/campaign/demo',
      status: 'verified',
    });
    expect(set.filteredCount).toBe(0);
  });

  it('soft-displays broken tool deliverables as softVerified when disk path was resolved', () => {
    const item: ValidatedDeliverable = {
      id: '1',
      path: 'index.html',
      apiPath: 'index.html',
      kind: 'html',
      source: 'tool',
      validationStatus: 'softVerified',
      resolvedPath: 'artifacts/campaign/demo/index.html',
    };
    expect(shouldDisplayValidatedDeliverable(item)).toBe(true);
    const displayed = filterDisplayDeliverables([item]);
    expect(displayed).toHaveLength(1);
    expect(displayed[0].apiPath).toBe('artifacts/campaign/demo/index.html');
  });

  it('shows pending tool deliverables with resolvedPath in display set', () => {
    const item: ValidatedDeliverable = {
      id: '1',
      path: 'artifacts/slides-argentina/slide-01.png',
      apiPath: 'artifacts/slides-argentina/slide-01.png',
      kind: 'image',
      source: 'tool',
      validationStatus: 'pending',
      resolvedPath: 'artifacts/slides-argentina/slide-01.png',
    };
    expect(shouldDisplayValidatedDeliverable(item)).toBe(true);
    expect(filterDisplayDeliverables([item])).toHaveLength(1);
  });

  it('hides pure broken deliverables without resolvedPath from completed display', () => {
    const item: ValidatedDeliverable = {
      id: '1',
      path: 'artifacts/design/demo/index.html',
      apiPath: 'artifacts/design/demo/index.html',
      kind: 'html',
      source: 'tool',
      validationStatus: 'broken',
    };
    expect(shouldDisplayValidatedDeliverable(item)).toBe(false);
    expect(filterDisplayDeliverables([item])).toHaveLength(0);
  });

  it('dedupes phantom file:// path in favor of verified artifacts path for index.html', () => {
    const items: ValidatedDeliverable[] = [
      {
        id: '1',
        path: 'file:///home/user/index.html',
        apiPath: 'file:///home/user/index.html',
        kind: 'html',
        source: 'tool',
        validationStatus: 'phantom',
      },
      {
        id: '2',
        path: 'index.html',
        apiPath: 'index.html',
        kind: 'html',
        source: 'text',
        validationStatus: 'broken',
      },
      {
        id: '3',
        path: 'artifacts/design/razer-synapse4-ui/index.html',
        apiPath: 'artifacts/design/razer-synapse4-ui/index.html',
        kind: 'html',
        source: 'tool',
        validationStatus: 'verified',
        resolvedPath: 'artifacts/design/razer-synapse4-ui/index.html',
      },
    ];
    const deduped = dedupeValidatedByPriority(items);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].apiPath).toBe('artifacts/design/razer-synapse4-ui/index.html');
    expect(filterDisplayDeliverables(deduped)).toHaveLength(1);
  });

  it('falls back to pending tool artifacts when validation marks all broken', () => {
    const raw: DeliverableItem[] = [
      {
        id: '1',
        path: 'artifacts/design/razer-2026-product-series/index.html',
        apiPath: 'artifacts/design/razer-2026-product-series/index.html',
        kind: 'html',
        source: 'tool',
      },
    ];
    const validated: ValidatedDeliverable[] = [
      {
        ...raw[0],
        validationStatus: 'broken',
      },
    ];
    const set = buildValidatedDeliverableSet(raw, validated);
    expect(set.displayItems).toHaveLength(1);
    expect(set.displayItems[0].apiPath).toBe('artifacts/design/razer-2026-product-series/index.html');
    expect(set.filteredCount).toBe(0);
  });

  it('falls back to root-level React video template artifacts when validation marks all broken', () => {
    const raw: DeliverableItem[] = [
      {
        id: '1',
        path: 'ai-video-template/demo-preview.html',
        apiPath: 'ai-video-template/demo-preview.html',
        kind: 'html',
        source: 'tool',
      },
      {
        id: '2',
        path: 'ai-video-template/src/AiVideoTemplate.tsx',
        apiPath: 'ai-video-template/src/AiVideoTemplate.tsx',
        kind: 'code',
        source: 'tool',
      },
    ];
    const validated: ValidatedDeliverable[] = raw.map((entry) => ({
      ...entry,
      validationStatus: 'broken',
    }));

    const set = buildValidatedDeliverableSet(raw, validated);

    expect(set.displayItems.map((entry) => entry.apiPath)).toContain('ai-video-template/demo-preview.html');
    expect(set.filteredCount).toBeLessThan(raw.length);
  });
});
