/**
 * PD-SAAS-FORK: legacy migrate API — delegates to auto-provision.
 */
import { getSaasRequestContext } from '../context.js';
import { ensureSaasWorkspacesProvisioned } from './ensureWorkspaces.js';

export async function migrateCurrentUserWorkspaces() {
  const ctx = getSaasRequestContext();
  if (!ctx?.userId || !ctx?.tenantId || !ctx.tenantPilotHome) {
    return { provisioned: 0, error: 'no_context' };
  }
  return ensureSaasWorkspacesProvisioned(ctx);
}
