/**
 * PD-SAAS-FORK: Resolve general project cloud hub cwd for integration harnesses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCanonicalHubRoot } from '../../ui/server/saas/storage/paths.js';
import { getDataRoot } from '../../ui/server/saas/tenant/paths.js';

/**
 * @param {string} serverUrl
 * @param {string} token
 */
export async function fetchGeneralWorkspaceCwd(serverUrl, token) {
  const base = serverUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/projects?fresh=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const projects = data.projects ?? data;
  if (!Array.isArray(projects)) return null;
  const general = projects.find((p) => p.name === 'general' || p.displayName === 'general');
  const cwd = general?.fullPath || general?.path;
  return typeof cwd === 'string' && cwd.trim() ? cwd.trim() : null;
}

/**
 * @param {string} serverUrl
 * @param {{ username?: string, password?: string }} [opts]
 */
export async function fetchSaasAuthToken(serverUrl, opts = {}) {
  const base = serverUrl.replace(/\/$/, '');
  const username = opts.username || process.env.SAAS_E2E_USER || 'admin';
  const password = opts.password || process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';
  try {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const token = data?.token || data?.accessToken || data?.authToken;
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Offline fallback: first workspace under tenant default user 1.
 * @param {string} [dataRoot]
 */
export function guessGeneralWorkspaceCwdFromDataRoot(dataRoot = process.env.DATA_ROOT || getDataRoot()) {
  const usersRoot = path.join(dataRoot, 'tenants', 'default', 'cloud-storage', 'users', '1', 'workspaces');
  if (!fs.existsSync(usersRoot)) return null;
  const entries = fs.readdirSync(usersRoot, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (!entries.length) return null;
  return path.join(usersRoot, entries[0].name);
}

/**
 * @param {{ serverUrl?: string, token?: string, dataRoot?: string, username?: string, password?: string }} opts
 */
export async function resolveGeneralWorkspaceCwd(opts = {}) {
  const serverUrl = opts.serverUrl || process.env.SERVER_URL || 'http://127.0.0.1:3001';
  if (opts.token) {
    const fromApi = await fetchGeneralWorkspaceCwd(serverUrl, opts.token);
    if (fromApi) return fromApi;
  }
  const token = await fetchSaasAuthToken(serverUrl, opts);
  if (token) {
    const fromApi = await fetchGeneralWorkspaceCwd(serverUrl, token);
    if (fromApi) return fromApi;
  }
  return guessGeneralWorkspaceCwdFromDataRoot(opts.dataRoot);
}

export { getCanonicalHubRoot };
