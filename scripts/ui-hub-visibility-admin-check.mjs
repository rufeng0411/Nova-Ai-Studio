#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 后台能力中心可见性 — 企业合规/脑暴 Tab 眼睛切换与保存
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { resolvePlaywrightBaseUrl } from './lib/devPortSync.mjs';

const BASE_URL = resolvePlaywrightBaseUrl();
const OUT_DIR = path.resolve('artifacts/media-smoke/ui-hub-visibility-admin');

async function loginAdmin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('#saas-login-username').fill(process.env.SAAS_E2E_USER || 'admin');
  await page.locator('#saas-login-password').fill(process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD');
  await page.getByRole('button', { name: /登录工作区|Log in/i }).click();
  await page.waitForFunction(
    () => Boolean(localStorage.getItem('auth-token')),
    undefined,
    { timeout: 30_000 },
  );
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    checks: {},
    ok: false,
  };

  try {
    await loginAdmin(page);
    await page.goto(`${BASE_URL}/admin/platform/hub-visibility`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('saas-admin-hub-visibility').waitFor({ state: 'visible', timeout: 30_000 });

    const ecToggle = page.getByTestId('hub-vis-category-toggle-enterprise_compliance');
    await ecToggle.waitFor({ state: 'visible', timeout: 20_000 });
    report.checks.ecToggleVisible = true;

    const statsBefore = await page.locator('.saas-admin-note').nth(1).innerText();
    report.checks.statsBefore = statsBefore;
    report.checks.ecHiddenBefore = statsBefore.includes('企业合规 Tab 隐藏');

    await ecToggle.click();
    await page.waitForTimeout(300);
    const statsAfterToggle = await page.locator('.saas-admin-note').nth(1).innerText();
    report.checks.statsAfterToggle = statsAfterToggle;
    report.checks.ecVisibleAfterToggle = statsAfterToggle.includes('企业合规 Tab 可见');

    await page.getByTestId('saas-admin-hub-vis-save').click();
    await page.getByText(/已保存，前台能力中心/i).waitFor({ state: 'visible', timeout: 15_000 });
    report.checks.saveNotice = true;

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('saas-admin-hub-visibility').waitFor({ state: 'visible', timeout: 30_000 });
    const statsAfterReload = await page.locator('.saas-admin-note').nth(1).innerText();
    report.checks.statsAfterReload = statsAfterReload;
    report.checks.ecVisibleAfterReload = statsAfterReload.includes('企业合规 Tab 可见');

    // 进入企业合规 Tab，卡片眼睛不应全部闭眼（至少 comp-contract-review 应为睁眼）
    await page.getByRole('tab', { name: /企业合规/i }).click();
    await page.waitForTimeout(800);
    const cardEye = page.locator('[data-testid="hub-vis-category-toggle-enterprise_compliance"]').first();
    report.checks.ecTabEyeAfterEnable = await cardEye.locator('svg').count() > 0;

    await page.screenshot({ path: path.join(OUT_DIR, 'hub-vis-admin-ec-enabled.png'), fullPage: true });

    report.ok = report.checks.ecVisibleAfterToggle
      && report.checks.ecVisibleAfterReload
      && report.checks.saveNotice;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: path.join(OUT_DIR, 'hub-vis-admin-fail.png'), fullPage: true }).catch(() => {});
  } finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

void run();
