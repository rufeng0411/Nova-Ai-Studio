// PD-SAAS-FORK: model pool redundancy — shared between UI server validation and admin UI

export const MAX_PROVIDER_API_KEYS = 4;
export const MAX_STANDBY_MODEL_SLOTS = 4;
export const MAX_TOOL_CAPABILITY_FALLBACKS = 2;

export function normalizeProviderApiKeySlots(raw = {}) {
  const primary = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
  const extras = Array.isArray(raw.apiKeys)
    ? raw.apiKeys
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const merged = [primary, ...extras].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const key of merged) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_PROVIDER_API_KEYS) break;
  }
  return out;
}

export function normalizeStandbyModelSlots(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    out.push(trimmed);
    if (out.length >= MAX_STANDBY_MODEL_SLOTS) break;
  }
  while (out.length < MAX_STANDBY_MODEL_SLOTS) out.push('');
  return out.slice(0, MAX_STANDBY_MODEL_SLOTS);
}

export function compactStandbyModelSlots(slots) {
  return normalizeStandbyModelSlots(slots).filter(Boolean);
}

export function normalizeToolCapabilityFallbacks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry))
    .slice(0, MAX_TOOL_CAPABILITY_FALLBACKS);
}
