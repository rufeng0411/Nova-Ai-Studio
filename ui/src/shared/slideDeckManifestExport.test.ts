import { describe, expect, it } from 'vitest';
import { bundleImagePathsFromManifest } from '../../server/saas/export/slideDeckManifest.mjs';

describe('slideDeckManifest export paths', () => {
  it('reads ordered pages from Nova slide-manifest.json', () => {
    const manifest = {
      page_count: 8,
      pages: [
        { page_index: 2, image_path: 'artifacts/slides-rog-dashao-you/slide-02.png' },
        { page_index: 1, image_path: 'artifacts/slides-rog-dashao-you/slide-01.png' },
        { page_index: 8, image_path: 'slide-08.png' },
      ],
    };
    const paths = bundleImagePathsFromManifest(manifest, 'artifacts/slides-rog-dashao-you');
    expect(paths).toEqual([
      'artifacts/slides-rog-dashao-you/slide-01.png',
      'artifacts/slides-rog-dashao-you/slide-02.png',
      'artifacts/slides-rog-dashao-you/slide-08.png',
    ]);
  });
});
