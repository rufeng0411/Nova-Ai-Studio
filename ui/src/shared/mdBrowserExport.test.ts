// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildMdBrowserStagePath, sanitizeMdBrowserBaseName } from './mdBrowserExport';

describe('mdBrowserExport helpers', () => {
  it('sanitizes basename and builds artifacts stage path', () => {
    expect(sanitizeMdBrowserBaseName('调研 报告.md')).toBe('调研-报告');
    expect(buildMdBrowserStagePath('a/b.md')).toBe('artifacts/md-browser/a_b.md');
  });
});
