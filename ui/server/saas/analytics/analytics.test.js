/**
 * PD-SAAS-FORK: Analytics aggregation tests.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('analytics: dashboard aggregation shape', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-analytics-test-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;

  const { bootstrapSaasControlPlane } = await import('../auth/bootstrap.js');
  const { recordAnalyticsEvent, aggregateDashboardStats } = await import('./store.js');
  const { closeControlDatabase } = await import('../db/control.js');

  await bootstrapSaasControlPlane({ log: () => {} });
  await recordAnalyticsEvent('visit', { userId: 1, tenantId: 'default' });

  const stats = await aggregateDashboardStats({});
  assert.equal(typeof stats.ops.total, 'number');
  assert.ok(stats.visits.series.length >= 14);
  assert.ok(stats.subscriptions.active >= 0);

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true });
});

test('analytics: listAdminUsers includes wallet balance', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-analytics-users-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;

  const { bootstrapSaasControlPlane } = await import('../auth/bootstrap.js');
  const { listAdminUsers } = await import('./store.js');
  const { billingDb } = await import('../billing/store.js');
  const { closeControlDatabase, getControlDriver } = await import('../db/control.js');

  await bootstrapSaasControlPlane({ log: () => {} });
  const db = await getControlDriver();
  await db.execute('INSERT INTO users (tenant_id, username, password_hash, role) VALUES (?, ?, ?, ?)', [
    'default',
    'balance_test_user',
    'hash',
    'member',
  ]);
  const row = await db.queryOne('SELECT id FROM users WHERE username = ?', ['balance_test_user']);
  await billingDb.addCredit(row.id, 250, { reason: 'admin_credit' });

  const users = await listAdminUsers('balance_test');
  assert.equal(users.length, 1);
  assert.equal(users[0].balance, 250);

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true });
});
