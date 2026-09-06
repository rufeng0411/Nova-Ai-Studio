#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Post-migration full-chain validation matrix.
 * Covers: SQLite SaaS / PostgreSQL SaaS / OSS mode / admin / member / migration parity.
 *
 * Usage:
 *   node scripts/test-saas-pg-migration-validation.mjs
 *   node scripts/test-saas-pg-migration-validation.mjs --report docs/saas-pg-migration-validation-report.md
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateControlSqliteToPg } from './migrate-control-sqlite-to-pg.mjs';
import {
  DEFAULT_PG_TEST_URL,
  ensurePgTestDatabase,
  isPgReachable,
  preparePgTestDatabase,
  resetPgControlTables,
} from './lib/saasPgTestEnv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

/** @typedef {{ id: string, group: string, name: string, ok: boolean, detail: string, backend?: string }} ResultRow */

/** @type {ResultRow[]} */
const results = [];
let pgReachable = false;

function record(id, group, name, ok, detail, backend = '') {
  results.push({ id, group, name, ok, detail, backend });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[pg-validation] ${tag} [${backend || '—'}] ${id} ${name}: ${detail}`);
  if (!ok) {
    throw new Error(`${id} ${name}: ${detail}`);
  }
}

function mockRes() {
  let statusCode = 200;
  /** @type {any} */
  let body = null;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

async function withSaasBackend(backendLabel, envOverrides, run) {
  const prev = { ...process.env };
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), `saas-val-${backendLabel}-`));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  if (backendLabel === 'postgres') {
    process.env.SAAS_DATABASE_URL = envOverrides.SAAS_DATABASE_URL || DEFAULT_PG_TEST_URL;
  } else {
    delete process.env.SAAS_DATABASE_URL;
  }
  Object.assign(process.env, envOverrides);

  try {
    await run({ dataRoot, backendLabel });
  } finally {
    try {
      const { closeControlDatabase } = await import('../ui/server/saas/db/control.js');
      await closeControlDatabase();
    } catch {
      /* ignore */
    }
    process.env = prev;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function runSaasScenarioSuite(backendLabel, pgUrl) {
  await withSaasBackend(backendLabel, backendLabel === 'postgres' ? { SAAS_DATABASE_URL: pgUrl } : {}, async (ctx) => {
    const { bootstrapSaasControlPlane, SAAS_ADMIN_USERNAME } = await import('../ui/server/saas/auth/bootstrap.js');
    const { saasAuthStatus, saasRegister, saasLogin, saasChangePassword } = await import(
      '../ui/server/saas/auth/routes.js',
    );
    const { generateToken } = await import('../ui/server/middleware/auth.js');
    const { createCaptchaChallenge, resetCaptchaStoreForTests } = await import(
      '../ui/server/saas/billing/captcha.js',
    );
    const { billingDb } = await import('../ui/server/saas/billing/store.js');
    const { checkChatQuota, consumeCredit, softQuotaGate } = await import(
      '../ui/server/saas/billing/quotaGate.js',
    );
    const { requireSaasConfigWrite } = await import('../ui/server/saas/middleware/requireSaasConfigWrite.js');
    const { controlUserDb, getControlDbBackend, pingControlDatabase } = await import(
      '../ui/server/saas/db/control.js',
    );
    const { saasRequestStore } = await import('../ui/server/saas/context.js');
    const { listTenantDiskProjects } = await import('../ui/server/saas/tenant/projectList.js');
    const { getTenantProjectsRoot, tenantIdForUsername } = await import('../ui/server/saas/tenant/paths.js');
    const { recordAnalyticsEvent, aggregateDashboardStats, listAdminUsers } = await import(
      '../ui/server/saas/analytics/store.js',
    );
    const { recordSessionOwner, aggregateRouterUsage } = await import('../ui/server/saas/usage/store.js');
    const { getUserPreferences, updateUserPreferences } = await import('../ui/server/saas/userPreferences.js');
    const { getLegacyPilotHome } = await import('../ui/server/saas/legacyBridge.js');

    await bootstrapSaasControlPlane({ log: () => {} });

    // --- 基础设施 ---
    assert.equal(getControlDbBackend(), backendLabel);
    record('INF-01', 'infra', '控制库后端匹配', true, backendLabel, backendLabel);
    assert.ok(await pingControlDatabase());
    record('INF-02', 'infra', 'DB ping 成功', true, 'ping ok', backendLabel);

    // --- 管理员 ---
    const admin = await controlUserDb.getUserByUsername(SAAS_ADMIN_USERNAME);
    assert.ok(admin?.role === 'super-admin');
    record('ADM-01', 'admin', '平台管理员 seed', true, `role=${admin.role}`, backendLabel);

    const statusRes = mockRes();
    await saasAuthStatus({}, statusRes);
    assert.equal(statusRes.body.saasMode, true);
    assert.equal(statusRes.body.authDisabled, false);
    record('ADM-02', 'admin', 'auth/status SaaS 语义', true, 'saasMode=true', backendLabel);

    const loginRes = mockRes();
    await saasLogin({ body: { username: 'admin', password: 'SAAS_ADMIN_PASSWORD' } }, loginRes, { generateToken });
    assert.equal(loginRes.statusCode, 200);
    assert.ok(loginRes.body.token);
    record('ADM-03', 'admin', '管理员登录', true, 'JWT issued', backendLabel);

    const plans = await billingDb.listPlans();
    assert.ok(plans.length >= 3);
    record('ADM-04', 'admin', '计划列表', true, `count=${plans.length}`, backendLabel);

    await billingDb.subscribeUser(admin.id, 'pro');
    const adminWallet = await billingDb.getWallet(admin.id);
    assert.ok((adminWallet?.balance ?? 0) > 0);
    record('ADM-05', 'admin', '管理员订阅 pro', true, `balance=${adminWallet.balance}`, backendLabel);

    await recordAnalyticsEvent('visit', { userId: admin.id, tenantId: admin.tenant_id });
    const stats = await aggregateDashboardStats({});
    assert.ok(stats.users.total >= 1);
    assert.ok(stats.visits.series.length >= 14);
    record('ADM-06', 'admin', '运营大盘聚合', true, `users=${stats.users.total}`, backendLabel);

    const users = await listAdminUsers('');
    assert.ok(users.some((u) => u.username === 'admin'));
    record('ADM-07', 'admin', '用户列表含 admin', true, `rows=${users.length}`, backendLabel);

    // --- 普通用户 ---
    resetCaptchaStoreForTests();
    for (const name of ['alice', 'bob']) {
      const existing = await controlUserDb.getUserByUsername(name);
      if (existing) {
        record(`MEM-01-${name}`, 'member', `${name} 已存在复用`, true, `tenant=${existing.tenant_id}`, backendLabel);
        continue;
      }
      const cap = await createCaptchaChallenge();
      const regRes = mockRes();
      await saasRegister(
        {
          body: {
            username: name,
            password: 'secret12',
            captchaId: cap.captchaId,
            captchaAnswer: cap.challenge,
          },
        },
        regRes,
        { generateToken },
      );
      assert.equal(regRes.statusCode, 200, `${name} register`);
      assert.ok(regRes.body.token);
      record(`MEM-01-${name}`, 'member', `${name} 注册+试用`, true, `tenant=${regRes.body.user.tenantId}`, backendLabel);
    }

    const dupRes = mockRes();
    const cap2 = await createCaptchaChallenge();
    await saasRegister(
      {
        body: {
          username: 'alice',
          password: 'secret12',
          captchaId: cap2.captchaId,
          captchaAnswer: cap2.challenge,
        },
      },
      dupRes,
      { generateToken },
    );
    assert.equal(dupRes.statusCode, 409);
    record('MEM-02', 'member', '重复注册拒绝', true, '409', backendLabel);

    const alice = await controlUserDb.getUserByUsername('alice');
    const bob = await controlUserDb.getUserByUsername('bob');
    assert.notEqual(alice.tenant_id, bob.tenant_id);
    record('MEM-03', 'member', '租户隔离（表级）', true, `${alice.tenant_id} != ${bob.tenant_id}`, backendLabel);

    const aliceProjects = path.join(getTenantProjectsRoot(alice.tenant_id), 'proj-a');
    fs.mkdirSync(path.join(aliceProjects, 'chats'), { recursive: true });
    fs.writeFileSync(path.join(aliceProjects, '.cwd'), 'C:\\work\\alice-only', 'utf8');
    const aliceList = await saasRequestStore.run(
      { tenantId: alice.tenant_id, tenantPilotHome: path.join(ctx.dataRoot, 'tenants', alice.tenant_id) },
      () => listTenantDiskProjects(path.join(ctx.dataRoot, 'tenants', alice.tenant_id)),
    );
    const bobList = await saasRequestStore.run(
      { tenantId: bob.tenant_id, tenantPilotHome: path.join(ctx.dataRoot, 'tenants', bob.tenant_id) },
      () => listTenantDiskProjects(path.join(ctx.dataRoot, 'tenants', bob.tenant_id)),
    );
    assert.equal(aliceList.length, 1);
    assert.equal(bobList.length, 0);
    record('MEM-04', 'member', '项目目录隔离', true, 'alice=1 bob=0', backendLabel);

    let memberConfigStatus = null;
    requireSaasConfigWrite(
      { user: alice },
      { status(code) { memberConfigStatus = code; return this; }, json() {} },
      () => assert.fail('member config write'),
    );
    assert.equal(memberConfigStatus, 403);
    record('MEM-05', 'member', '成员禁止写全局配置', true, '403', backendLabel);

    await billingDb.addCredit(alice.id, -(await billingDb.getWallet(alice.id)).balance, { reason: 'drain' });
    const quota = await checkChatQuota(alice.id);
    assert.equal(quota.ok, false);
    let gateStatus = null;
    await softQuotaGate(
      { user: alice },
      { status(code) { gateStatus = code; return this; }, json() {} },
      () => assert.fail('quota gate'),
    );
    assert.equal(gateStatus, 402);
    record('MEM-06', 'member', '积分耗尽 402', true, 'quota_exhausted', backendLabel);

    await billingDb.addCredit(alice.id, 50, { reason: 'admin_topup', createdBy: admin.id });
    assert.ok((await consumeCredit(alice.id, 1, 'val')).ok);
    record('MEM-07', 'member', '管理员充值后可消费', true, 'consume ok', backendLabel);

    const prefs = await updateUserPreferences(alice.id, { projectContinuity: false });
    assert.equal(prefs.projectContinuity, false);
    assert.equal((await getUserPreferences(alice.id)).projectContinuity, false);
    record('MEM-08', 'member', '用户偏好读写', true, 'projectContinuity=false', backendLabel);

    await recordSessionOwner({
      sessionId: 'web-s_alice1',
      userId: alice.id,
      tenantId: alice.tenant_id,
      projectPath: 'D:\\shared\\proj',
    });
    const usage = await aggregateRouterUsage(
      {
        projects: [
          {
            fullPath: 'D:\\shared\\proj',
            sessions: [
              {
                sessionId: 'web-s_alice1',
                routing: {
                  total: { inputTokens: 100, outputTokens: 20, totalTokens: 120, requestCount: 1, estimatedCost: 0 },
                  byModel: {},
                },
              },
            ],
          },
        ],
      },
      { filterUserId: alice.id },
    );
    assert.equal(usage.total.totalTokens, 120);
    record('MEM-09', 'member', '路由用量归属', true, `tokens=${usage.total.totalTokens}`, backendLabel);

    // --- JWT 用户查找（迁移后 id 不变性 proxy）---
    const token = generateToken(alice);
    const { JWT_SECRET } = await import('../ui/server/middleware/auth.js');
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, JWT_SECRET);
    const lookedUp = await controlUserDb.getUserById(decoded.userId);
    assert.equal(lookedUp.id, alice.id);
    record('AUTH-01', 'auth', 'JWT userId 可解析', true, `id=${lookedUp.id}`, backendLabel);

    // --- Legacy Bridge ---
    const skillsDir = path.join(getLegacyPilotHome(), 'skills');
    assert.ok(fs.existsSync(skillsDir));
    record('BRG-01', 'bridge', 'Legacy skills 目录存在', true, skillsDir, backendLabel);

    // stash admin id for migration test
    ctx.adminId = admin.id;
    ctx.adminTenant = admin.tenant_id;
  });
}

async function runOssSuite() {
  const prev = { ...process.env };
  delete process.env.PILOTDECK_SAAS_MODE;
  delete process.env.SAAS_DATABASE_URL;
  try {
    const { isSaasMode } = await import('../ui/server/saas/mode.js');
    assert.equal(isSaasMode(), false);
    record('OSS-01', 'oss', '单机模式 isSaasMode=false', true, 'no SAAS_MODE', 'oss');

    const catalogRaw = fs.readFileSync(path.join(REPO_ROOT, 'config', 'capabilities.catalog.json'), 'utf8');
    const capCount = (catalogRaw.match(/"slug"\s*:/g) || []).length;
    assert.ok(capCount >= 80);
    record('OSS-02', 'oss', '能力目录规模', true, `slugs=${capCount}`, 'oss');
  } finally {
    process.env = prev;
  }
}

async function runMigrationSuite(pgUrl) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-migrate-val-'));
  const prev = { ...process.env };
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;

  let adminId;
  try {
    const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');
    const { billingDb } = await import('../ui/server/saas/billing/store.js');
    const { controlUserDb, closeControlDatabase, getControlDbPath } = await import('../ui/server/saas/db/control.js');
    const { recordAnalyticsEvent } = await import('../ui/server/saas/analytics/store.js');

    await bootstrapSaasControlPlane({ log: () => {} });
    const admin = await controlUserDb.getUserByUsername('admin');
    await billingDb.subscribeUser(admin.id, 'trial');
    await recordAnalyticsEvent('login', { userId: admin.id, tenantId: admin.tenant_id });
    adminId = admin.id;
    const sqlitePath = getControlDbPath();
    await closeControlDatabase();

    await preparePgTestDatabase(pgUrl);
    const result = await migrateControlSqliteToPg({ source: sqlitePath, target: pgUrl });
    assert.equal(result.ok, true);
    record('MIG-01', 'migration', 'SQLite→PG 迁移', true, JSON.stringify(result.imported), 'postgres');

    process.env.SAAS_DATABASE_URL = pgUrl;
    const { openControlDatabase, closeControlDatabase: closePg } = await import('../ui/server/saas/db/control.js');
    await openControlDatabase();
    const pgAdmin = await controlUserDb.getUserByUsername('admin');
    assert.equal(pgAdmin.id, adminId);
    const wallet = await billingDb.getWallet(pgAdmin.id);
    assert.ok((wallet?.balance ?? 0) >= 100);
    record('MIG-02', 'migration', '迁移后 admin id/积分一致', true, `id=${pgAdmin.id} balance=${wallet.balance}`, 'postgres');
    await closePg();

    const verify = await migrateControlSqliteToPg({
      source: sqlitePath,
      target: pgUrl,
      verifyOnly: true,
    });
    assert.equal(verify.ok, true);
    record('MIG-03', 'migration', 'verify-only 二次校验', true, verify.mode, 'postgres');
    await closePg();
  } finally {
    process.env = prev;
    fs.rmSync(dataRoot, { recursive: true, force: true });
    await preparePgTestDatabase(pgUrl);
  }
}

function writeReport(reportPath) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const byBackend = {};
  for (const r of results) {
    const key = r.backend || '—';
    if (!byBackend[key]) byBackend[key] = { pass: 0, fail: 0 };
    if (r.ok) byBackend[key].pass += 1;
    else byBackend[key].fail += 1;
  }

  const lines = [
    '# SaaS PostgreSQL 迁移后全链路验证报告',
    '',
    `**生成时间:** ${new Date().toISOString()}`,
    `**PostgreSQL 可达:** ${pgReachable ? '是' : '否（PG 场景已跳过）'}`,
    `**汇总:** ${passed} 通过 / ${failed} 失败 / 共 ${results.length} 项`,
    '',
    '## 按后端统计',
    '',
    '| 后端 | 通过 | 失败 |',
    '|------|------|------|',
  ];
  for (const [backend, counts] of Object.entries(byBackend)) {
    lines.push(`| ${backend} | ${counts.pass} | ${counts.fail} |`);
  }
  lines.push('', '## 明细', '', '| ID | 分组 | 场景 | 后端 | 结果 | 说明 |', '|----|------|------|------|------|------|');
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.group} | ${r.name} | ${r.backend || '—'} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail} |`);
  }
  lines.push('');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`[pg-validation] report → ${reportPath}`);
}

