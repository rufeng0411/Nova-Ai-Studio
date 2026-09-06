import { describe, expect, it } from 'vitest';
import type { DeliverableItem } from '../../shared/collectDeliverables';
import { mergeDeliverablesByCanonicalPath } from '../../shared/mergeDeliverablesByCanonicalPath';

function item(path: string, kind: DeliverableItem['kind'] = 'html'): DeliverableItem {
  return {
    id: `${kind}:${path}`,
    path,
    apiPath: path,
    kind,
    source: 'tool',
  };
}

describe('MessageRowV2 deliverable merge', () => {
  it('does not let persisted meta append unanchored helper files when final curation has a primary html', () => {
    const dir = 'artifacts/magazine-razer-blade-tu-du-2026-0623';
    const merged = mergeDeliverablesByCanonicalPath(
      [item(`${dir}/index.html`, 'html')],
      [
        item(`${dir}/index.html`, 'html'),
        item(`${dir}/platforms.md`, 'document'),
      ],
    );

    expect(merged.map((entry) => entry.path)).toEqual([`${dir}/index.html`]);
  });

  it('uses persisted meta as a fallback when no curated deliverables exist', () => {
    const dir = 'artifacts/magazine-razer-blade-tu-du-2026-0623';
    const merged = mergeDeliverablesByCanonicalPath(
      [],
      [item(`${dir}/index.html`, 'html')],
    );

    expect(merged.map((entry) => entry.path)).toEqual([`${dir}/index.html`]);
  });
});
