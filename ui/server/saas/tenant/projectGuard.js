/**
 * PD-SAAS-FORK: Tenant boundary enforcement for gateway-backed session reads/writes.
 *
 * The PilotDeck gateway is a single shared process whose transcript store is
 * keyed only by `projectKey` (the project cwd), with no tenant dimension. That
 * means any authenticated client could read or write another tenant's — or the
 * single-user install's — sessions simply by passing an arbitrary `projectKey`
 * (e.g. `F:\Ai-pilotdeck`). This module clamps every client-driven `projectKey`
 * to the set the current tenant is actually allowed to touch:
 *
 *   - the tenant's "general" pilot home (`DATA_ROOT/tenants/<id>`), and
 *   - any project the tenant explicitly registered (its `.cwd` markers).
 *
 * Outside SaaS mode this is a no-op so the single-user / OSS path is unchanged.
 */
import path from 'node:path';
import { getSaasRequestContext } from '../context.js';
import { isSaasMode } from '../mode.js';
import { pathContainsUserSegment } from '../storage/paths.js';
import { listWorkspacesForUser } from '../storage/workspaceStore.js';
import { readMarkedProjectPathsForHome } from './projectList.js';

export class TenantForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantForbiddenError';
    this.code = 'tenant_forbidden';
  }
}

function normalizePathKey(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return path.resolve(value.trim()).toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

/**
 * Set of resolved (lower-cased) project keys the current tenant may access:
 * its general pilot home plus every registered project marker cwd.
 * @param {string} tenantPilotHome
 * @returns {Promise<Set<string>>}
 */
export async function listTenantAllowedProjectKeys(tenantPilotHome) {
  const allowed = new Set();
  if (tenantPilotHome) {
    allowed.add(normalizePathKey(tenantPilotHome));
  }
  const marked = await readMarkedProjectPathsForHome(tenantPilotHome).catch(
    () => new Map(),
  );
  for (const cwd of marked.values()) {
    const key = normalizePathKey(cwd);
    if (key) allowed.add(key);
  }
  // PD-SAAS-FORK: include registered workspace roots for current user.
  const ctx = getSaasRequestContext();
  if (ctx?.userId && ctx?.tenantId) {
    const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId).catch(() => []);
    for (const ws of workspaces) {
      if (ws.canonicalProjectKey) allowed.add(normalizePathKey(ws.canonicalProjectKey));
    }
  }
  return allowed;
}

/**
 * PD-SAAS-FORK: reject cloud/local paths outside current user segment.
 * @param {string} projectKey
 */
export function assertUserStorageSegment(projectKey) {
  const ctx = getSaasRequestContext();
  if (!isSaasMode() || !ctx?.userId || !projectKey) return;
  const resolved = path.resolve(projectKey);
  const normalized = resolved.replace(/\\/g, '/');
  if (
    (normalized.includes('/cloud-storage/') || normalized.includes('/local-bindings/')) &&
    !pathContainsUserSegment(resolved, ctx.userId)
  ) {
    throw new TenantForbiddenError('Path is not accessible for the current account.');
  }
}

/**
 * Resolve a client-supplied projectKey into one that is safe for the current
 * tenant. In SaaS mode an out-of-tenant key is rejected (caller decides whether
 * to 403 or fall back to the tenant general home). Outside SaaS the key passes
 * through untouched.
 *
 * @param {string | undefined | null} requestedProjectKey
 * @param {{ fallbackToGeneral?: boolean }} [options]
 * @returns {Promise<{ projectKey: string, clamped: boolean, allowed: boolean }>}
 */
export async function resolveTenantSafeProjectKey(requestedProjectKey, options = {}) {
  const ctx = getSaasRequestContext();
  // Non-SaaS or no tenant context → pass through (single-user / OSS path).
  if (!isSaasMode() || !ctx?.tenantPilotHome) {
    return {
      projectKey: requestedProjectKey || '',
      clamped: false,
      allowed: true,
    };
  }

  const tenantGeneral = ctx.tenantPilotHome;
  if (!requestedProjectKey) {
    // No projectKey supplied: anchor to the tenant general home, never the
    // server process cwd (which leaks the single-user install's transcripts).
    return { projectKey: tenantGeneral, clamped: true, allowed: true };
  }

  try {
    assertUserStorageSegment(requestedProjectKey);
  } catch {
    return { projectKey: requestedProjectKey, clamped: false, allowed: false };
  }

  const allowed = await listTenantAllowedProjectKeys(tenantGeneral);
  if (allowed.has(normalizePathKey(requestedProjectKey))) {
    return { projectKey: requestedProjectKey, clamped: false, allowed: true };
  }

  if (options.fallbackToGeneral) {
    return { projectKey: tenantGeneral, clamped: true, allowed: false };
  }
  return { projectKey: requestedProjectKey, clamped: false, allowed: false };
}

/**
 * Throw `TenantForbiddenError` when a client-supplied projectKey escapes the
 * current tenant's boundary. No-op outside SaaS mode.
 *
 * @param {string | undefined | null} requestedProjectKey
 * @returns {Promise<string>} the projectKey to use (tenant general when blank)
 */
export async function assertTenantProjectKey(requestedProjectKey) {
  const resolved = await resolveTenantSafeProjectKey(requestedProjectKey);
  if (!resolved.allowed) {
    throw new TenantForbiddenError(
      'Project is not accessible for the current account.',
    );
  }
  return resolved.projectKey;
}
