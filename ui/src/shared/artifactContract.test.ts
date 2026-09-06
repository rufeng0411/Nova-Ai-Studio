import { describe, expect, it } from 'vitest';
import {
  artifactContractFromCanvasManifest,
  artifactContractFromManifest,
  artifactContractFromSlideSiblings,
  inferArtifactContract,
  resolveSuperPreviewAdapter,
} from './artifactContract';

describe('artifactContract', () => {
  it('maps slide-manifest image decks to presentation semantics', () => {
    const contract = artifactContractFromManifest({
      manifestPath: 'artifacts/slides-demo/slide-manifest.json',
      manifest: {
        deck_title: '新品发布会',
        aspect_ratio: '16:9',
        page_count: 2,
        pages: [
          {
            page_index: 2,
            title: '结尾',
            points: ['收束'],
            page_description: '结尾页',
            image_path: 'slide-02.png',
            status: 'completed',
          },
          {
            page_index: 1,
            title: '开场',
            points: ['亮点'],
            page_description: '开场页',
            image_path: 'slide-01.png',
            status: 'completed',
          },
        ],
      },
    });

    expect(contract).not.toBeNull();
    if (!contract) throw new Error('contract should be created from slide manifest');
    expect(contract?.artifactSemanticKind).toBe('presentation');
    expect(contract?.carrierScope).toBe('slide_deck_png');
    expect(contract?.title).toBe('新品发布会');
    expect(contract?.pages.map((page) => page.previewPath)).toEqual([
      'artifacts/slides-demo/slide-01.png',
      'artifacts/slides-demo/slide-02.png',
    ]);
    expect(resolveSuperPreviewAdapter(contract)).toBe('ppt');
  });

  it('builds slide deck pages from sibling PNGs when manifest is unavailable', () => {
    const contract = artifactContractFromSlideSiblings('artifacts/slides-ai-business-growth/slide-01.png', [
      'artifacts/slides-ai-business-growth/slide-manifest.json',
      'artifacts/slides-ai-business-growth/slide-01.png',
      'artifacts/slides-ai-business-growth/slide-02.png',
    ]);

    expect(contract).not.toBeNull();
    if (!contract) throw new Error('contract should be inferred from sibling slide PNGs');
    expect(contract.pages).toHaveLength(2);
    expect(contract.pages.map((page) => page.previewPath)).toEqual([
      'artifacts/slides-ai-business-growth/slide-01.png',
      'artifacts/slides-ai-business-growth/slide-02.png',
    ]);
    expect(resolveSuperPreviewAdapter(contract)).toBe('ppt');
  });

  it('builds slide deck from artifacts/task-* siblings (STDA layout)', () => {
    const dir = 'artifacts/task-20260717-c633f996';
    const contract = artifactContractFromSlideSiblings(`${dir}/slide-02.png`, [
      `${dir}/slide-manifest.json`,
      `${dir}/slide-01.png`,
      `${dir}/slide-02.png`,
      `${dir}/gen_slides.py`,
    ]);
    expect(contract).not.toBeNull();
    expect(contract?.pages).toHaveLength(2);
    expect(resolveSuperPreviewAdapter(contract!)).toBe('ppt');
  });

  it('infers html slides as presentation when scope says slide_deck_html', () => {
    const contract = inferArtifactContract({
      filePath: 'artifacts/slides-demo/index.html',
      carrierScope: 'slide_deck_html',
    });

    expect(contract.artifactSemanticKind).toBe('presentation');
    expect(contract.carrierScope).toBe('slide_deck_html');
    expect(resolveSuperPreviewAdapter(contract)).toBe('ppt');
  });

  it('keeps plain report markdown as universal markdown unless intent says Word', () => {
    const report = inferArtifactContract({
      filePath: 'artifacts/research/report.md',
      carrierScope: 'report_markdown',
    });
    const word = inferArtifactContract({
      filePath: 'artifacts/research/report.md',
      carrierScope: 'report_markdown',
      sourceIntent: { declaredOutput: 'Word 文档' },
    });

    expect(report.artifactSemanticKind).toBe('generic_document');
    expect(resolveSuperPreviewAdapter(report)).toBe('markdownText');
    expect(word.artifactSemanticKind).toBe('word_document');
    expect(resolveSuperPreviewAdapter(word)).toBe('word');
  });

  it('maps geo visibility-report html to web preview (not raw text)', () => {
    const contract = inferArtifactContract({
      filePath: 'artifacts/geo/nike-worldcup-2026/visibility-report.html',
      carrierScope: 'geo_bundle',
    });

    expect(contract.artifactSemanticKind).toBe('generic_document');
    expect(contract.carrierScope).toBe('geo_bundle');
    expect(resolveSuperPreviewAdapter(contract)).toBe('web');
  });

  it('maps canvas-manifest to design_canvas board contract', () => {
    const contract = artifactContractFromCanvasManifest({
      manifestPath: 'artifacts/canvas-demo/canvas-manifest.json',
      manifest: {
        schema_version: 1,
        board_id: 'canvas-demo',
        title: 'Campaign Board',
        nodes: [
          { id: 'n1', type: 'image', path: 'assets/hero.png', x: 0, y: 0 },
        ],
      },
    });
    expect(contract?.carrierScope).toBe('design_canvas_board');
    expect(contract?.artifactSemanticKind).toBe('design_canvas');
    expect(resolveSuperPreviewAdapter(contract!)).toBe('designCanvas');
    expect(contract?.primaryPaths).toEqual(['artifacts/canvas-demo/assets/hero.png']);
  });
});
