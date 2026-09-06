import { describe, expect, it } from 'vitest';
import { novaHubRank, normalizeHubDisplayName } from './hubCapabilityPresentation.js';
import { splitHubSectionItems } from './hubPinnedSections.js';

describe('hubCapabilityPresentation / hubPinnedSections', () => {
  it('ranks Nova series ahead of non-Nova', () => {
    expect(novaHubRank('nova-research-general')).toBeLessThan(novaHubRank('mkt-customer-research'));
    expect(novaHubRank('nova-bento-slides')).toBeLessThan(novaHubRank('open-design'));
  });

  it('keeps Nova product order', () => {
    expect(novaHubRank('nova-research-general')).toBeLessThan(
      novaHubRank('nova-customer-acquisition-leads'),
    );
  });

  it('collapses same display name into 显示更多 when no hub_pinned', () => {
    const items = [
      { slug: 'mkt-brand-brand-discovery', hub_recommend_stars: 4 },
      { slug: 'mkt-brand-skills-brand-discovery', hub_recommend_stars: 3 },
      { slug: 'open-design', hub_recommend_stars: 5 },
    ];
    const split = splitHubSectionItems(items, {
      getDisplayName: (item) =>
        item.slug.includes('brand-discovery') ? '品牌站·品牌发现' : '设计总控',
    });
    expect(split.collapseActive).toBe(true);
    expect(split.pinned.map((i) => i.slug)).toEqual([
      'mkt-brand-brand-discovery',
      'open-design',
    ]);
    expect(split.secondary.map((i) => i.slug)).toEqual([
      'mkt-brand-skills-brand-discovery',
    ]);
  });

  it('prefers non-skills slug as representative', () => {
    const items = [
      { slug: 'mkt-brand-skills-creative-brief', hub_recommend_stars: 5 },
      { slug: 'mkt-brand-creative-brief', hub_recommend_stars: 4 },
    ];
    const split = splitHubSectionItems(items, {
      getDisplayName: () => '品牌站·创意Brief',
    });
    expect(split.pinned[0]?.slug).toBe('mkt-brand-creative-brief');
    expect(split.secondary[0]?.slug).toBe('mkt-brand-skills-creative-brief');
  });

  it('normalizes display names for clustering', () => {
    expect(normalizeHubDisplayName('HF·专项')).toBe(normalizeHubDisplayName('HF 专项'));
  });
});
