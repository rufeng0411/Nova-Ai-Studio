#!/usr/bin/env node
/**
 * SaaS 深度集成冒烟 — 覆盖 UAT / INV-SAAS 可自动化项（无需 live dev 服）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`[saas-deep] FAIL: ${message}`);
  process.exit(1);
}

function mockRes() {
  let statusCode = 200;
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

async function withSaasDb(run) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-deep-'));
  const prev = { ...process.env };
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  try {
    await run(dataRoot);
  } finally {
    const { closeControlDatabase } = await import('../ui/server/saas/db/control.js');
    await closeControlDatabase();
    process.env = prev;
    fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function main() {
  await withSaasDb(async (dataRoot) => {
    const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');
    const { saasRegister, saasAuthStatus } = await import('../ui/server/saas/auth/routes.js');
    const { generateToken } = await import('../ui/server/middleware/auth.js');
    const { createCaptchaChallenge, resetCaptchaStoreForTests } = await import(
      '../ui/server/saas/billing/captcha.js'
    );
    const { billingDb } = await import('../ui/server/saas/billing/store.js');
    const { checkChatQuota, consumeCredit, softQuotaGate } = await import(
      '../ui/server/saas/billing/quotaGate.js'
    );
    const { requireSaasConfigWrite } = await import(
      '../ui/server/saas/middleware/requireSaasConfigWrite.js'
    );
    const { controlUserDb } = await import('../ui/server/saas/db/control.js');
    const { saasRequestStore } = await import('../ui/server/saas/context.js');
    const { listTenantDiskProjects } = await import('../ui/server/saas/tenant/projectList.js');
    const { getTenantProjectsRoot, tenantIdForUsername } = await import(
      '../ui/server/saas/tenant/paths.js'
    );
    const { getLegacyPilotHome } = await import('../ui/server/saas/legacyBridge.js');

    await bootstrapSaasControlPlane({ log: () => {} });

    // INV-SAAS-01 / auth status
    const statusRes = mockRes();
    await saasAuthStatus({}, statusRes);
    assert.equal(statusRes.statusCode, 200);
    assert.equal(statusRes.body.saasMode, true);
    assert.equal(statusRes.body.authDisabled, false);

    resetCaptchaStoreForTests();
    const captcha = await createCaptchaChallenge();

    // Register without captcha → 400
    const badReg = mockRes();
    await saasRegister(
      { body: { username: 'alice', password: 'secret12' } },
      badReg,
      { generateToken },
    );
    assert.equal(badReg.statusCode, 400);

    // Register alice + bob → separate tenants + trial wallet
    for (const name of ['alice', 'bob']) {
      const cap = await createCaptchaChallenge();
      const res = mockRes();
      await saasRegister(
        {
          body: {
            username: name,
            password: 'secret12',
            captchaId: cap.captchaId,
            captchaAnswer: cap.challenge,
          },
        },
        res,
        { generateToken },
      );
      assert.equal(res.statusCode, 200, `${name} register`);
      assert.ok(res.body.token);
      assert.equal(res.body.user.role, 'member');
      const user = await controlUserDb.getUserByUsername(name);
      assert.equal(user.tenant_id, tenantIdForUsername(name));
      const wallet = await billingDb.getWallet(user.id);
      assert.ok((wallet?.balance ?? 0) > 0, `${name} trial credits`);
    }

    // INV-SAAS-02: project trees isolated per tenant
    const aliceTenant = tenantIdForUsername('alice');
    const bobTenant = tenantIdForUsername('bob');
    const aliceProjects = path.join(getTenantProjectsRoot(aliceTenant), 'proj-a');
    fs.mkdirSync(path.join(aliceProjects, 'chats'), { recursive: true });
    fs.writeFileSync(path.join(aliceProjects, '.cwd'), 'C:\\work\\alice-only', 'utf8');

    const aliceList = await saasRequestStore.run(
      { tenantId: aliceTenant, tenantPilotHome: path.join(dataRoot, 'tenants', aliceTenant) },
      () => listTenantDiskProjects(path.join(dataRoot, 'tenants', aliceTenant)),
    );
    const bobList = await saasRequestStore.run(
      { tenantId: bobTenant, tenantPilotHome: path.join(dataRoot, 'tenants', bobTenant) },
      () => listTenantDiskProjects(path.join(dataRoot, 'tenants', bobTenant)),
    );
    assert.equal(aliceList.length, 1);
    assert.equal(bobList.length, 0);

    // Member config write blocked
    const member = await controlUserDb.getUserByUsername('alice');
    let memberConfigStatus = null;
    requireSaasConfigWrite(
      { user: member },
      {
        status(code) {
          memberConfigStatus = code;
          return this;
        },
        json() {},
      },
      () => assert.fail('member should not pass config write'),
    );
    assert.equal(memberConfigStatus, 403);

    // Quota 402 + chat quota
    await billingDb.addCredit(member.id, -(await billingDb.getWallet(member.id)).balance, { reason: 'drain' });
    const chatQuota = await checkChatQuota(member.id);
    assert.equal(chatQuota.ok, false);
    let consumeStatus = null;
    await softQuotaGate(
      { user: member },
      {
        status(code) {
          consumeStatus = code;
          return this;
        },
        json() {},
      },
      () => assert.fail('soft quota should block'),
    );
    assert.equal(consumeStatus, 402);

    // Admin credit restores member
    const admin = await controlUserDb.getUserByUsername('admin');
    await billingDb.addCredit(member.id, 50, { reason: 'admin_topup', createdBy: admin.id });
    assert.ok((await consumeCredit(member.id, 1, 'deep')).ok);

    // INV-SAAS-03: legacy skills home exists
    const legacyHome = getLegacyPilotHome();
    const skillsDir = path.join(legacyHome, 'skills');
    assert.ok(fs.existsSync(skillsDir), `skills dir missing: ${skillsDir}`);
    const skillCount = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    const catalogRaw = fs.readFileSync(path.join(REPO_ROOT, 'config', 'capabilities.catalog.json'), 'utf8');
    const catalogCount = (catalogRaw.match(/"slug"\s*:/g) || []).length;
    assert.ok(skillCount >= 50, `skills count low: ${skillCount}`);
    assert.ok(catalogCount >= 50, `catalog count low: ${catalogCount}`);

    console.log('[saas-deep] OK', {
      tenants: [aliceTenant, bobTenant],
      skillCount,
      catalogCount,
      legacyHome,
    });
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
