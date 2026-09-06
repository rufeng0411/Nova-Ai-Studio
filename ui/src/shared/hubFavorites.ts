export {
  emptyHubFavorites,
  HUB_FAVORITES_STORAGE_KEY,
  isHubFavoriteId,
  MAX_HUB_FAVORITES_PER_KIND,
  normalizeHubFavorites,
  toggleHubFavoriteId,
} from '../../shared/hubFavorites.mjs';

export type HubFavorites = {
  capabilities: string[];
  templates: string[];
};
