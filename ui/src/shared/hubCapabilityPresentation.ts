/**
 * PD-SAAS-FORK: Hub 展示序 — Nova 置顶、同名归并代表项
 */

/** Nova 产品序（组内靠前；「Nova 系列」固定顺序） */
export const NOVA_HUB_ORDER = [
  'nova-research-general',
  'nova-research-user-general',
  'nova-research-industry-market',
  'nova-research-product-user',
  'nova-research-competitor',
  'nova-research-academic-professional',
  'nova-ppt-aesthetic-slides',
  'nova-customer-acquisition-leads',
  'nova-bento-slides',
] as const;

export function isNovaHubCapability(slug: string): boolean {
  return Boolean(slug) && slug.startsWith('nova-');
}

/** 越小越靠前；非 Nova = 1000 */
export function novaHubRank(slug: string): number {
  if (!slug) return 1000;
  const idx = (NOVA_HUB_ORDER as readonly string[]).indexOf(slug);
  if (idx >= 0) return idx;
  if (slug.startsWith('nova-')) return NOVA_HUB_ORDER.length;
  return 1000;
}

/** 同名归并用的规范化键（忽略空白/间隔号/括号说明） */
export function normalizeHubDisplayName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[\s·・．.﹣_\-]+/g, '')
    .trim();
}

export type HubRepresentativeScoreable = {
  slug?: string;
  hub_pinned?: boolean;
  hub_recommend_stars?: number;
  hub_sort?: number;
};

/**
 * 同名簇内选「最具代表性」：必留 > Nova > 非 *-skills-* 副本 > 星级 > hub_sort > 短 slug
 */
export function compareHubRepresentative(a: HubRepresentativeScoreable, b: HubRepresentativeScoreable): number {
  const pinA = a.hub_pinned === true ? 0 : 1;
  const pinB = b.hub_pinned === true ? 0 : 1;
  if (pinA !== pinB) return pinA - pinB;

  const slugA = a.slug || '';
  const slugB = b.slug || '';
  const novaA = novaHubRank(slugA);
  const novaB = novaHubRank(slugB);
  if (novaA !== novaB) return novaA - novaB;

  const skillsA = /(?:^|-)skills(?:-|$)/.test(slugA) || slugA.includes('-brand-skills-') ? 1 : 0;
  const skillsB = /(?:^|-)skills(?:-|$)/.test(slugB) || slugB.includes('-brand-skills-') ? 1 : 0;
  if (skillsA !== skillsB) return skillsA - skillsB;

  const starsA = typeof a.hub_recommend_stars === 'number' ? 6 - a.hub_recommend_stars : 99;
  const starsB = typeof b.hub_recommend_stars === 'number' ? 6 - b.hub_recommend_stars : 99;
  if (starsA !== starsB) return starsA - starsB;

  const sortA = typeof a.hub_sort === 'number' ? a.hub_sort : 999;
  const sortB = typeof b.hub_sort === 'number' ? b.hub_sort : 999;
  if (sortA !== sortB) return sortA - sortB;

  if (slugA.length !== slugB.length) return slugA.length - slugB.length;
  return slugA.localeCompare(slugB);
}
