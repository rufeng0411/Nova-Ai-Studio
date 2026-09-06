// PD-SAAS-FORK: HyperFrames Hub V2 vs legacy card visibility

export const LEGACY_HF_HUB_SLUGS = new Set([
  'hf-website-to-video',
  'hf-hyperframes',
  'hf-hyperframes-cli',
  'hf-hyperframes-media',
  'hf-gsap',
]);

export const NEW_HF_HUB_PRIMARY_SLUGS = new Set([
  'hf-hyperframes',
  'hf-product-launch-video',
  'hf-motion-graphics',
  'hf-general-video',
  'hf-faceless-explainer',
  'hf-slideshow',
]);

export function shouldShowHyperframesHubCapability(
  slug: string,
  hiddenInHub: boolean,
  hubV2Enabled: boolean,
  adminMode = false,
): boolean {
  if (adminMode) return true;
  const normalized = String(slug ?? '').trim().toLowerCase();
  if (!normalized.startsWith('hf-')) {
    return !hiddenInHub;
  }
  if (hubV2Enabled) {
    if (LEGACY_HF_HUB_SLUGS.has(normalized)) return false;
    return !hiddenInHub;
  }
  if (NEW_HF_HUB_PRIMARY_SLUGS.has(normalized) && !LEGACY_HF_HUB_SLUGS.has(normalized)) {
    return false;
  }
  if (LEGACY_HF_HUB_SLUGS.has(normalized)) return true;
  return !hiddenInHub;
}
