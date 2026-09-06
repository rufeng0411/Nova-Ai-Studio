import { describe, expect, it } from 'vitest';
import { stripMarkdownForSnippet } from './stripMarkdownForSnippet';

describe('stripMarkdownForSnippet', () => {
  it('removes headings and markdown emphasis for compact previews', () => {
    const input = '# Title\n\n**Bold** and *italic* with [link](https://example.com)\n\n- item one';
    expect(stripMarkdownForSnippet(input)).toBe('Title\n\nBold and italic with link\n• item one');
  });
});
