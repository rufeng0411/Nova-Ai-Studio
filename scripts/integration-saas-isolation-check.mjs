/**
 * PD-SAAS-FORK: simulated isolation check for the three SaaS isolation fixes.
 *
 * Pure-logic assertions (no servers) over the shared scoping helpers:
 *   ① Always-On  — filterByTenantProjectKey / resolveCronTaskForTenant
 *   ② Memory     — resolveTenantMemoryRoot / resolveTenantHomeForProjectRoot
 *   ③ Router     — aggregateRouterUsage tenant inference for owner-less sessions
 *
 * Run with tsx so the .ts gateway helper can be imported alongside the JS ones:
 *   npx tsx scripts/integration-saas-isolation-check.mjs
 */
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-iso-check-'));
process.env.PILOTDECK_SAAS_MODE = '1';
process.env.DATA_ROOT = dataRoot;

const TENANTS = path.join(dataRoot, 'tenants');
const tenantAHome = path.join(TENANTS, 'tenant-a');
const tenantBHome = path.join(TENANTS, 'tenant-b');
const projA = path.join(tenantAHome, 'projects', 'proj1');
const projB = path.join(tenantBHome, 'projects', 'proj1');
const legacyProj = path.join(os.homedir(), '.pilotdeck', 'projects', 'old');

let passed = 0;
function ok(label) { passed += 1; console.log(`  ok ${label}`); }

// ── ① tenant scope helpers ───────────────────────────────────────────────
const { isProjectKeyInTenant, tenantIdForProjectPath } = await import('../ui/server/saas/tenant/scope.js');

assert.equal(isProjectKeyInTenant(projA, tenantAHome), true);
assert.equal(isProjectKeyInTenant(projB, tenantAHome), false, 'B project not in A home');
assert.equal(isProjectKeyInTenant(legacyProj, tenantAHome), false);
ok('isProjectKeyInTenant separates tenants');

assert.equal(tenantIdForProjectPath(projA), 'tenant-a');
assert.equal(tenantIdForProjectPath(projB), 'tenant-b');
assert.equal(tenantIdForProjectPath(legacyProj), undefined, 'legacy path → no tenant');
ok('tenantIdForProjectPath infers tenant from path');

// ── ① Always-On filtering + cron ownership ───────────────────────────────
const { saasRequestStore } = await import('../ui/server/saas/context.js');
const { filterByTenantProjectKey, resolveCronTaskForTenant } = await import('../ui/server/saas/alwaysOnScope.js');

const events = [
  { projectKey: projA, phase: 'discovery' },
  { projectKey: projB, phase: 'discovery' },
  { projectKey: legacyProj, phase: 'discovery' },
];

await saasRequestStore.run({ tenantId: 'tenant-a', tenantPilotHome: tenantAHome, userId: 1 }, async () => {
  const filtered = filterByTenantProjectKey(events);
  assert.equal(filtered.length, 1, 'tenant A sees only its own events');
  assert.equal(filtered[0].projectKey, projA);
});
ok('filterByTenantProjectKey hides other tenants events');

// no context (single-host) → no filtering
const passthrough = filterByTenantProjectKey(events);
assert.equal(passthrough.length, 3, 'single-host sees all events unchanged');
ok('filterByTenantProjectKey is a no-op without tenant context');

const fakeGateway = {
  async cronList() {
    return { tasks: [
      { taskId: 'task-a', projectKey: projA },
      { taskId: 'task-b', projectKey: projB },
    ] };
  },
};
await saasRequestStore.run({ tenantId: 'tenant-a', tenantPilotHome: tenantAHome, userId: 1 }, async () => {
  const own = await resolveCronTaskForTenant(fakeGateway, 'task-a');
  assert.equal(own.allowed, true, 'A may operate its own task');
  const other = await resolveCronTaskForTenant(fakeGateway, 'task-b');
  assert.equal(other.allowed, false, 'A may NOT operate B task');
  assert.equal(other.reason, 'forbidden');
  const missing = await resolveCronTaskForTenant(fakeGateway, 'task-x');
  assert.equal(missing.allowed, false);
  assert.equal(missing.reason, 'not_found');
});
ok('resolveCronTaskForTenant enforces cron ownership');

// ── ② memory tenant root ─────────────────────────────────────────────────
const {
  resolveTenantMemoryRoot,
  resolveTenantHomeForProjectRoot,
  resolveMemoryRootForScope,
  isSaasMode,
} = await import('../src/saas/tenantPaths.ts');

