#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Physically purge all「通用 / general」sidebar conversations for one SaaS user.
 *
 * Usage:
 *   node scripts/purge-general-folder.mjs --username admin [--dry-run]
 *
 * Deletes: jsonl transcripts, conversation_catalog (+ outbox), session tombstones,
 * turn-queue slots, usage_session_owner rows for those sessions.
 * Does NOT delete user-created workspace projects (`workspaces-*`).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectId } from '../ui/server/utils/pilotPaths.js';
import { listWorkspacesForUser } from '../ui/server/saas/storage/workspaceStore.js';
import { cancelQueuedTurn } from '../ui/server/saas/concurrency/turnQueueManager.js';
import { releaseTurnSlot, clearTurnSlotsForUser } from '../ui/server/saas/concurrency/turnSlotRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    username: 'admin',
    dryRun: false,
    dataRoot: process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data'),
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--username=')) opts.username = arg.slice('--username='.length);
    else if (arg.startsWith('--data-root=')) opts.dataRoot = path.resolve(arg.slice('--data-root='.length));
  }
  return opts;
}

async function unlinkIfExists(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * @param {number} userId
 * @param {string} tenantId
 * @param {string} tenantPilotHome
 */
async function resolveGeneralLegacyProjectIds(userId, tenantId, tenantPilotHome) {
  const legacyIds = new Set(['general', createProjectId(tenantPilotHome), 'Ai-pilotdeck-general']);
  const workspaces = await listWorkspacesForUser(userId, tenantId);
  const generalWs = workspaces.find((ws) => ws.legacyProjectId === 'general') ?? null;
  const userWorkspaceUuids = new Set(
    workspaces
      .filter((ws) => ws.legacyProjectId.startsWith('workspaces-'))
      .map((ws) => ws.workspaceUuid),
  );

  if (generalWs) {
    legacyIds.add(generalWs.legacyProjectId);
    const generalCanonical = path.resolve(generalWs.canonicalProjectKey);
    for (const ws of workspaces) {
      if (path.resolve(ws.canonicalProjectKey) === generalCanonical) {
        legacyIds.add(ws.legacyProjectId);
      }
    }
  }

  const db = await (await import('../ui/server/saas/db/control.js')).getControlDriver();
  const catalogLegacyRows = await db.queryAll(
    `SELECT DISTINCT legacy_project_id AS legacy_project_id
     FROM conversation_catalog
     WHERE tenant_id = ? AND user_id = ?`,
    [tenantId, userId],
  );
  for (const row of catalogLegacyRows ?? []) {
    const id = String(row.legacy_project_id || '');
    if (!id || id.startsWith('workspaces-')) continue;
    // SaaS 用户自建项目一律 workspaces-*；其余 legacy id 均属「通用」及其历史别名。
    const uuidMatch = id.match(
      /workspaces-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (uuidMatch && userWorkspaceUuids.has(uuidMatch[1])) continue;
    legacyIds.add(id);
  }

  const projectsDir = path.join(tenantPilotHome, 'projects');
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = entry.name;
      if (id.startsWith('.')) continue;
      if (id.startsWith('workspaces-')) continue;
      const uuidMatch = id.match(
        /workspaces-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
      if (uuidMatch && userWorkspaceUuids.has(uuidMatch[1])) continue;
      legacyIds.add(id);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  return { legacyIds: [...legacyIds], generalWs };
}

async function cleanupSessionTurnResources(input) {
  cancelQueuedTurn({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionKey: input.sessionKey,
  });
  await releaseTurnSlot({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionKey: input.sessionKey,
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.env.DATA_ROOT = opts.dataRoot;
  process.env.PILOTDECK_SAAS_MODE = '1';

  const { getControlDriver } = await import('../ui/server/saas/db/control.js');
  const { catalogStore } = await import('../ui/server/saas/conversation/CatalogStore.js');
  const { recordSessionTombstone } = await import('../ui/server/saas/conversation/sessionTombstoneStore.js');
  const { removeBridgeSessionState } = await import('../ui/server/pilotdeck-bridge.js');

  const db = await getControlDriver();
  const user = await db.queryOne(
    'SELECT id, tenant_id, username FROM users WHERE username = ? AND is_active = 1 LIMIT 1',
    [opts.username],
  );
  if (!user) {
    console.error(`[purge-general] user not found: ${opts.username}`);
    process.exit(1);
  }

  const tenantId = user.tenant_id;
  const userId = user.id;
  const tenantRoot = path.join(opts.dataRoot, 'tenants', tenantId);
  const { legacyIds, generalWs } = await resolveGeneralLegacyProjectIds(userId, tenantId, tenantRoot);

  console.log(`[purge-general] user=${opts.username} id=${userId} tenant=${tenantId}`);
  console.log(`[purge-general] general workspace uuid=${generalWs?.workspaceUuid ?? 'n/a'}`);
  console.log(`[purge-general] legacy ids (${legacyIds.length}):`);
  for (const id of legacyIds.sort()) console.log(`  - ${id}`);
  console.log(`[purge-general] dryRun=${opts.dryRun}`);

  const catalogRows = [];
  for (const legacyProjectId of legacyIds) {
    const rows = await db.queryAll(
      `SELECT session_id, transcript_rel_path, legacy_project_id
       FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND legacy_project_id = ?`,
      [tenantId, userId, legacyProjectId],
    );
    catalogRows.push(...rows);
  }

  const sessionIds = new Set(catalogRows.map((r) => r.session_id));
  const transcriptPaths = new Set();

  for (const row of catalogRows) {
    if (row.transcript_rel_path) {
      transcriptPaths.add(path.join(tenantRoot, ...row.transcript_rel_path.split('/').filter(Boolean)));
    }
  }

  for (const legacyProjectId of legacyIds) {
    const chatsDir = path.join(tenantRoot, 'projects', legacyProjectId, 'chats');
    try {
      const names = await fs.readdir(chatsDir);
      for (const name of names) {
        if (!name.endsWith('.jsonl')) continue;
        transcriptPaths.add(path.join(chatsDir, name));
        const sid = name.replace(/\.jsonl$/i, '').replace(/^web-s_/, 'web:s_');
        sessionIds.add(sid);
        sessionIds.add(name.replace(/\.jsonl$/i, ''));
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  console.log(`[purge-general] sessions=${sessionIds.size} transcript files=${transcriptPaths.size} catalog rows=${catalogRows.length}`);

  if (opts.dryRun) {
    console.log('[purge-general] dry-run complete — no changes made');
    return;
  }

  let jsonlRemoved = 0;
  for (const filePath of transcriptPaths) {
    if (await unlinkIfExists(filePath)) jsonlRemoved += 1;
  }

  let catalogRemoved = 0;
  for (const legacyProjectId of legacyIds) {
    catalogRemoved += await catalogStore.hardDeleteByProject({ tenantId, userId, legacyProjectId });
  }

  let queueCleaned = 0;
  for (const sessionId of sessionIds) {
    if (!sessionId) continue;
    try {
      await recordSessionTombstone({ sessionId, tenantId, userId, reason: 'admin-purge-general' });
      removeBridgeSessionState(sessionId);
      await cleanupSessionTurnResources({ tenantId, userId, sessionKey: sessionId });
      queueCleaned += 1;
    } catch (error) {
      console.warn('[purge-general] turn cleanup failed for', sessionId, error?.message || error);
    }
  }

  await clearTurnSlotsForUser({ tenantId, userId }).catch(() => undefined);

  let usageOwnerRemoved = 0;
  for (const sessionId of sessionIds) {
    if (!sessionId) continue;
    const result = await db.execute(
      'DELETE FROM usage_session_owner WHERE session_id = ? AND user_id = ?',
      [sessionId, userId],
    ).catch(() => ({ changes: 0 }));
    usageOwnerRemoved += result.changes ?? 0;
  }

  const tombstoneResult = await db.execute(
    'DELETE FROM session_tombstones WHERE tenant_id = ? AND user_id = ?',
    [tenantId, userId],
  ).catch(() => ({ changes: 0 }));

  let cronRemoved = 0;
  try {
    const { getPilotDeckGatewayIfReady } = await import('../ui/server/pilotdeck-bridge.js');
    const gateway = await getPilotDeckGatewayIfReady();
    if (gateway) {
      const result = await gateway.cronList({ includeHistory: false, limit: 1000 });
      const generalCanonical = generalWs ? path.resolve(generalWs.canonicalProjectKey) : null;
      for (const task of result.tasks ?? []) {
        const projectKey = task.projectKey ? path.resolve(task.projectKey) : null;
        const isGeneralTask =
          !projectKey ||
          legacyIds.some((id) => projectKey.includes(id)) ||
          (generalCanonical && projectKey === generalCanonical) ||
          (generalWs && projectKey.includes(generalWs.workspaceUuid));
        if (!isGeneralTask) continue;
        await gateway.cronDelete({ taskId: task.taskId, stopRunning: true }).catch(() => undefined);
        cronRemoved += 1;
      }
    }
  } catch (error) {
    console.warn('[purge-general] cron cleanup skipped:', error?.message || error);
  }

  const outboxLeft = await db.queryOne(
    'SELECT COUNT(*) AS c FROM conversation_catalog_outbox WHERE tenant_id = ? AND user_id = ?',
    [tenantId, userId],
  );

  console.log('[purge-general] done');
  console.log(`  jsonl removed: ${jsonlRemoved}`);
  console.log(`  catalog rows removed: ${catalogRemoved}`);
  console.log(`  turn-queue cleaned sessions: ${queueCleaned}`);
  console.log(`  usage_session_owner removed: ${usageOwnerRemoved}`);
  console.log(`  cron jobs removed: ${cronRemoved}`);
  console.log(`  tombstones cleared: ${tombstoneResult.changes ?? 0}`);
  console.log(`  catalog outbox remaining (all projects): ${outboxLeft?.c ?? '?'}`);
}

main().catch((error) => {
  console.error('[purge-general] FAIL:', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
