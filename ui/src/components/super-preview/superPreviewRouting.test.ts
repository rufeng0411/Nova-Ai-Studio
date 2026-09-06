import { describe, expect, it } from 'vitest';
import { isCodePreviewFile, isHtmlPreviewFile, shouldUseSuperPreview } from './superPreviewRouting';

describe('superPreviewRouting', () => {
  it('routes the full-format baseline into super preview', () => {
    expect(shouldUseSuperPreview('index.html', 'html')).toBe(true);
    expect(shouldUseSuperPreview('report.md', 'document')).toBe(true);
    expect(shouldUseSuperPreview('notes.txt', 'document')).toBe(true);
    expect(shouldUseSuperPreview('data.json', 'code')).toBe(true);
    expect(shouldUseSuperPreview('events.jsonl', 'code')).toBe(true);
    expect(shouldUseSuperPreview('app.js', 'code')).toBe(true);
    expect(shouldUseSuperPreview('hero.png', 'image')).toBe(true);
    expect(shouldUseSuperPreview('clip.mp4', 'video')).toBe(true);
    expect(shouldUseSuperPreview('voice.mp3', 'file')).toBe(true);
    expect(shouldUseSuperPreview('sheet.xlsx', 'spreadsheet')).toBe(true);
    expect(shouldUseSuperPreview('brief.docx', 'document')).toBe(true);
    expect(shouldUseSuperPreview('deck.pptx', 'presentation')).toBe(true);
    expect(shouldUseSuperPreview('scan.pdf', 'pdf')).toBe(true);
  });

  it('routes .bento.html into super preview', () => {
    expect(shouldUseSuperPreview('artifacts/task-1/deck.bento.html', 'html')).toBe(true);
  });

  it('keeps exact helper checks for html and code files', () => {
    expect(isHtmlPreviewFile('page.htm')).toBe(true);
    expect(isCodePreviewFile('component.tsx')).toBe(true);
    expect(isCodePreviewFile('data.jsonl')).toBe(true);
    expect(isCodePreviewFile('plain.txt')).toBe(false);
  });
});
