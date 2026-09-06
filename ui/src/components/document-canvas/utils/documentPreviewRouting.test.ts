import { describe, expect, it } from 'vitest';
import {
  getDocumentCanvasFormat,
  isDocumentCanvasFile,
} from './documentPreviewRouting';

describe('documentPreviewRouting', () => {
  it('detects pdf, docx, and pptx', () => {
    expect(getDocumentCanvasFormat('report.pdf')).toBe('pdf');
    expect(getDocumentCanvasFormat('brief.docx')).toBe('docx');
    expect(getDocumentCanvasFormat('deck.pptx')).toBe('pptx');
    expect(isDocumentCanvasFile('report.pdf')).toBe(true);
    expect(isDocumentCanvasFile('brief.docx')).toBe(true);
    expect(isDocumentCanvasFile('deck.pptx')).toBe(true);
  });

  it('rejects non-document canvas formats', () => {
    expect(isDocumentCanvasFile('readme.md')).toBe(false);
    expect(isDocumentCanvasFile('clip.mp4')).toBe(false);
    expect(isDocumentCanvasFile('index.html')).toBe(false);
    expect(getDocumentCanvasFormat('legacy.doc')).toBeNull();
  });
});
