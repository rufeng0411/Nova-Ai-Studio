import { describe, expect, it } from 'vitest';
import { PREFLIGHT_MAX_VISIBLE_CARDS } from './usePreflightVirtualWindow';

describe('usePreflightVirtualWindow constants', () => {
  it('max visible cards is 24', () => {
    expect(PREFLIGHT_MAX_VISIBLE_CARDS).toBe(24);
  });

  it('virtual slice math caps at 24 for 150 items', () => {
    const items = Array.from({ length: 150 }, (_, i) => i);
    const end = Math.min(items.length, PREFLIGHT_MAX_VISIBLE_CARDS);
    expect(items.slice(0, end).length).toBeLessThanOrEqual(24);
  });
});
