/**
 * PD-SAAS-FORK: SaaS file storage path helpers (local bindings + cloud hub).
 */
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { getTenantRoot } from '../tenant/paths.js';

/**
 * @param {string} tenantId
 * @param {number | string} userId
 * @param {string} workspaceUuid
 * @param {Record<string, string | undefined>} [env]
 */
export function getCanonicalHubRoot(tenantId, userId, workspaceUuid, env = process.env) {
  return path.join(
    getTenantRoot(tenantId, env),
    'cloud-storage',
    'users',
    String(userId),
    'workspaces',
    workspaceUuid,
  );
}

/**
 * @param {string} tenantId
 * @param {number | string} userId
 * @param {string} deviceId
 * @param {string} workspaceUuid
 * @param {Record<string, string | undefined>} [env]
 */
export function getLocalDeviceRoot(tenantId, userId, deviceId, workspaceUuid, env = process.env) {
  return path.join(
    getTenantRoot(tenantId, env),
    'local-bindings',
    'users',
    String(userId),
    'devices',
    deviceId,
    'workspaces',
    workspaceUuid,
  );
}

/**
 * @param {string} tenantId
 * @param {number | string} userId
 * @param {Record<string, string | undefined>} [env]
 */
export function getUserCloudStorageRoot(tenantId, userId, env = process.env) {
  return path.join(getTenantRoot(tenantId, env), 'cloud-storage', 'users', String(userId));
}

/**
 * All on-disk cloud hub roots for a user (`.../workspaces/{uuid}`), including
 * orphan hubs the gateway wrote to before workspace registration caught up.
 * @param {string} tenantId
 * @param {number | string} userId
 * @param {Record<string, string | undefined>} [env]
 */
export function listFilesystemWorkspaceHubsForUser(tenantId, userId, env = process.env) {
  const workspacesDir = path.join(getUserCloudStorageRoot(tenantId, userId, env), 'workspaces');
  if (!existsSync(workspacesDir)) {
    return [];
  }
  const hubs = [];
  for (const entry of readdirSync(workspacesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    hubs.push(path.join(workspacesDir, entry.name));
  }
  return hubs;
}

/**
 * @param {string} tenantId
 * @param {number | string} userId
 * @param {Record<string, string | undefined>} [env]
 */
export function getUserLocalBindingsRoot(tenantId, userId, env = process.env) {
  return path.join(getTenantRoot(tenantId, env), 'local-bindings', 'users', String(userId));
}

/**
 * Resolve active file root for reads/writes (WPS: sync on → canonical hub).
 * @param {{
 *   storageKind: 'local' | 'cloud';
 *   syncEnabled: boolean;
 *   canonicalProjectKey: string;
 *   localRootPath?: string | null;
 *   activeDeviceId?: string | null;
 *   originDeviceId?: string | null;
 * }} row
 */
export function resolveFileRootFromWorkspace(row, _activeDeviceId) {
  if (!row) return null;
  // PD-SAAS-FORK: Phase 2 cloud-only — always read/write the canonical hub.
  return row.canonicalProjectKey || row.localRootPath || null;
}

/**
 * Session / transcript anchor is always canonical when sync is on; else local or canonical for cloud-only.
 * @param {{
 *   storageKind: 'local' | 'cloud';
 *   syncEnabled: boolean;
 *   canonicalProjectKey: string;
 *   localRootPath?: string | null;
 * }} row
 */
export function resolveSessionProjectKeyFromWorkspace(row) {
  if (!row) return null;
  // PD-SAAS-FORK: Phase 2 cloud-only — session anchor follows canonical hub.
  return row.canonicalProjectKey || row.localRootPath || null;
}

/**
 * @param {string} absPath
 * @param {number | string} userId
 */
export function pathContainsUserSegment(absPath, userId) {
  const normalized = path.resolve(absPath).replace(/\\/g, '/');
  const segment = `/users/${userId}/`;
  return normalized.includes(segment);
}
