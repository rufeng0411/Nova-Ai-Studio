/**
 * PD-SAAS-FORK: Tenant scope helpers shared by Always-On isolation and router
 * usage attribution. Pure path-prefix logic — no gateway/architecture changes.
 *
 * A project path belongs to a tenant iff it lives under that tenant's home
 * (`DATA_ROOT/tenants/<id>`). In single-host mode nothing lives under that
 * tree, so every helper degrades to "not a tenant" and callers keep legacy
 * behavior unchanged.
 */
import path from 'node:path';
import { getDataRoot } from './paths.js';

/**
 * True when `child` is `parent` or nested inside it.
 * @param {string | undefined | null} child
 * @param {string | undefined | null} parent
 */
export function isPathInside(child, parent) {
  if (!child || !parent) return false;
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * True when a project key/path belongs to the given tenant home.
 * @param {string | undefined | null} projectKey
 * @param {string | undefined | null} tenantPilotHome
 */
export function isProjectKeyInTenant(projectKey, tenantPilotHome) {
  return isPathInside(projectKey, tenantPilotHome);
}

/**
 * Infer the tenant id from a project path by matching `DATA_ROOT/tenants/<id>/`.
 * Returns `undefined` for non-tenant (system/historical/single-host) paths.
 * @param {string | undefined | null} projectPath
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | undefined}
 */
export function tenantIdForProjectPath(projectPath, env = process.env) {
  if (!projectPath) return undefined;
  const tenantsRoot = path.join(getDataRoot(env), 'tenants');
  const rel = path.relative(tenantsRoot, path.resolve(projectPath));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
  const segments = rel.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[0] : undefined;
}
