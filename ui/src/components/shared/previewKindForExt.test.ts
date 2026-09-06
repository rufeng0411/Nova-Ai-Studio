import { describe, expect, it } from 'vitest';
import { previewKindForFileName, supportsBrowserNewTabPreview, supportsInlineSpreadsheetPreview } from './previewKindForExt';

describe('previewKindForExt', () => {
  it('classifies common deliverable extensions', () => {
    expect(previewKindForFileName('hero.png')).toBe('image');
    expect(previewKindForFileName('clip.mp4')).toBe('video');
    expect(previewKindForFileName('spec.pdf')).toBe('pdf');
    expect(previewKindForFileName('data.csv')).toBe('spreadsheet');
    expect(previewKindForFileName('book.xlsx')).toBe('spreadsheet');
  });

  it('flags browser new-tab and spreadsheet inline support', () => {
    expect(supportsBrowserNewTabPreview('spec.pdf', 'pdf')).toBe(true);
    expect(supportsBrowserNewTabPreview('notes.md', 'document')).toBe(false);
    expect(supportsInlineSpreadsheetPreview('sheet.csv')).toBe(true);
  });
});
