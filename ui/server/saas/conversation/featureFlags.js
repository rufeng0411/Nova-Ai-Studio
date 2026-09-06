/**
 * PD-SAAS-FORK: Feature flags for conversation_catalog PG migration.
 */
import { isSaasMode } from '../mode.js';

/**
 * Shadow-write catalog rows without switching UI read path (Phase 1).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isCatalogShadowWriteEnabled(env = process.env) {
  if (!isSaasMode(env)) return false;
  if (env.SAAS_CONVERSATION_CATALOG_SHADOW === '1') return true;
  if (env.SAAS_CONVERSATION_CATALOG === '1') return true;
  return false;
}

/**
 * Multi-ECS guard: shared DATA_ROOT required for catalog read path.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isMultiEcsWithoutSharedStorage(env = process.env) {
  return env.SAAS_MULTI_ECS_NO_SHARED_STORAGE === '1'
    || env.NOVA_MULTI_ECS_NO_SHARED_STORAGE === '1';
}

/**
 * @param {number | string | null | undefined} userId
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isCatalogReadEnabledForUser(userId, env = process.env) {
  if (!isSaasMode(env)) return false;
  if (env.SAAS_CONVERSATION_CATALOG !== '1') return false;
  if (isMultiEcsWithoutSharedStorage(env)) return false;

  const grayPct = Number.parseInt(String(env.SAAS_CONVERSATION_CATALOG_GRAY_PCT ?? '100'), 10);
  if (!Number.isFinite(grayPct) || grayPct >= 100) return true;
  if (grayPct <= 0) return false;

  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return false;
  return (uid % 100) < grayPct;
}

/**
 * @param {{ userId?: number | null }} [ctx]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function shouldReadConversationCatalog(ctx, env = process.env) {
  return isCatalogReadEnabledForUser(ctx?.userId, env);
}
