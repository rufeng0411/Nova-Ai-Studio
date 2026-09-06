#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Inspect turn queue / slot state for a SaaS user.
 *
 * Usage:
 *   node scripts/diagnose-turn-queue.mjs --user admin
 *   DATA_ROOT=.saas-dev-data node scripts/diagnose-turn-queue.mjs --user admin --repair
 */
import process from 'node:process';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getDataRoot } from '../ui/server/saas/tenant/paths.js';
import {
  listTurnSlotSessionKeys,
  clearTurnSlotsForUser,
} from '../ui/server/saas/concurrency/turnSlotRegistry.js';

function parseArgs(argv) {
  const args = { user: null, userId: null, repair: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--repair') args.repair = true;
    else if (token === '--user') args.user = argv[++i] ?? null;
    else if (token === '--user-id') args.userId = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const dbPath = path.join(getDataRoot(process.env), 'control.db');
  const db = new Database(dbPath, { readonly: !args.repair });

  const userRow = args.userId
    ? db.prepare('SELECT id, username, tenant_id, role FROM users WHERE id = ?').get(args.userId)
    : db.prepare('SELECT id, username, tenant_id, role FROM users WHERE username = ?').get(args.user ?? 'admin');

  if (!userRow) {
    console.error('User not found');
    process.exit(1);
  }

  const tenantId = userRow.tenant_id;
  const userId = userRow.id;
  const rows = db.prepare(`
    SELECT session_id, execution_status, queue_position, title, last_activity_at, paused_reason
    FROM conversation_catalog
    WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
      AND execution_status IN ('queued', 'running', 'paused')
    ORDER BY last_activity_at DESC
  `).all(tenantId, userId);

  const heldSlots = await listTurnSlotSessionKeys({ tenantId, userId });
  console.log(`\n=== Turn queue diagnosis: ${userRow.username} (${tenantId}) ===`);
  console.log(`Control DB: ${dbPath}`);
  console.log(`User limit env: PILOTDECK_USER_MAX_ACTIVE_TURNS=${process.env.PILOTDECK_USER_MAX_ACTIVE_TURNS ?? '7'}`);
  console.log(`Global limit env: PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS=${process.env.PILOTDECK_GATEWAY_MAX_CONCURRENT_TURNS ?? '7'}`);
  console.log(`\nHeld turn slots (${heldSlots.length}):`);
  for (const key of heldSlots) console.log(`  - ${key}`);
  console.log(`\nCatalog active rows (${rows.length}):`);
  for (const row of rows) {
    console.log(`  - ${row.execution_status.padEnd(8)} ${row.session_id}  ${row.title ?? ''}`);
  }

  if (!args.repair) {
    console.log('\nRun with --repair to clear leaked slots and reset stale running rows.');
    db.close();
    return;
  }

  if (heldSlots.length > 0) {
    await clearTurnSlotsForUser({ tenantId, userId });
    console.log(`\nCleared ${heldSlots.length} held slot(s).`);
  }

  const update = db.prepare(`
    UPDATE conversation_catalog
    SET execution_status = 'queued', queue_position = COALESCE(queue_position, 1)
    WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND execution_status = 'running'
  `);
  for (const row of rows.filter((item) => item.execution_status === 'running')) {
    update.run(tenantId, userId, row.session_id);
    console.log(`Reset stale running → queued: ${row.session_id}`);
  }

  db.close();
  console.log('\nRepair complete. Restart Bridge or refresh the project sidebar to trigger queue pump.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
