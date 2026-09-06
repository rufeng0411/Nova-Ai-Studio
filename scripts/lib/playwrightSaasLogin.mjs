#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright 在 SaaS dev 登录墙后进入工作区。
 */
import { resolvePlaywrightBaseUrl } from './devPortSync.mjs';

const DEFAULT_BASE = resolvePlaywrightBaseUrl();
const DEFAULT_USER = process.env.SAAS_E2E_USER || 'admin';
const DEFAULT_PASSWORD = process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';

export async function ensurePlaywrightWorkspace(page, baseUrl = DEFAULT_BASE) {
  const target = `${baseUrl.replace(/\/$/, '')}/p/general`;
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const hasToken = await page.evaluate(() => Boolean(localStorage.getItem('auth-token')));
  if (!page.url().includes('/login') && hasToken) {
    if (!page.url().includes('/p/')) {
      await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
    }
    return;
  }
  const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;
  if (!page.url().includes('/login')) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }
  await page.locator('#saas-login-username').fill(DEFAULT_USER);
  await page.locator('#saas-login-password').fill(DEFAULT_PASSWORD);
  await page.getByRole('button', { name: /登录工作区|Log in/i }).click();
  // PD-SAAS-FORK: login may briefly land on `/`; token persistence is the stable success signal.
  await page.waitForFunction(
    () => Boolean(localStorage.getItem('auth-token')),
    undefined,
    { timeout: 30_000 },
  );
  if (!page.url().includes('/p/')) {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 });
  }
}
