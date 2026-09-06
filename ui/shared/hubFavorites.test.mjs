import { describe, expect, it } from 'vitest';
import {
  emptyHubFavorites,
  isHubFavoriteId,
  normalizeHubFavorites,
  toggleHubFavoriteId,
} from './hubFavorites.mjs';

describe('hubFavorites', () => {
  it('normalizes invalid input to empty lists', () => {
    expect(normalizeHubFavorites(null)).toEqual(emptyHubFavorites());
    expect(normalizeHubFavorites({ capabilities: ['a', ' ', 3], templates: ['t1'] })).toEqual({
      capabilities: ['a'],
      templates: ['t1'],
    });
  });

  it('dedupes while preserving first occurrence order', () => {
    expect(
      normalizeHubFavorites({
        capabilities: ['anth-pptx', 'mkt-campaign-plan', 'anth-pptx'],
        templates: [],
      }),
    ).toEqual({
      capabilities: ['anth-pptx', 'mkt-campaign-plan'],
      templates: [],
    });
  });

  it('toggles favorites with newest first on add', () => {
    let caps = ['a'];
    caps = toggleHubFavoriteId(caps, 'b');
    expect(caps).toEqual(['b', 'a']);
    caps = toggleHubFavoriteId(caps, 'a');
    expect(caps).toEqual(['b']);
    expect(isHubFavoriteId(caps, 'b')).toBe(true);
  });
});
