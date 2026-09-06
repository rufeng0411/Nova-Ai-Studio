// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isMarkdownFile } from './mdBrowserOpen';

describe('md drop file filter', () => {
  it('keeps markdown and rejects images for document drop split', () => {
    const files = [
      new File(['# a'], 'a.md', { type: 'text/markdown' }),
      new File(['x'], 'x.png', { type: 'image/png' }),
    ];
    const md = files.filter((f) => isMarkdownFile(f));
    const others = files.filter((f) => !isMarkdownFile(f));
    expect(md).toHaveLength(1);
    expect(others).toHaveLength(1);
  });
});
