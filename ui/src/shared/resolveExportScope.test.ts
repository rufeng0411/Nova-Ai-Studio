import { describe, expect, it } from 'vitest';
import { resolveExportScope, resolveSlideDeckImagePaths } from './resolveExportScope';

describe('resolveExportScope', () => {
  it('detects slide_deck_png from manifest + slide images', () => {
    const dir = 'artifacts/slides-demo';
    const result = resolveExportScope({
      filePath: `${dir}/slide-02.png`,
      siblings: [
        `${dir}/slide-manifest.json`,
        `${dir}/slide-01.png`,
        `${dir}/slide-02.png`,
        `${dir}/slide-03.png`,
        `${dir}/outline.json`,
      ],
    });
    expect(result.scopeId).toBe('slide_deck_png');
    expect(result.bundle).toBe(true);
    expect(result.pageCount).toBe(3);
    expect(result.bundleImagePaths).toEqual([
      `${dir}/slide-01.png`,
      `${dir}/slide-02.png`,
      `${dir}/slide-03.png`,
    ]);
  });

  it('detects slide_deck_png from slides-* directory pattern', () => {
    const result = resolveExportScope({
      filePath: 'artifacts/slides-ming-arch/slide-01.png',
      siblings: ['artifacts/slides-ming-arch/slide-01.png'],
    });
    expect(result.scopeId).toBe('slide_deck_png');
  });

  it('detects slide_deck_png from artifacts/task-* with slide-manifest', () => {
    const dir = 'artifacts/task-20260717-c633f996';
    const result = resolveExportScope({
      filePath: `${dir}/slide-02.png`,
      siblings: [
        `${dir}/slide-manifest.json`,
        `${dir}/slide-01.png`,
        `${dir}/slide-02.png`,
        `${dir}/gen_slides.py`,
      ],
    });
    expect(result.scopeId).toBe('slide_deck_png');
    expect(result.bundleImagePaths).toEqual([
      `${dir}/slide-01.png`,
      `${dir}/slide-02.png`,
    ]);
  });

  it('detects report_markdown', () => {
    const result = resolveExportScope({ filePath: 'artifacts/research/report.md' });
    expect(result.scopeId).toBe('report_markdown');
    expect(result.bundle).toBe(false);
  });

  it('detects report_html', () => {
    const result = resolveExportScope({ filePath: 'artifacts/landing/page.html' });
    expect(result.scopeId).toBe('report_html');
  });

  it('detects bento_deck from .bento.html before deck html', () => {
    const result = resolveExportScope({
      filePath: 'artifacts/task-20260728-abc/deck.bento.html',
      siblings: ['artifacts/task-20260728-abc/deck.bento.html'],
    });
    expect(result.scopeId).toBe('bento_deck');
  });

  it('detects slide_deck_html from deck-like filename', () => {
    const result = resolveExportScope({ filePath: 'artifacts/pitch-deck.html' });
    expect(result.scopeId).toBe('slide_deck_html');
  });

  it('detects geo_bundle under artifacts/geo', () => {
    const result = resolveExportScope({ filePath: 'artifacts/geo/acme/keywords.md' });
    expect(result.scopeId).toBe('geo_bundle');
  });

  it('detects slide_native_pptx outside slide deck directory', () => {
    const result = resolveExportScope({ filePath: 'artifacts/media-smoke/document-canvas/sample-3s.pptx' });
    expect(result.scopeId).toBe('slide_native_pptx');
  });

  it('prefers slide_deck_png when pptx sits beside slide images', () => {
    const dir = 'artifacts/slides-wuyutai';
    const result = resolveExportScope({
      filePath: `${dir}/吴裕泰2026暑期整合营销方案.pptx`,
      siblings: [
        `${dir}/slide-manifest.json`,
        `${dir}/slide-01.png`,
        `${dir}/slide-02.png`,
        `${dir}/slide-03.png`,
      ],
    });
    expect(result.scopeId).toBe('slide_deck_png');
    expect(result.bundleImagePaths).toEqual([
      `${dir}/slide-01.png`,
      `${dir}/slide-02.png`,
      `${dir}/slide-03.png`,
    ]);
  });

  it('detects design_canvas_board from canvas-manifest.json', () => {
    const dir = 'artifacts/canvas-demo';
    const result = resolveExportScope({
      filePath: `${dir}/canvas-manifest.json`,
      siblings: [`${dir}/canvas-manifest.json`, `${dir}/hero.png`],
    });
    expect(result.scopeId).toBe('design_canvas_board');
    expect(result.bundle).toBe(true);
    expect(result.bundleImagePaths).toEqual([`${dir}/hero.png`]);
  });

  it('prefers design_canvas_board over image_album when manifest present', () => {
    const dir = 'artifacts/canvas-album';
    const result = resolveExportScope({
      filePath: `${dir}/a.png`,
      siblings: [`${dir}/canvas-manifest.json`, `${dir}/a.png`, `${dir}/b.png`],
    });
    expect(result.scopeId).toBe('design_canvas_board');
  });

  it('detects spreadsheet', () => {
    expect(resolveExportScope({ filePath: 'data/sales.csv' }).scopeId).toBe('spreadsheet');
    expect(resolveExportScope({ filePath: 'data/sales.xlsx' }).scopeId).toBe('spreadsheet');
  });

  it('returns none for single generated image (download only)', () => {
    const result = resolveExportScope({ filePath: 'artifacts/hero.png', siblings: ['artifacts/hero.png'] });
    expect(result.scopeId).toBe('none');
  });

  it('detects scan_pdf_image for single-page scan pdf', () => {
    const result = resolveExportScope({ filePath: 'artifacts/scan.pdf', siblings: ['artifacts/scan.pdf'] });
    expect(result.scopeId).toBe('scan_pdf_image');
  });

  it('detects image_album for multiple images without manifest', () => {
    const dir = 'artifacts/posters';
    const result = resolveExportScope({
      filePath: `${dir}/a.png`,
      siblings: [`${dir}/a.png`, `${dir}/b.png`, `${dir}/c.png`],
    });
    expect(result.scopeId).toBe('image_album');
    expect(result.bundle).toBe(true);
    expect(result.pageCount).toBe(3);
  });

  it('detects existing_docx', () => {
    expect(resolveExportScope({ filePath: 'report.docx' }).scopeId).toBe('existing_docx');
  });

  it('detects video_media', () => {
    expect(resolveExportScope({ filePath: 'artifacts/out.mp4' }).scopeId).toBe('video_media');
  });

  it('detects archive_code for zip', () => {
    expect(resolveExportScope({ filePath: 'bundle.zip' }).scopeId).toBe('archive_code');
  });

  it('returns none for empty path', () => {
    expect(resolveExportScope({ filePath: '' }).scopeId).toBe('none');
  });

  it('resolveSlideDeckImagePaths uses deck PNGs for pptx in slides dir even when bundle=false', () => {
    const dir = 'artifacts/slides-wuyutai';
    const scope = resolveExportScope({
      filePath: `${dir}/deck.pptx`,
      siblings: [`${dir}/slide-01.png`, `${dir}/slide-02.png`, `${dir}/deck.pptx`],
    });
    const paths = resolveSlideDeckImagePaths(scope, `${dir}/deck.pptx`, false);
    expect(paths).toEqual([`${dir}/slide-01.png`, `${dir}/slide-02.png`]);
  });
});
