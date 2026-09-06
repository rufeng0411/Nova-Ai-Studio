/**
 * PD-SAAS-FORK: Resolve named SaaS project workspace cwd for integration harnesses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDataRoot } from '../../ui/server/saas/tenant/paths.js';
import { fetchSaasAuthToken } from './resolveGeneralWorkspaceCwd.mjs';

/**
 * @param {string} serverUrl
 * @param {string} token
 * @param {string} projectName displayName or slug name
 */
export async function fetchProjectWorkspaceCwd(serverUrl, token, projectName) {
  const base = serverUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/projects?fresh=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const projects = data.projects ?? data;
  if (!Array.isArray(projects)) return null;
  const needle = String(projectName ?? '').trim().toLowerCase();
  const match = projects.find((p) => {
    const name = String(p.name ?? '').toLowerCase();
    const display = String(p.displayName ?? p.display_name ?? '').toLowerCase();
    return name === needle || display === needle;
  });
  const cwd = match?.fullPath || match?.path;
  return typeof cwd === 'string' && cwd.trim() ? cwd.trim() : null;
}

/**
 * @param {string} serverUrl
 * @param {string} token
 * @param {string} displayName
 */
export async function ensureProjectWorkspace(serverUrl, token, displayName) {
  const existing = await fetchProjectWorkspaceCwd(serverUrl, token, displayName);
  if (existing) return existing;

  const base = serverUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/projects/create-workspace`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    throw new Error(`create-workspace failed: ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  const cwd = data?.fullPath || data?.path || data?.project?.fullPath || data?.project?.path;
  if (typeof cwd === 'string' && cwd.trim()) return cwd.trim();
  return fetchProjectWorkspaceCwd(serverUrl, token, displayName);
}

/**
 * @param {string} serverUrl
 * @param {string} token
 * @param {string} projectName
 */
export async function resolveProjectWorkspaceCwd(serverUrl, token, projectName) {
  const fromApi = await fetchProjectWorkspaceCwd(serverUrl, token, projectName);
  if (fromApi) return fromApi;
  return ensureProjectWorkspace(serverUrl, token, projectName);
}

/**
 * Offline guess by display folder name under tenant cloud storage.
 * @param {string} displayName
 * @param {string} [dataRoot]
 */
export function guessProjectWorkspaceCwdFromDataRoot(displayName, dataRoot = process.env.DATA_ROOT || getDataRoot()) {
  const usersRoot = path.join(dataRoot, 'tenants', 'default', 'cloud-storage', 'users', '1', 'workspaces');
  if (!fs.existsSync(usersRoot)) return null;
  for (const entry of fs.readdirSync(usersRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const labelPath = path.join(usersRoot, entry.name, '.display-name');
    if (fs.existsSync(labelPath) && fs.readFileSync(labelPath, 'utf8').trim() === displayName) {
      return path.join(usersRoot, entry.name);
    }
  }
  return null;
}

/**
 * @param {{ serverUrl?: string; token?: string; projectName?: string; username?: string; password?: string; dataRoot?: string }} opts
 */
export async function resolveProjectWorkspaceCwdWithFallback(opts = {}) {
  const serverUrl = opts.serverUrl || process.env.SERVER_URL || 'http://127.0.0.1:7990';
  const projectName = opts.projectName || process.env.KOREA_PROJECT_NAME || '测试韩国项目';
  const token = opts.token || await fetchSaasAuthToken(serverUrl, opts);
  if (token) {
    try {
      const cwd = await resolveProjectWorkspaceCwd(serverUrl, token, projectName);
      if (cwd) return { cwd, token, serverUrl, projectName };
    } catch {
      // fall through
    }
  }
  const guessed = guessProjectWorkspaceCwdFromDataRoot(projectName, opts.dataRoot);
  return { cwd: guessed, token, serverUrl, projectName };
}

export { fetchSaasAuthToken };
