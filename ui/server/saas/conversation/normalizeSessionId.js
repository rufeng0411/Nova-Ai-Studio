/**
 * PD-SAAS-FORK: Normalize web session ids for catalog storage (web-s_ canonical).
 * @param {string | null | undefined} sessionId
 * @returns {string}
 */
export function normalizeSessionId(sessionId) {
  const trimmed = String(sessionId ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/web:s_/g, 'web-s_');
}

/**
 * @param {string} sessionId
 * @returns {string[]}
 */
export function sessionIdVariants(sessionId) {
  const canonical = normalizeSessionId(sessionId);
  if (!canonical) return [];
  const variants = new Set([canonical]);
  if (canonical.includes('web-s_')) {
    variants.add(canonical.replace(/web-s_/g, 'web:s_'));
  }
  return [...variants];
}

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
export function sessionKeysMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeSessionId(a) === normalizeSessionId(b);
}

/**
 * @param {Set<string> | Iterable<string> | null | undefined} keys
 * @param {string | null | undefined} sessionId
 */
export function sessionKeySetHas(keys, sessionId) {
  if (!keys || !sessionId) return false;
  const set = keys instanceof Set ? keys : new Set(keys);
  if (set.has(sessionId)) return true;
  for (const variant of sessionIdVariants(sessionId)) {
    if (set.has(variant)) return true;
  }
  return false;
}