async function main() {
  const reportArg = process.argv.indexOf('--report');
  const reportPath =
    reportArg >= 0 ? path.resolve(REPO_ROOT, process.argv[reportArg + 1]) : path.join(REPO_ROOT, 'docs', 'saas-pg-migration-validation-report.md');

  console.log('[pg-validation] === OSS 单机模式 ===');
  await runOssSuite();

  console.log('[pg-validation] === SaaS + SQLite ===');
  await runSaasScenarioSuite('sqlite');

  pgReachable = await isPgReachable(DEFAULT_PG_TEST_URL);
  if (pgReachable) {
    await preparePgTestDatabase(DEFAULT_PG_TEST_URL);
    console.log('[pg-validation] === SaaS + PostgreSQL ===');
    await runSaasScenarioSuite('postgres', DEFAULT_PG_TEST_URL);
    console.log('[pg-validation] === 迁移 parity ===');
    await runMigrationSuite(DEFAULT_PG_TEST_URL);
  } else {
    console.warn(`[pg-validation] SKIP PostgreSQL suites (${DEFAULT_PG_TEST_URL} unreachable)`);
    record('PG-SKIP', 'infra', 'PostgreSQL 跳过', true, 'server unreachable', 'postgres');
  }

  writeReport(reportPath);
  console.log(`[pg-validation] OK — ${results.length} scenarios passed`);
}

main().catch((error) => {
  try {
    writeReport(path.join(REPO_ROOT, 'docs', 'saas-pg-migration-validation-report.md'));
  } catch {
    /* ignore */
  }
  console.error('[pg-validation] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
