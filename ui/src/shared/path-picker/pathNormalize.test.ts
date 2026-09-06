import { describe, expect, it } from 'vitest';
import {
  BROWSE_ROOTS_TOKEN,
  buildPathBreadcrumbs,
  getParentPath,
  getSuggestionRootPath,
  joinFolderPath,
} from './pathNormalize';

describe('pathNormalize', () => {
  it('resolves parent for windows paths', () => {
    expect(getParentPath('C:\\Users\\test')).toBe('C:\\Users');
    expect(getParentPath('C:\\Users')).toBe('C:\\');
    expect(getParentPath('C:\\')).toBe(BROWSE_ROOTS_TOKEN);
  });

  it('joins folder names with platform separator', () => {
    expect(joinFolderPath('C:\\foo', 'bar')).toBe('C:\\foo\\bar');
    expect(joinFolderPath('/tmp/foo', 'bar')).toBe('/tmp/foo/bar');
  });

  it('builds breadcrumbs from nested path', () => {
    const crumbs = buildPathBreadcrumbs('C:\\Users\\test');
    expect(crumbs[0]?.path).toBe(BROWSE_ROOTS_TOKEN);
    expect(crumbs.at(-1)?.path).toBe('C:\\Users\\test');
  });

  it('suggests browse root for short input', () => {
    expect(getSuggestionRootPath('')).toBe(BROWSE_ROOTS_TOKEN);
    expect(getSuggestionRootPath('C:\\Users\\test\\proj')).toBe('C:\\Users\\test');
  });
});
