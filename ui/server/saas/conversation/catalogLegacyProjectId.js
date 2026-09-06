/**
 * PD-SAAS-FORK: map virtual sidebar project `general` to on-disk/catalog slug id.
 */
import { getSaasRequestContext } from '../context.js';
import { createProjectId } from '../../utils/pilotPaths.js';

/**
 * Catalog rows for the General workspace are stored under the tenant pilot-home
 * slug (`projects/{createProjectId(tenantPilotHome)}/chats`), not `general`.
 * @param {string} legacyProjectId
 */
export function resolveCatalogLegacyProjectId(legacyProjectId) {
  const normalized = String(legacyProjectId || '').trim() || 'general';
  const ctx = getSaasRequestContext();
  if (normalized === 'general' && ctx?.tenantPilotHome) {
    return createProjectId(ctx.tenantPilotHome);
  }
  return normalized;
}
