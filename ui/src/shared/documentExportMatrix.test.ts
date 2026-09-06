import { describe, expect, it } from 'vitest';
import { buildExportCapabilities, hasExportCapabilities, isExportCapClickable, normalizeServerExportCapabilities } from './documentExportMatrix';
import { resolveExportScope } from './resolveExportScope';

describe('documentExportMatrix', () => {
  it('offers pdf+docx+pptx for markdown reports', () => {
    const scope = resolveExportScope({ filePath: 'artifacts/report.md' });
    const caps = buildExportCapabilities(scope, 'artifacts/report.md');
    expect(caps.filter((c) => c.recommended).map((c) => c.format)).toEqual(['pdf', 'docx', 'pptx']);
    expect(caps.every((c) => c.engine === 'export_document')).toBe(true);
  });

  it('offers pdf and editable pptx for slide deck html when OCR is ready', () => {
    const scope = resolveExportScope({ filePath: 'artifacts/demo/presentation.html' });
    expect(scope.scopeId).toBe('slide_deck_html');
    const caps = buildExportCapabilities(scope, 'artifacts/demo/presentation.html');
    expect(caps.filter((c) => c.recommended).map((c) => c.format).sort()).toEqual(['pdf', 'pptx']);
    const editable = caps.find((c) => c.format === 'pptx' && c.engine === 'ocr_editable_pptx');
    expect(editable?.recommended).toBe(true);
    expect(caps.some((c) => c.format === 'pptx' && c.engine === 'export_document')).toBe(true);
  });

  it('falls back to image pptx for html when OCR is unavailable', () => {
    const scope = resolveExportScope({ filePath: 'artifacts/report/index.html' });
    expect(scope.scopeId).toBe('report_html');
    const caps = buildExportCapabilities(scope, 'artifacts/report/index.html', { ocrReady: false });
    expect(caps.filter((c) => c.format === 'pptx')).toHaveLength(1);
    expect(caps.find((c) => c.format === 'pptx')?.engine).toBe('export_document');
  });

  it('offers compose pdf and editable pptx for slide deck', () => {
    const dir = 'artifacts/slides-demo';
    const scope = resolveExportScope({
      filePath: `${dir}/slide-01.png`,
      siblings: [`${dir}/slide-manifest.json`, `${dir}/slide-01.png`, `${dir}/slide-02.png`],
    });
    const caps = buildExportCapabilities(scope, `${dir}/slide-01.png`);
    const composePdf = caps.find((c) => c.engine === 'compose_images' && c.format === 'pdf');
    expect(composePdf?.recommended).toBe(true);
    expect(composePdf?.bundle).toBe(true);
    const ppt = caps.find((c) => c.format === 'pptx');
    expect(ppt?.engine).toBe('ocr_editable_pptx');
    expect(ppt?.recommended).toBe(true);
    expect(ppt?.enabled).toBe(true);
    const composePptx = caps.find((c) => c.engine === 'compose_images' && c.format === 'pptx');
    expect(composePptx?.recommended).toBe(false);
  });

  it('disables ocr when not configured', () => {
    const scope = resolveExportScope({ filePath: 'scan.pdf' });
    const caps = buildExportCapabilities(scope, 'scan.pdf', { ocrReady: false });
    expect(caps[0].enabled).toBe(false);
    expect(caps[0].reasonKey).toBe('export.reason.needsOcrConfig');
  });

  it('hides export for video', () => {
    const scope = resolveExportScope({ filePath: 'out.mp4' });
    expect(hasExportCapabilities('out.mp4', scope)).toBe(false);
  });

  it('does not offer export for native pptx (download only)', () => {
    const scope = resolveExportScope({ filePath: 'deck.pptx' });
    const caps = buildExportCapabilities(scope, 'deck.pptx');
    expect(caps.length).toBe(0);
    expect(hasExportCapabilities('deck.pptx', scope)).toBe(false);
  });

  it('offers deck export when previewing pptx inside slides directory', () => {
    const dir = 'artifacts/slides-wuyutai';
    const scope = resolveExportScope({
      filePath: `${dir}/deck-export.pptx`,
      siblings: [`${dir}/slide-manifest.json`, `${dir}/slide-01.png`, `${dir}/slide-02.png`],
    });
    expect(scope.scopeId).toBe('slide_deck_png');
    expect(scope.bundleImagePaths).toHaveLength(2);
    const caps = buildExportCapabilities(scope, `${dir}/deck-export.pptx`);
    expect(caps.some((c) => c.format === 'pdf' && c.engine === 'compose_images')).toBe(true);
    expect(caps.some((c) => c.format === 'pptx' && c.engine === 'ocr_editable_pptx')).toBe(true);
  });

  it('returns empty capabilities for design canvas board (preview-only scope)', () => {
    const dir = 'artifacts/canvas-demo';
    const scope = resolveExportScope({
      filePath: `${dir}/canvas-manifest.json`,
      siblings: [`${dir}/canvas-manifest.json`, `${dir}/hero.png`],
    });
    expect(scope.scopeId).toBe('design_canvas_board');
    const caps = buildExportCapabilities(scope, `${dir}/canvas-manifest.json`);
    expect(Array.isArray(caps)).toBe(true);
    expect(caps).toHaveLength(0);
    expect(hasExportCapabilities(`${dir}/canvas-manifest.json`, scope)).toBe(false);
  });

  it('offers xlsx+pdf for spreadsheet', () => {
    const scope = resolveExportScope({ filePath: 'data.csv' });
    const caps = buildExportCapabilities(scope, 'data.csv');
    expect(caps.map((c) => c.format).sort()).toEqual(['pdf', 'xlsx']);
  });

  it('keeps local export engines clickable before capabilities load', () => {
    const cap = {
      format: 'pdf' as const,
      engine: 'export_document' as const,
      scopeId: 'report_markdown' as const,
      bundle: false,
      recommended: true,
      enabled: false,
      labelKey: 'export.actions.pdf',
      hintKey: 'export.hint.reportToPdf',
      accent: 'rose' as const,
    };
    expect(isExportCapClickable(cap, { capsLoaded: false, busy: false, running: false })).toBe(true);
    const normalized = normalizeServerExportCapabilities([cap]);
    expect(normalized[0]?.enabled).toBe(true);
  });

  it('blocks cloud OCR export until capabilities confirm readiness', () => {
    const cap = {
      format: 'pptx' as const,
      engine: 'ocr_editable_pptx' as const,
      scopeId: 'slide_deck_png' as const,
      bundle: true,
      recommended: true,
      enabled: false,
      reasonKey: 'export.reason.needsOcrConfig',
      labelKey: 'export.actions.deckPptx',
      hintKey: 'export.hint.slideDeckEditablePptx',
      accent: 'amber' as const,
    };
    expect(isExportCapClickable(cap, { capsLoaded: false, busy: false, running: false })).toBe(false);
    expect(isExportCapClickable(cap, { capsLoaded: true, busy: false, running: false })).toBe(false);
    expect(isExportCapClickable({ ...cap, enabled: true }, { capsLoaded: true, busy: false, running: false })).toBe(true);
  });
});
