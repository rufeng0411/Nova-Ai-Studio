#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Soft-delete conversation_catalog rows with no readable transcript.
 *
 *   node scripts/cleanup-orphan-catalog-sessions.mjs --data-root=.saas-dev-data
 *   node scripts/cleanup-orphan-catalog-sessions.mjs --dry-run
 *   node scripts/cleanup-orphan-catalog-sessions.mjs --user-id=1 --gate
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    dataRoot: path.join(REPO_ROOT, '.saas-dev-data'),
    dryRun: false,
    userId: null,
    tenantId: null,
    gate: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--gate') opts.gate = true;
    else if (arg.startsWith('--data-root=')) {
      opts.dataRoot = path.resolve(arg.slice('--data-root='.length));
    } else if (arg.startsWith('--user-id=')) {
      opts.userId = Number(arg.slice('--user-id='.length)) || null;
    } else if (arg.startsWith('--tenant-id=')) {
      opts.tenantId = arg.slice('--tenant-id='.length) || null;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.env.DATA_ROOT = opts.dataRoot;
  process.env.PILOTDECK_SAAS_MODE = '1';

  const { getControlDriver } = await import('../ui/server/saas/db/control.js');
  const { catalogStore } = await import('../ui/server/saas/conversation/CatalogStore.js');
  const { isOrphanCatalogSessionForTenant } = await import(
    '../ui/server/saas/conversation/orphanCatalogSessions.js'
  );

  const db = await getControlDriver();
  const params = [];
  let sql = `SELECT tenant_id, user_id, session_id, legacy_project_id, title, first_prompt,
                    transcript_rel_path, execution_status, status, last_activity_at
             FROM conversation_catalog
             WHERE deleted_at IS NULL`;
  if (opts.tenantId) {
    sql += ' AND tenant_id = ?';
    params.push(opts.tenantId);
  }
  if (opts.userId != null) {
    sql += ' AND user_id = ?';
    params.push(opts.userId);
  }
  sql += ' ORDER BY last_activity_at DESC';

  const rows = await db.queryAll(sql, params);
  const tenantHomes = new Map();
  const orphans = [];

  for (const row of rows) {
    const tenantId = row.tenant_id;
    if (!tenantHomes.has(tenantId)) {
      tenantHomes.set(tenantId, path.join(opts.dataRoot, 'tenants', tenantId));
    }
    const tenantPilotHome = tenantHomes.get(tenantId);
    const catalogRow = {
      sessionId: row.session_id,
      transcriptRelPath: row.transcript_rel_path,
      executionStatus: row.execution_status ?? 'idle',
    };
    const orphan = await isOrphanCatalogSessionForTenant({
      sessionId: row.session_id,
      tenantPilotHome,
      catalogTranscriptRel: row.transcript_rel_path,
      catalogRow,
    });
    if (orphan) {
      orphans.push(row);
    }
  }

  console.log(`[cleanup-orphan-catalog] scanned=${rows.length} orphans=${orphans.length} dryRun=${opts.dryRun}`);

  let deleted = 0;
  for (const row of orphans) {
    const label = [
      row.legacy_project_id,
      row.session_id,
      (row.title || row.first_prompt || '(empty)').slice(0, 48),
      row.last_activity_at,
    ].join(' | ');
    if (opts.dryRun) {
      console.log(`  would soft-delete: ${label}`);
      continue;
    }
    const ok = await catalogStore.softDelete({
      tenantId: row.tenant_id,
      userId: row.user_id,
      sessionId: row.session_id,
    });
    if (ok) {
      deleted += 1;
      console.log(`  soft-deleted: ${label}`);
    }
  }

  if (!opts.dryRun) {
    console.log(`[cleanup-orphan-catalog] soft-deleted=${deleted}`);
  }

  if (opts.gate && orphans.length > 0) {
    console.error('[cleanup-orphan-catalog] gate failed: orphan catalog rows remain');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[cleanup-orphan-catalog] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
