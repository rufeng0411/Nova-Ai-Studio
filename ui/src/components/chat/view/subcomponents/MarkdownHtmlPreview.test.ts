import { describe, expect, it } from 'vitest';
import { isRenderableHtmlDocument } from './MarkdownHtmlPreview';

describe('isRenderableHtmlDocument', () => {
  it('detects full HTML documents', () => {
    expect(isRenderableHtmlDocument('<!DOCTYPE html><html><body>hi</body></html>')).toBe(true);
    expect(isRenderableHtmlDocument('<html lang="zh"><head></head><body></body></html>')).toBe(true);
  });

  it('rejects snippets and empty input', () => {
    expect(isRenderableHtmlDocument('<div>fragment</div>')).toBe(false);
    expect(isRenderableHtmlDocument('')).toBe(false);
  });
});
