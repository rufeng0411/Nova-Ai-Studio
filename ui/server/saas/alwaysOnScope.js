/**
 * PD-SAAS-FORK: tenant scoping for Always-On (events + cron jobs).
 *
 * Always-On data is still written to the global pilot home by the single
 * gateway process; every record carries an absolute `projectKey`. We isolate
 * tenants purely at the read/operate layer by keeping only records whose
 * `projectKey` lives under the current tenant home, and by rejecting cron
 * run/stop/delete on tasks that do not belong to the caller's tenant.
 *
 * Single-host (no SaaS request context) → no filtering, no checks → unchanged.
 */
import { getSaasRequestContext } from './context.js';
import { isProjectKeyInTenant } from './tenant/scope.js';
import { isSaasMode } from './mode.js';

// PD-SAAS-FORK: In SaaS mode every account — including platform admins — only
// sees Always-On records for projects under their own tenant home.
function shouldScopeAlwaysOn(ctx) {
  return isSaasMode() && Boolean(ctx?.tenantPilotHome);
}

/**
 * @template {{ projectKey?: string | null }} T
 * @param {T[]} records
 * @returns {T[]}
 */
export function filterByTenantProjectKey(records) {
  const ctx = getSaasRequestContext();
  if (!shouldScopeAlwaysOn(ctx)) return records;
  return (records || []).filter((r) => isProjectKeyInTenant(r?.projectKey, ctx.tenantPilotHome));
}

/**
 * Resolve a cron task and decide whether the current tenant may operate on it.
 * The gateway is passed in by the caller so this module stays free of the
 * pilotdeck-bridge import cycle.
 *
 * @param {{ cronList: (input: object) => Promise<{ tasks?: Array<{ taskId: string, projectKey?: string }> }> }} gateway
 * @param {string} taskId
 * @returns {Promise<{ allowed: boolean, reason?: 'not_found' | 'forbidden', task?: object }>}
 */
export async function resolveCronTaskForTenant(gateway, taskId) {
  const ctx = getSaasRequestContext();
  let task;
  try {
    const result = await gateway.cronList({ includeHistory: false, limit: 1000 });
    task = (result.tasks || []).find((t) => t.taskId === taskId);
  } catch {
    task = undefined;
  }
  // Single-host / no tenant context: no checks (global view).
  if (!shouldScopeAlwaysOn(ctx)) return { allowed: true, task };
  if (!task) return { allowed: false, reason: 'not_found', task };
  const allowed = isProjectKeyInTenant(task.projectKey, ctx.tenantPilotHome);
  return { allowed, reason: allowed ? undefined : 'forbidden', task };
}
