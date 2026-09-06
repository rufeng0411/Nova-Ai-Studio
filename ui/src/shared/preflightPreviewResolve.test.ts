import { describe, expect, it } from 'vitest';
import { resolvePreflightPreviewSources } from './preflightPreviewResolve';

describe('preflightPreviewResolve', () => {
  const item = {
    id: 'linear-app',
    label: 'Linear',
    previewUrl: '/api/launch/static/open-design/linear-app.html',
    previewThumbUrl: '/api/launch/static/open-design/thumbs/linear-app.webp',
    previewImageUrl: '/api/launch/static/open-design/detail/linear-app.webp',
  };

  it('card prefers thumb webp and never iframe', () => {
    expect(resolvePreflightPreviewSources(item, 'od', 'card')).toEqual({
      previewUrl: null,
      previewImageUrl: item.previewThumbUrl,
    });
  });

  it('detail prefers detail webp over iframe', () => {
    expect(resolvePreflightPreviewSources(item, 'od', 'detail')).toEqual({
      previewUrl: null,
      previewImageUrl: item.previewImageUrl,
    });
  });

  it('detail falls back to iframe when no raster', () => {
    expect(resolvePreflightPreviewSources({ id: 'x', label: 'X', previewUrl: item.previewUrl }, 'od', 'detail')).toEqual({
      previewUrl: item.previewUrl,
      previewImageUrl: null,
    });
  });
});
