import { describe, expect, it } from 'vitest';
import {
  filterCollectionPreviewPaths,
  shouldIncludeInCollectionPreview,
} from './collectionPreviewPaths';
import { shouldShowTextSnippetInCollectionThumb } from './collectionThumbPolicy';

describe('collectionPreviewPaths', () => {
  it('hides internal manifests and code files from the collection matrix', () => {
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/_manifest.json')).toBe(false);
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/slide-manifest.json')).toBe(false);
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/build.js')).toBe(false);
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/config.json')).toBe(false);
  });

  it('keeps user-facing deliverables visible', () => {
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/01-topics.md')).toBe(true);
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/main-visual.png')).toBe(true);
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/index.html')).toBe(true);
    expect(shouldIncludeInCollectionPreview('artifacts/campaign/brief.docx')).toBe(true);
  });

  it('filters sibling lists before rendering the matrix', () => {
    const filtered = filterCollectionPreviewPaths([
      'artifacts/campaign/_manifest.json',
      'artifacts/campaign/image-3x4.png',
      'artifacts/campaign/01-topics.md',
      'artifacts/campaign/tmp-export.mjs',
    ]);
    expect(filtered).toEqual([
      'artifacts/campaign/image-3x4.png',
      'artifacts/campaign/01-topics.md',
    ]);
  });
});

describe('collectionThumbPolicy', () => {
  it('allows markdown/text snippets only for prose files', () => {
    expect(shouldShowTextSnippetInCollectionThumb('01-topics.md')).toBe(true);
    expect(shouldShowTextSnippetInCollectionThumb('notes.txt')).toBe(true);
    expect(shouldShowTextSnippetInCollectionThumb('_manifest.json')).toBe(false);
  });
});
