/**
 * PD-SAAS-FORK: Billing unit tests.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('billing: plans seed, subscribe credits wallet', async () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-billing-test-'));
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.DATA_ROOT = dataRoot;
  delete process.env.SAAS_DATABASE_URL;

  const { bootstrapSaasControlPlane } = await import('../auth/bootstrap.js');
  const { billingDb } = await import('./store.js');
  const { controlUserDb, closeControlDatabase } = await import('../db/control.js');

  await bootstrapSaasControlPlane({ log: () => {} });
  const admin = await controlUserDb.getUserByUsername('admin');
  assert.ok(admin);

  await billingDb.subscribeUser(admin.id, 'trial');
  const wallet = await billingDb.getWallet(admin.id);
  assert.ok((wallet?.balance ?? 0) >= 100);

  await closeControlDatabase();
  fs.rmSync(dataRoot, { recursive: true, force: true });
});

test('captcha: issue and verify once', async () => {
  const { createCaptchaChallenge, verifyCaptcha, resetCaptchaStoreForTests } = await import('./captcha.js');
  resetCaptchaStoreForTests();
  const { captchaId, challenge } = await createCaptchaChallenge();
  assert.equal(await verifyCaptcha(captchaId, challenge), true);
  assert.equal(await verifyCaptcha(captchaId, challenge), false);
});
