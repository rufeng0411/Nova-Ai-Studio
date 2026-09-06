import { describe, expect, it } from 'vitest';
import {
  buildPublicShareUrl,
  normalizePublicMdShareMode,
  parseMarkdownSharePageSearch,
} from './markdownShareUrl';

describe('markdownShareUrl', () => {
  it('builds public /s url without token', () => {
    const url = buildPublicShareUrl('abcShareId', 'https://example.com');
    expect(url).toBe('https://example.com/s/abcShareId');
    expect(url).not.toMatch(/token=/);
  });

  it('normalizes flag modes fail-closed', () => {
    expect(normalizePublicMdShareMode('enforce')).toBe('enforce');
    expect(normalizePublicMdShareMode('shadow')).toBe('shadow');
    expect(normalizePublicMdShareMode('nope')).toBe('off');
  });

  it('parses legacy spa share page search params', () => {
    const parsed = parseMarkdownSharePageSearch(
      '?project=general&path=artifacts%2Freport.md&hintDir=artifacts%2Ftask-1&title=report.md',
    );
    expect(parsed).toEqual({
      projectName: 'general',
      apiPath: 'artifacts/report.md',
      hintDir: 'artifacts/task-1',
      fileName: 'report.md',
      title: 'report.md',
    });
  });
});
