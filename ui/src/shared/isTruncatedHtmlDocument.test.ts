import { describe, expect, it } from 'vitest';
import { isTruncatedHtmlDocument } from './isTruncatedHtmlDocument';

describe('isTruncatedHtmlDocument', () => {
  it('flags missing closing html', () => {
    expect(isTruncatedHtmlDocument('<!DOCTYPE html><html><body><p>x</p></body>')).toBe(true);
  });

  it('flags cut-off CSS gradient', () => {
    const cut = `<!DOCTYPE html><html><head><style>
.phone { background: linear-gradient(145deg, #2a2a2a, #`;
    expect(isTruncatedHtmlDocument(cut)).toBe(true);
  });

  it('accepts complete minimal document', () => {
    expect(
      isTruncatedHtmlDocument('<!DOCTYPE html><html><head></head><body>ok</body></html>'),
    ).toBe(false);
  });
});
