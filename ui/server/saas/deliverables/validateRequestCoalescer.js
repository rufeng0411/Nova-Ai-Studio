/**
 * PD-SAAS-FORK: coalesce in-flight deliverable validate requests by tenant/project/paths.
 */
import crypto from 'node:crypto';

const inflight = new Map();
const shortCache = new Map();
const CACHE_TTL_MS = 15_000;

function hashPaths(paths) {
  const normalized = [...paths].map(String).sort().join('\n');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export function buildValidateCoalesceKey(tenantId, userId, projectName, hintDir, paths) {
  return `${tenantId}:${userId}:${projectName}:${hintDir || ''}:${hashPaths(paths)}`;
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
export async function coalesceValidateRequest(key, task) {
  const cached = shortCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const promise = task()
    .then((value) => {
      shortCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

/** Test-only */
export function clearValidateCoalescerForTests() {
  inflight.clear();
  shortCache.clear();
}
