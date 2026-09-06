#!/usr/bin/env node
/**
 * PD-SAAS-FORK: smoke test for SaaS file storage API.
 */
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const uiBase = process.env.VITE_URL || 'http://127.0.0.1:5173';

async function main() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await ensurePlaywrightWorkspace(page, uiBase);

  const token = await page.evaluate(() => localStorage.getItem('auth-token'));
  if (!token) throw new Error('missing auth token');

  const status = await page.evaluate(async (authToken) => {
    const res = await fetch('/api/saas/storage/status', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`storage/status ${res.status}`);
    return res.json();
  }, token);
  if (status.mode !== 'saas') throw new Error('expected saas mode status');

  const prefsBody = await page.evaluate(async (authToken) => {
    const res = await fetch('/api/saas/me/preferences', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) throw new Error(`preferences ${res.status}`);
    return res.json();
  }, token);
  const fileStorage = prefsBody?.preferences?.fileStorage;
  if (!fileStorage || fileStorage.defaultLocation !== 'local') {
    throw new Error('fileStorage defaults missing');
  }

  console.log(JSON.stringify({ ok: true, status }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
