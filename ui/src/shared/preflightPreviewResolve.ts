// PD-SAAS-FORK: Preflight preview source — lightweight WebP thumbs, no heavy PNG/iframe on cards
import type { PreflightCatalogEntry } from './preflightSelection';
import type { PreflightThumbKind } from './preflightThumbRender';

export type PreflightPreviewVariant = 'card' | 'detail';

/**
 * Cards: previewThumbUrl (≈400×250 WebP) only — never multi-MB PNG or iframe.
 * Detail: previewImageUrl (≈960 WebP) → previewThumbUrl → iframe HTML fallback.
 */
export function resolvePreflightPreviewSources(
  item: PreflightCatalogEntry,
  _kind: PreflightThumbKind,
  variant: PreflightPreviewVariant = 'card',
): { previewUrl: string | null; previewImageUrl: string | null } {
  const thumb = item.previewThumbUrl ?? null;
  const detail = item.previewImageUrl ?? null;
  const iframe = item.previewUrl ?? null;

  if (variant === 'card') {
    return {
      previewUrl: null,
      previewImageUrl: thumb ?? detail ?? null,
    };
  }

  return {
    previewUrl: detail || thumb ? null : iframe,
    previewImageUrl: detail ?? thumb ?? null,
  };
}
