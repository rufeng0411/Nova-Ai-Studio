/**
 * PD-SAAS-FORK: Tenant-scoped project paths under DATA_ROOT.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_TENANT_ID = 'default';

// PD-SAAS-FORK: Per-user tenant id for registered members (admin stays on `default`).
/**
 * Per-user tenant id for registered members (platform admin stays on `default`).
 * @param {string} username
 */
export function tenantIdForUsername(username) {
  const slug = String(username || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `tenant-${slug || 'user'}`;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} Absolute SaaS data root (control DB + tenant trees).
 */
export function getDataRoot(env = process.env) {
  if (env.DATA_ROOT && env.DATA_ROOT.trim()) {
    return path.resolve(env.DATA_ROOT.trim());
  }
  return path.join(os.homedir(), '.pilotdeck-saas');
}

/**
 * @param {string} tenantId
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} DATA_ROOT/tenants/{id}
 */
export function getTenantRoot(tenantId, env = process.env) {
  const safeId = String(tenantId || DEFAULT_TENANT_ID).trim() || DEFAULT_TENANT_ID;
  return path.join(getDataRoot(env), 'tenants', safeId);
}

/**
 * @param {string} tenantId
 * @param {Record<string, string | undefined>} [env]
 * @returns {string} DATA_ROOT/tenants/{id}/projects
 */
export function getTenantProjectsRoot(tenantId, env = process.env) {
  return path.join(getTenantRoot(tenantId, env), 'projects');
}

/**
 * Pilot home shape for listProjects: parent dir whose `projects/` child holds tenant data.
 * @param {string} tenantId
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function getTenantPilotHome(tenantId, env = process.env) {
  return getTenantRoot(tenantId, env);
}

/**
 * @param {string} tenantId
 * @param {Record<string, string | undefined>} [env]
 */
export function ensureTenantProjectsDir(tenantId, env = process.env) {
  const projectsRoot = getTenantProjectsRoot(tenantId, env);
  fs.mkdirSync(projectsRoot, { recursive: true });
  return projectsRoot;
}
