#!/usr/bin/env node
/**
 * Phase 2 SaaS smoke: billing tables, captcha, wallet, subscribe, quota gate.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`[saas-phase2-smoke] FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-p2-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;

  const { bootstrapSaasControlPlane } = await import('../ui/server/saas/auth/bootstrap.js');
  const { billingDb } = await import('../ui/server/saas/billing/store.js');
  const { createCaptchaChallenge, verifyCaptcha, resetCaptchaStoreForTests } = await import(
    '../ui/server/saas/billing/captcha.js',
  );
  const { consumeCredit, softQuotaGate } = await import('../ui/server/saas/billing/quotaGate.js');
  const { controlUserDb, closeControlDatabase } = await import('../ui/server/saas/db/control.js');

  await bootstrapSaasControlPlane({ log: () => {} });

  const plans = await billingDb.listPlans();
  if (plans.length < 3) fail('expected seeded plans');

  resetCaptchaStoreForTests();
  const captcha = await createCaptchaChallenge();
  if (!verifyCaptcha(captcha.captchaId, captcha.challenge)) fail('captcha verify failed');

  const admin = await controlUserDb.getUserByUsername('admin');
  if (!admin) fail('admin missing');

  await billingDb.ensureWallet(admin.id, 0);
  await billingDb.subscribeUser(admin.id, 'pro');
  const wallet = await billingDb.getWallet(admin.id);
  if ((wallet?.balance ?? 0) <= 0) fail('subscribe should credit wallet');

  const consumed = await consumeCredit(admin.id, 1, 'smoke');
  if (!consumed.ok) fail('consume should succeed with balance');

  await billingDb.addCredit(admin.id, -wallet.balance, { reason: 'drain' });
  const blockedReq = { user: { id: admin.id } };
  let blockedStatus = null;
  await softQuotaGate(
    blockedReq,
    {
      status(code) {
        blockedStatus = code;
        return this;
      },
      json() {},
    },
    () => {
      fail('quota gate should block empty wallet');
    },
  );
  if (blockedStatus !== 402) fail(`expected 402 soft block, got ${blockedStatus}`);

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.log('[saas-phase2-smoke] OK');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
