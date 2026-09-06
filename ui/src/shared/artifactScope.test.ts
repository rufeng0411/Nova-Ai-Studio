import { describe, expect, it } from 'vitest';
import { resolveArtifactScope } from './artifactScope';

describe('artifactScope', () => {
  it('treats any selected slide image as the whole deck scope', () => {
    const scope = resolveArtifactScope({
      activePath: 'artifacts/slides-demo/slide-02.png',
      siblings: [
        'artifacts/slides-demo/slide-manifest.json',
        'artifacts/slides-demo/slide-01.png',
        'artifacts/slides-demo/slide-02.png',
        'artifacts/slides-demo/slide-03.png',
      ],
    });

    expect(scope.semanticKind).toBe('presentation');
    expect(scope.carrierScope).toBe('slide_deck_png');
    expect(scope.scopeRoot).toBe('artifacts/slides-demo');
    expect(scope.manifestPath).toBe('artifacts/slides-demo/slide-manifest.json');
    expect(scope.bundleImagePaths).toEqual([
      'artifacts/slides-demo/slide-01.png',
      'artifacts/slides-demo/slide-02.png',
      'artifacts/slides-demo/slide-03.png',
    ]);
    expect(scope.canBundleExport).toBe(true);
    expect(scope.exportSourcePath).toBe('artifacts/slides-demo/slide-02.png');
  });

  it('keeps pdf, word, and native pptx on the document canvas compatible path', () => {
    expect(resolveArtifactScope({ activePath: 'docs/brief.pdf' })).toMatchObject({
      semanticKind: 'pdf_document',
      carrierScope: 'scan_pdf_image',
      canUseDocumentCanvas: true,
      canBundleExport: false,
    });
    expect(resolveArtifactScope({ activePath: 'docs/brief.docx' })).toMatchObject({
      semanticKind: 'word_document',
      carrierScope: 'existing_docx',
      canUseDocumentCanvas: true,
      canBundleExport: false,
    });
    expect(resolveArtifactScope({ activePath: 'decks/brief.pptx' })).toMatchObject({
      semanticKind: 'presentation',
      carrierScope: 'slide_native_pptx',
      canUseDocumentCanvas: true,
      canBundleExport: false,
    });
  });

  it('recognizes image albums as collection scopes without pretending they are slide decks', () => {
    const scope = resolveArtifactScope({
      activePath: 'artifacts/posters/a.png',
      siblings: ['artifacts/posters/a.png', 'artifacts/posters/b.png'],
    });
    expect(scope.semanticKind).toBe('image_collection');
    expect(scope.carrierScope).toBe('image_album');
    expect(scope.bundleImagePaths).toEqual(['artifacts/posters/a.png', 'artifacts/posters/b.png']);
    expect(scope.canBundleExport).toBe(true);
  });
});
