import { describe, expect, it } from 'vitest';
import {
  expandExpectedManifestSlideCount,
  inferNovaSlidePagesFromPaths,
  parseSlideManifestPages,
} from './slideManifestExpand';

describe('slideManifestExpand', () => {
  const turnDir = 'artifacts/slides-argentina';

  it('parses slide-manifest pages with image_path', () => {
    const pages = parseSlideManifestPages({
      pages: [
        { page: 1, image_path: 'slide-01.png', title: '封面' },
        { page: 2, image_path: 'slide-02.png' },
      ],
    }, turnDir);
    expect(pages).toHaveLength(2);
    expect(pages[0].path).toBe(`${turnDir}/slide-01.png`);
    expect(pages[0].title).toBe('封面');
  });

  it('infers missing slots up to expected count', () => {
    const pages = inferNovaSlidePagesFromPaths(
      turnDir,
      [`${turnDir}/slide-01.png`, `${turnDir}/slide-02.png`, `${turnDir}/slide-03.png`],
      6,
    );
    expect(pages).toHaveLength(6);
    expect(pages[5].path).toBe(`${turnDir}/slide-06.png`);
  });

  it('expands expectedManifest count entries', () => {
    const pages = expandExpectedManifestSlideCount(
      [{ id: 'required_png', kind: 'png', count: 4, required: true }],
      turnDir,
    );
    expect(pages).toHaveLength(4);
  });
});
