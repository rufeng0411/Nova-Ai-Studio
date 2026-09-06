/**
 * PD-SAAS-FORK: 与 ui/src/shared/hubCapabilityPresentation.ts 同源（catalog 生成侧）
 */

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
];

export function isNovaHubCapability(slug) {
  return Boolean(slug) && String(slug).startsWith('nova-');
}

export function novaHubRank(slug) {
  if (!slug) return 1000;
  const idx = NOVA_HUB_ORDER.indexOf(slug);
  if (idx >= 0) return idx;
  if (String(slug).startsWith('nova-')) return NOVA_HUB_ORDER.length;
  return 1000;
}
