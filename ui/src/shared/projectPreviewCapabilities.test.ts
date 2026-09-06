import { describe, expect, it } from 'vitest';
import {
  isFramePreviewLayout,
  needsProjectPreviewUrl,
  requiresInAppPreviewRenderer,
  supportsBrowserNewTabForFile,
  supportsOverlayPreview,
  usesDocumentCanvas,
} from './projectPreviewCapabilities';

describe('projectPreviewCapabilities', () => {
  it('treats markdown as overlay-previewable without preview URL pipeline', () => {
    expect(supportsOverlayPreview('ROG-NUC-品牌官网全案.md', 'document')).toBe(true);
    expect(needsProjectPreviewUrl('ROG-NUC-品牌官网全案.md', 'document')).toBe(false);
    expect(isFramePreviewLayout('ROG-NUC-品牌官网全案.md', 'document')).toBe(true);
  });

  it('flags html for preview URL pipeline and media for content / new tab', () => {
    expect(needsProjectPreviewUrl('index.html', 'html')).toBe(true);
    expect(needsProjectPreviewUrl('clip.mp4', 'video')).toBe(false);
    expect(supportsBrowserNewTabForFile('clip.mp4', 'video')).toBe(true);
    expect(supportsOverlayPreview('clip.mp4', 'video')).toBe(true);
  });

  it('uses frame layout for html and pdf', () => {
    expect(isFramePreviewLayout('index.html', 'html')).toBe(true);
    expect(isFramePreviewLayout('spec.pdf', 'pdf')).toBe(true);
  });

  it('routes office documents through document canvas', () => {
    expect(usesDocumentCanvas('brief.docx')).toBe(true);
    expect(usesDocumentCanvas('deck.pptx')).toBe(true);
    expect(supportsOverlayPreview('brief.docx', 'document')).toBe(true);
    expect(supportsOverlayPreview('deck.pptx', 'presentation')).toBe(true);
    expect(needsProjectPreviewUrl('brief.docx', 'document')).toBe(false);
    expect(isFramePreviewLayout('brief.docx', 'document')).toBe(true);
    expect(supportsBrowserNewTabForFile('brief.docx', 'document')).toBe(false);
    expect(supportsBrowserNewTabForFile('deck.pptx', 'presentation')).toBe(false);
    expect(supportsBrowserNewTabForFile('spec.pdf', 'pdf')).toBe(true);
    expect(requiresInAppPreviewRenderer('brief.docx', 'document')).toBe(true);
  });

  it('keeps markdown preview behavior unchanged', () => {
    expect(supportsOverlayPreview('notes.md', 'document')).toBe(true);
    expect(usesDocumentCanvas('notes.md')).toBe(false);
    expect(needsProjectPreviewUrl('notes.md', 'document')).toBe(false);
    expect(supportsBrowserNewTabForFile('notes.md', 'document')).toBe(false);
    expect(requiresInAppPreviewRenderer('notes.md', 'document')).toBe(true);
  });

  it('reclassifies stale deliverable kind=file for images', () => {
    expect(supportsOverlayPreview('artifacts/deck/slide-01.png', 'file')).toBe(true);
    expect(needsProjectPreviewUrl('artifacts/deck/slide-01.png', 'file')).toBe(false);
    expect(isFramePreviewLayout('artifacts/deck/slide-01.png', 'file')).toBe(true);
  });

  it('supports super preview for text, code, and audio without browser preview URLs', () => {
    expect(supportsOverlayPreview('notes.txt', 'document')).toBe(true);
    expect(needsProjectPreviewUrl('notes.txt', 'document')).toBe(false);
    expect(isFramePreviewLayout('notes.txt', 'document')).toBe(true);

    expect(supportsOverlayPreview('data.json', 'code')).toBe(true);
    expect(supportsOverlayPreview('events.jsonl', 'file')).toBe(true);
    expect(isFramePreviewLayout('app.js', 'code')).toBe(true);
    expect(isFramePreviewLayout('events.jsonl', 'code')).toBe(true);
    expect(needsProjectPreviewUrl('data.json', 'code')).toBe(false);

    expect(supportsOverlayPreview('voice-over.mp3', 'file')).toBe(true);
    expect(needsProjectPreviewUrl('voice-over.mp3', 'file')).toBe(false);
    expect(supportsBrowserNewTabForFile('voice-over.mp3', 'file')).toBe(false);
  });
});
