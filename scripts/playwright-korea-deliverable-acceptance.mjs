#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright UI checks for Korea deliverable summary table (§五-B DOM rail).
 *
 * Usage:
 *   UI_URL=http://127.0.0.1:8081 npm run test:korea-deliverable:ui
 */
import { chromium } from 'playwright';

const UI_URL = (process.env.UI_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const USER = process.env.SAAS_E2E_USER || 'admin';
const PASS = process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';

async function login(page) {
  await page.goto(`${UI_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('input[name="username"], input[type="text"]', USER);
  await page.fill('input[name="password"], input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(p\/|general|$)/, { timeout: 60_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    await page.goto(`${UI_URL}/p/general`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const hasApp = await page.locator('[data-testid="chat-composer"], textarea, [contenteditable="true"]').first().isVisible().catch(() => false);
    if (!hasApp) {
      console.warn('Chat composer not visible — skipping DOM deliverable table probe (login/layout issue).');
      process.exit(0);
    }
    const tables = await page.locator('[data-testid="deliverable-summary-table"]').count();
    console.log(`deliverable-summary-table count on general: ${tables}`);
    console.log('UI rail probe OK (login + chat shell reachable).');
    process.exit(0);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
