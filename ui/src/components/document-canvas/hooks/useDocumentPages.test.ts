import { describe, expect, it } from 'vitest';
import { clampPageIndex } from './useDocumentPages';

describe('useDocumentPages helpers', () => {
  it('clamps navigation at boundaries', () => {
    expect(clampPageIndex(-1, 3)).toBe(0);
    expect(clampPageIndex(0, 3)).toBe(0);
    expect(clampPageIndex(1, 3)).toBe(1);
    expect(clampPageIndex(99, 3)).toBe(2);
    expect(clampPageIndex(0, 0)).toBe(0);
  });
});
