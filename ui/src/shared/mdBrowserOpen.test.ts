// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildMdBrowserHref,
  isMarkdownFile,
  isMarkdownFileName,
  stashMdBrowserPayload,
  takeMdBrowserPayload,
} from './mdBrowserOpen';

describe('mdBrowserOpen', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('detects markdown filenames', () => {
    expect(isMarkdownFileName('a.md')).toBe(true);
    expect(isMarkdownFileName('a.markdown')).toBe(true);
    expect(isMarkdownFileName('a.txt')).toBe(false);
  });

  it('detects markdown File by name or mime', () => {
    expect(isMarkdownFile(new File(['x'], 'notes.md', { type: 'text/plain' }))).toBe(true);
    expect(isMarkdownFile(new File(['x'], 'x.bin', { type: 'text/markdown' }))).toBe(true);
    expect(isMarkdownFile(new File(['x'], 'x.png', { type: 'image/png' }))).toBe(false);
  });

  it('builds tools path with optional sid and project', () => {
    expect(buildMdBrowserHref()).toContain('/tools/md-browser');
    expect(buildMdBrowserHref({ sid: 'abc' })).toContain('sid=abc');
    expect(buildMdBrowserHref({ project: 'general' })).toContain('project=general');
  });

  it('stashes and takes payload via localStorage', () => {
    const sid = stashMdBrowserPayload('# hi', 'hi.md');
    const payload = takeMdBrowserPayload(sid);
    expect(payload).toEqual({ content: '# hi', fileName: 'hi.md' });
    expect(takeMdBrowserPayload(sid)).toBeNull();
  });
});
