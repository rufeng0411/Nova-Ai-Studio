#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Integration test for SQLite → PostgreSQL control DB migration.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_PG_TEST_URL,
  ensurePgTestDatabase,
  isPgReachable,
  preparePgTestDatabase,
  resetPgControlTables,
} from './lib/saasPgTestEnv.mjs';
import { migrateControlSqliteToPg } from './migrate-control-sqlite-to-pg.mjs';

const pgAvailable = await isPgReachable(DEFAULT_PG_TEST_URL);

test('migrate-control-sqlite-to-pg: sqlite seed → pg import + verify', { skip: !pgAvailable && 'PostgreSQL not reachable' }, async () => {
  await ensurePgTestDatabase(DEFAULT_PG_TEST_URL);
  await preparePgTestDatabase(DEFAULT_PG_TEST_URL);

  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-migrate-src-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;

  const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');
  const { billingDb } = await import('../ui/server/saas/billing/store.js');
  const { controlUserDb, closeControlDatabase, getControlDbPath } = await import('../ui/server/saas/db/control.js');
  const { recordAnalyticsEvent } = await import('../ui/server/saas/analytics/store.js');

  await bootstrapSaasControlPlane({ log: () => {} });
  const admin = await controlUserDb.getUserByUsername('admin');
  assert.ok(admin);
  await billingDb.subscribeUser(admin.id, 'trial');
  await recordAnalyticsEvent('visit', { userId: admin.id, tenantId: admin.tenant_id });
  await closeControlDatabase();

  const source = getControlDbPath();
  assert.ok(fs.existsSync(source));

  const result = await migrateControlSqliteToPg({
    source,
    target: DEFAULT_PG_TEST_URL,
  });
  assert.equal(result.ok, true);
  assert.ok(result.imported.users >= 1);

  process.env.SAAS_DATABASE_URL = DEFAULT_PG_TEST_URL;
  const { openControlDatabase, closeControlDatabase: closePg } = await import('../ui/server/saas/db/control.js');
  await openControlDatabase();
  const pgAdmin = await controlUserDb.getUserByUsername('admin');
  assert.ok(pgAdmin);
  assert.equal(pgAdmin.id, admin.id);
  const wallet = await billingDb.getWallet(pgAdmin.id);
  assert.ok((wallet?.balance ?? 0) >= 100);
  await closePg();

  delete process.env.SAAS_DATABASE_URL;
  fs.rmSync(dataRoot, { recursive: true, force: true });
  await preparePgTestDatabase(DEFAULT_PG_TEST_URL);
});

if (!pgAvailable) {
  console.warn('[migrate-control-sqlite-to-pg.test] SKIP: PostgreSQL not reachable at', DEFAULT_PG_TEST_URL);
}