assert.equal(isSaasMode(), true);
assert.deepEqual(resolveTenantHomeForProjectRoot(projA), { tenantId: 'tenant-a', tenantHome: tenantAHome });
assert.equal(resolveTenantHomeForProjectRoot(legacyProj), undefined);
ok('resolveTenantHomeForProjectRoot maps project → tenant home');

assert.equal(resolveTenantMemoryRoot(projA, '/cfg/root'), path.join(tenantAHome, 'memory'));
assert.equal(resolveTenantMemoryRoot(projB, '/cfg/root'), path.join(tenantBHome, 'memory'));
assert.notEqual(resolveTenantMemoryRoot(projA, '/cfg/root'), resolveTenantMemoryRoot(projB, '/cfg/root'));
assert.equal(resolveTenantMemoryRoot(legacyProj, '/cfg/root'), '/cfg/root', 'legacy keeps configured root');
ok('resolveTenantMemoryRoot isolates global scope per tenant');

// default (admin) tenant is the legacy/global tree → NOT isolated.
const projDefault = path.join(TENANTS, 'default', 'projects', 'p');
assert.equal(resolveTenantHomeForProjectRoot(projDefault), undefined, 'default tenant not isolated');
assert.equal(resolveTenantMemoryRoot(projDefault, '/cfg/root'), '/cfg/root', 'default tenant uses legacy memory root');
ok('default (admin) tenant treated as legacy/global, not isolated');

// single-host: SaaS off → always fallback
process.env.PILOTDECK_SAAS_MODE = '';
assert.equal(resolveTenantMemoryRoot(projA, '/cfg/root'), '/cfg/root', 'single-host keeps configured root');
ok('resolveTenantMemoryRoot is a no-op in single-host mode');
process.env.PILOTDECK_SAAS_MODE = '1';

const externalPath = 'D:\\workspaces\\0608';
assert.equal(
  resolveMemoryRootForScope({
    projectRoot: externalPath,
    fallbackRoot: '/cfg/root',
    tenantPilotHome: tenantAHome,
    tenantId: 'tenant-a',
  }),
  path.join(tenantAHome, 'memory'),
  'external registered project uses tenant pilotHome memory',
);
assert.equal(
  resolveMemoryRootForScope({ projectRoot: externalPath, fallbackRoot: '/cfg/root' }),
  '/cfg/root',
  'no tenant context keeps fallback',
);
ok('resolveMemoryRootForScope aligns external paths with tenant memory');

// ── ③ router usage background attribution ────────────────────────────────
const { aggregateRouterUsage } = await import('../ui/server/saas/usage/store.js');

function bkt(t) { return { inputTokens: t, outputTokens: 0, totalTokens: t, requestCount: 1, estimatedCost: 0 }; }
const dashboard = {
  projects: [
    { fullPath: projA, sessions: [{ sessionId: 's-a-bg', routing: { total: bkt(100), byModel: {} } }] },
    { fullPath: projB, sessions: [{ sessionId: 's-b-bg', routing: { total: bkt(200), byModel: {} } }] },
    { fullPath: legacyProj, sessions: [{ sessionId: 's-legacy', routing: { total: bkt(50), byModel: {} } }] },
  ],
};
const agg = await aggregateRouterUsage(dashboard);
assert.equal(agg.backgroundAttributed, 2, 'two owner-less sessions inferred to tenants A+B');
assert.equal(agg.unattributed, 1, 'legacy session → system/historical');
const aRow = agg.byUser.find((u) => u.tenantId === 'tenant-a');
const bRow = agg.byUser.find((u) => u.tenantId === 'tenant-b');
const sysRow = agg.byUser.find((u) => u.username === '系统/历史');
assert.equal(aRow.totalTokens, 100);
assert.equal(bRow.totalTokens, 200);
assert.equal(sysRow.totalTokens, 50);
ok('aggregateRouterUsage infers tenant for background work, isolates system/historical');

try {
  const { closeControlDatabase } = await import('../ui/server/saas/db/control.js');
  closeControlDatabase();
} catch { /* ignore */ }
try {
  fs.rmSync(dataRoot, { recursive: true, force: true });
} catch { /* temp cleanup best-effort */ }
console.log(`\n[saas-isolation-check] all ${passed} checks passed.`);
