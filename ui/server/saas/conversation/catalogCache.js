/**
 * PD-SAAS-FORK: Projects list cache key with catalog fingerprint.
 */
import { projectsKey, getCacheKeyPrefix } from '../cache/cacheKeys.js';
import { catalogStore } from './CatalogStore.js';
import { shouldReadConversationCatalog } from './featureFlags.js';
import { cacheDel, cacheDelByPattern } from '../cache/redisClient.js';

/**
 * @param {{ tenantId?: string, userId?: number, id?: number }} user
 */
export async function resolveProjectsCacheKey(user) {
  const tenantId = user?.tenantId ?? 'platform';
  const userId = user?.userId ?? user?.id ?? 'anon';
  if (!shouldReadConversationCatalog({ userId: Number(userId) || null })) {
    return projectsKey({ tenantId, userId });
  }
  try {
    const maxUpdated = await catalogStore.getMaxUpdatedAt({
      tenantId: String(tenantId),
      userId: Number(userId),
    });
    const version = maxUpdated ? String(maxUpdated) : '0';
    return projectsKey({ tenantId, userId, catalogVersion: version });
  } catch {
    return projectsKey({ tenantId, userId });
  }
}

/**
 * Drop cached sidebar project list so the next GET /api/projects rebuilds from disk/PG.
 * Clears all catalog-version keys for the user (cv:* variants included).
 * @param {{ tenantId?: string, userId?: number, id?: number }} user
 */
export async function invalidateProjectsListCache(user) {
  const tenantId = user?.tenantId ?? 'platform';
  const userId = user?.userId ?? user?.id ?? 'anon';
  const prefix = `${getCacheKeyPrefix()}t:${tenantId}:u:${userId}:projects`;
  await cacheDelByPattern(`${prefix}*`);
  // Also delete legacy key without catalog version suffix (pre-catalog deployments).
  await cacheDel(projectsKey({ tenantId, userId })).catch(() => undefined);
}

let backgroundStarted = false;

/** Start background catalog maintenance (outbox flush). */
export function startCatalogBackgroundJobs() {
  if (backgroundStarted) return;
  backgroundStarted = true;
  setInterval(() => {
    void catalogStore.flushOutbox(50).catch(() => undefined);
  }, 60_000).unref?.();
}
