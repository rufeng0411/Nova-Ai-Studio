// PD-SAAS-FORK: tiered image search fallback for product/landing pages

export type ImageFallbackTier = 0 | 1 | 2 | 3 | 4;

export type ImageSearchFallbackInput = {
  brand?: string;
  product?: string;
  officialUrl?: string;
  fallbackTier?: ImageFallbackTier;
};

export type ImageSearchFallbackResult = {
  tier: ImageFallbackTier;
  images: string[];
  triedUrls: string[];
  placeholderRecommended: boolean;
};

const PLACEHOLDER_HTML_SNIPPET = `<figure class="img-placeholder" data-source="pending">
  <div class="img-placeholder__frame" role="img" aria-label="图源待补"></div>
  <figcaption>图源待补：官网未提供可用图片，请稍后替换为正式素材。</figcaption>
</figure>`;

export function getPlaceholderHtmlSnippet(): string {
  return PLACEHOLDER_HTML_SNIPPET;
}

/** Build candidate URLs for L1–L2 (heuristic; agent may refine via web_search). */
export function buildFallbackCandidateUrls(input: ImageSearchFallbackInput): string[] {
  const urls: string[] = [];
  const official = String(input.officialUrl || '').trim();
  if (official) urls.push(official);

  const brand = String(input.brand || '').trim();
  const product = String(input.product || '').trim();
  if (!brand && !product) return urls;

  const slug = [brand, product].filter(Boolean).join(' ').replace(/\s+/g, '-').toLowerCase();
  if (slug) {
    urls.push(`https://www.${slug}.com/`);
  }
  return [...new Set(urls)];
}

export function resolveImageSearchFallback(
  input: ImageSearchFallbackInput,
  fetchResult?: { images?: string[]; error?: string },
): ImageSearchFallbackResult {
  const startTier = (input.fallbackTier ?? 0) as ImageFallbackTier;
  const triedUrls = buildFallbackCandidateUrls(input);
  const images = Array.isArray(fetchResult?.images)
    ? fetchResult.images.filter((u) => typeof u === 'string' && u.startsWith('http'))
    : [];

  if (images.length > 0) {
    return { tier: startTier, images, triedUrls, placeholderRecommended: false };
  }

  const nextTier = Math.min(4, startTier + 1) as ImageFallbackTier;
  if (nextTier >= 4) {
    return {
      tier: 4,
      images: [],
      triedUrls,
      placeholderRecommended: true,
    };
  }

  return {
    tier: nextTier,
    images: [],
    triedUrls,
    placeholderRecommended: nextTier >= 3,
  };
}
