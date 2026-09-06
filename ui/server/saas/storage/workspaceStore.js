/**
 * PD-SAAS-FORK: user_workspaces persistence.
 */
import { getControlDriver } from '../db/control.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    tenantId: String(row.tenant_id),
    workspaceUuid: String(row.workspace_uuid),
    legacyProjectId: String(row.legacy_project_id),
    displayName: String(row.display_name),
    storageKind: row.storage_kind === 'cloud' ? 'cloud' : 'local',
    localRootPath: row.local_root_path ? String(row.local_root_path) : null,
    canonicalProjectKey: String(row.canonical_project_key),
    originDeviceId: row.origin_device_id ? String(row.origin_device_id) : null,
    syncEnabled: Boolean(row.sync_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspacesForUser(userId, tenantId) {
  if (!userId || !tenantId) return [];
  const db = await getControlDriver();
  const rows = await db.queryAll(
    `SELECT * FROM user_workspaces
     WHERE user_id = ? AND tenant_id = ?
     ORDER BY updated_at DESC`,
    [userId, tenantId],
  );
  return rows.map(mapRow);
}

export async function getWorkspaceByLegacyProjectId(userId, tenantId, legacyProjectId) {
  if (!userId || !tenantId || !legacyProjectId) return null;
  const db = await getControlDriver();
  const row = await db.queryOne(
    `SELECT * FROM user_workspaces
     WHERE user_id = ? AND tenant_id = ? AND legacy_project_id = ?`,
    [userId, tenantId, legacyProjectId],
  );
  return mapRow(row);
}

export async function getWorkspaceByUuid(userId, tenantId, workspaceUuid) {
  if (!userId || !tenantId || !workspaceUuid) return null;
  const db = await getControlDriver();
  const row = await db.queryOne(
    `SELECT * FROM user_workspaces
     WHERE user_id = ? AND tenant_id = ? AND workspace_uuid = ?`,
    [userId, tenantId, workspaceUuid],
  );
  return mapRow(row);
}

export async function insertWorkspace(record) {
  const db = await getControlDriver();
  const result = await db.execute(
    `INSERT INTO user_workspaces (
      user_id, tenant_id, workspace_uuid, legacy_project_id, display_name,
      storage_kind, local_root_path, canonical_project_key, origin_device_id, sync_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.userId,
      record.tenantId,
      record.workspaceUuid,
      record.legacyProjectId,
      record.displayName,
      record.storageKind,
      record.localRootPath ?? null,
      record.canonicalProjectKey,
      record.originDeviceId ?? null,
      record.syncEnabled ? 1 : 0,
    ],
  );
  return { id: result.lastInsertId, ...record };
}

export async function listAllWorkspaces() {
  const db = await getControlDriver();
  const rows = await db.queryAll(
    `SELECT * FROM user_workspaces ORDER BY user_id, tenant_id, legacy_project_id`,
  );
  return rows.map(mapRow);
}

export async function promoteWorkspaceToCloudOnly(workspaceId) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE user_workspaces
     SET storage_kind = 'cloud',
         local_root_path = NULL,
         origin_device_id = NULL,
         sync_enabled = 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [workspaceId],
  );
}

export async function updateWorkspaceSync(workspaceId, syncEnabled) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE user_workspaces SET sync_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [syncEnabled ? 1 : 0, workspaceId],
  );
}

export async function updateSyncForUser(userId, tenantId, syncEnabled) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE user_workspaces SET sync_enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND tenant_id = ?`,
    [syncEnabled ? 1 : 0, userId, tenantId],
  );
}

export async function touchWorkspace(workspaceId) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE user_workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [workspaceId],
  );
}

export async function updateWorkspaceDisplayName(workspaceId, displayName) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE user_workspaces SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [displayName, workspaceId],
  );
}

export async function deleteWorkspaceForUser(userId, tenantId, legacyProjectId) {
  if (!userId || !tenantId || !legacyProjectId) return false;
  const db = await getControlDriver();
  const result = await db.execute(
    `DELETE FROM user_workspaces
     WHERE user_id = ? AND tenant_id = ? AND legacy_project_id = ?`,
    [userId, tenantId, legacyProjectId],
  );
  return result.changes > 0;
}

export async function insertSyncJob(workspaceId, status = 'pending') {
  const db = await getControlDriver();
  const result = await db.execute(
    `INSERT INTO storage_sync_jobs (workspace_id, status, started_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [workspaceId, status],
  );
  return result.lastInsertId;
}

export async function listActiveSyncProjectIds(userId, tenantId) {
  const db = await getControlDriver();
  const rows = await db.queryAll(
    `SELECT w.legacy_project_id AS legacy_project_id
     FROM storage_sync_jobs j
     INNER JOIN user_workspaces w ON w.id = j.workspace_id
     WHERE w.user_id = ? AND w.tenant_id = ?
       AND j.status IN ('pending', 'running')
       AND j.finished_at IS NULL`,
    [userId, tenantId],
  );
  return rows.map((row) => String(row.legacy_project_id));
}

export async function finishSyncJob(jobId, { status, bytesSynced = 0, errorMessage = null }) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE storage_sync_jobs
     SET status = ?, bytes_synced = ?, error_message = ?, finished_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, bytesSynced, errorMessage, jobId],
  );
}
