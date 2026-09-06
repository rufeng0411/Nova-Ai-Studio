/**
 * PD-SAAS-FORK: Legacy Bridge — skills/capabilities keep ~/.pilotdeck; tenant projects use DATA_ROOT.
 */
import os from 'node:os';
import path from 'node:path';
import { resolvePilotHome } from '../utils/pilotPaths.js';
import { ensureTenantProjectsDir, getTenantProjectsRoot, DEFAULT_TENANT_ID } from './tenant/paths.js';

/**
 * Skills, MCP config, and capabilities catalog always read the legacy home.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function getLegacyPilotHome(env = process.env) {
  const explicit = env.PILOTDECK_LEGACY_PILOT_HOME;
  if (explicit && explicit.trim()) {
    return path.resolve(explicit.trim());
  }
  const legacyEnv = { ...env, PILOT_HOME: env.PILOT_HOME ?? path.join(os.homedir(), '.pilotdeck') };
  return resolvePilotHome(legacyEnv);
}

/**
 * Ensure default tenant project tree exists (idempotent).
 * @param {string} [tenantId]
 * @param {Record<string, string | undefined>} [env]
 */
export function bootstrapTenantLayout(tenantId = DEFAULT_TENANT_ID, env = process.env) {
  ensureTenantProjectsDir(tenantId, env);
  return {
    legacyPilotHome: getLegacyPilotHome(env),
    tenantProjectsRoot: getTenantProjectsRoot(tenantId, env),
  };
}
