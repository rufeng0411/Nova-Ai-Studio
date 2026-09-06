/**
 * PD-SAAS-FORK: Per-request tenant context for project path resolution.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { getTenantPilotHome } from './tenant/paths.js';

export const saasRequestStore = new AsyncLocalStorage();

/**
 * @returns {{ tenantId: string, tenantPilotHome: string, userId?: number, role?: string | null } | undefined}
 */
export function getSaasRequestContext() {
  return saasRequestStore.getStore();
}

/**
 * Resolve pilot home for project listing: tenant tree in SaaS, legacy otherwise.
 * @param {import('../utils/pilotPaths.js').resolvePilotHome} resolvePilotHomeFn
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveEffectivePilotHome(resolvePilotHomeFn, env = process.env) {
  const store = getSaasRequestContext();
  if (store?.tenantPilotHome) {
    return store.tenantPilotHome;
  }
  return resolvePilotHomeFn(env);
}

export function tenantContextMiddleware(req, res, next) {
  const tenantId = req.user?.tenant_id ?? req.user?.tenantId;
  if (!tenantId) {
    return next();
  }
  const tenantPilotHome = getTenantPilotHome(tenantId);
  const userId = req.user?.id ?? req.user?.userId ?? null;
  const role = typeof req.user?.role === 'string' ? req.user.role : null;
  return saasRequestStore.run({ tenantId, tenantPilotHome, userId, role }, next);
}
