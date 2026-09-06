// PD-SAAS-FORK: per-user capability + process-template favorites (hubFavorites in preferences_json)

export const HUB_FAVORITES_STORAGE_KEY = 'hubFavorites';
export const MAX_HUB_FAVORITES_PER_KIND = 100;

/**
 * @typedef {{ capabilities: string[]; templates: string[] }} HubFavorites
 */

/** @returns {HubFavorites} */
export function emptyHubFavorites() {
  return { capabilities: [], templates: [] };
}

/** @param {unknown} raw @returns {HubFavorites} */
export function normalizeHubFavorites(raw) {
  if (!raw || typeof raw !== 'object') {
    return emptyHubFavorites();
  }
  const record = /** @type {Record<string, unknown>} */ (raw);
  const capabilities = dedupeOrdered(
    normalizeIdList(record.capabilities).slice(0, MAX_HUB_FAVORITES_PER_KIND),
  );
  const templates = dedupeOrdered(
    normalizeIdList(record.templates).slice(0, MAX_HUB_FAVORITES_PER_KIND),
  );
  return { capabilities, templates };
}

/** @param {unknown} value @returns {string[]} */
function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    out.push(trimmed);
  }
  return out;
}

/** @param {string[]} list */
function dedupeOrdered(list) {
  const seen = new Set();
  const out = [];
  for (const id of list) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Toggle id in list — add moves to front; remove keeps order of remaining items.
 * @param {string[]} list
 * @param {string} id
 * @returns {string[]}
 */
export function toggleHubFavoriteId(list, id) {
  const trimmed = String(id || '').trim();
  if (!trimmed) return list;
  const idx = list.indexOf(trimmed);
  if (idx >= 0) {
    return list.filter((_, i) => i !== idx);
  }
  return dedupeOrdered([trimmed, ...list]).slice(0, MAX_HUB_FAVORITES_PER_KIND);
}

/** @param {string[]} list @param {string} id */
export function isHubFavoriteId(list, id) {
  return list.includes(String(id || '').trim());
}
