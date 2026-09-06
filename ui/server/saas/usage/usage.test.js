/**
 * PD-SAAS-FORK: Router usage attribution + aggregation unit tests.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

function bucket(input, output, requests, cost) {
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    requestCount: requests,
    estimatedCost: cost,
  };
}

function fakeDashboard() {
  return {
    projects: [
      {
        fullPath: 'D:\\shared\\proj',
        sessions: [
          { sessionId: 'web-s_alice1', routing: { total: bucket(1000, 200, 3, 0.05), byModel: { 'qwen/q3': bucket(1000, 200, 3, 0.05) } } },
          { sessionId: 'web-s_bob1', routing: { total: bucket(500, 100, 2, 0.02), byModel: { 'qwen/q3': bucket(500, 100, 2, 0.02) } } },
          { sessionId: 'web-s_orphan', routing: { total: bucket(40, 10, 1, 0.001), byModel: {} } },
        ],
      },
    ],
    overall: {},
  };
}

test('usage: attributes router tokens per user and totals correctly', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-usage-test-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;

  const { bootstrapSaasControlPlane } = await import('../auth/bootstrap.js');
  const { controlUserDb, controlTenantDb, closeControlDatabase } = await import('../db/control.js');
  const { recordSessionOwner, aggregateRouterUsage } = await import('./store.js');

  await bootstrapSaasControlPlane({ log: () => {} });

  await controlTenantDb.ensureTenant('tenant-alice', 'alice');
  await controlTenantDb.ensureTenant('tenant-bob', 'bob');
  const alice = await controlUserDb.createUser({ tenantId: 'tenant-alice', username: 'alice', passwordHash: 'x' });
  const bob = await controlUserDb.createUser({ tenantId: 'tenant-bob', username: 'bob', passwordHash: 'x' });

  await recordSessionOwner({ sessionId: 'web-s_alice1', userId: alice.id, tenantId: 'tenant-alice', projectPath: 'D:\\shared\\proj' });
  await recordSessionOwner({ sessionId: 'web-s_bob1', userId: bob.id, tenantId: 'tenant-bob', projectPath: 'D:\\shared\\proj' });

  const all = await aggregateRouterUsage(fakeDashboard());

  assert.equal(all.total.totalTokens, 1200 + 600 + 50, 'grand total tokens sum all sessions');
  assert.equal(all.attributed, 2, 'two attributed sessions');
  assert.equal(all.unattributed, 1, 'one orphan session');

  const aliceRow = all.byUser.find((u) => u.userId === alice.id);
  const bobRow = all.byUser.find((u) => u.userId === bob.id);
  assert.equal(aliceRow.totalTokens, 1200, 'alice total');
  assert.equal(bobRow.totalTokens, 600, 'bob total');
  assert.equal(aliceRow.username, 'alice');

  const aliceOnly = await aggregateRouterUsage(fakeDashboard(), { filterUserId: alice.id });
  assert.equal(aliceOnly.total.totalTokens, 1200, 'alice-only total excludes bob + orphan');
  assert.equal(aliceOnly.byProject.length, 1);
  assert.equal(aliceOnly.byProject[0].totalTokens, 1200);

  const bobOnly = await aggregateRouterUsage(fakeDashboard(), { filterUserId: bob.id });
  assert.equal(bobOnly.total.totalTokens, 600, 'bob-only total excludes alice + orphan');

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true });
});
