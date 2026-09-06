#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright — SaaS sidebar sessions via conversation catalog.
 * Requires dev stack: npm --workspace ui run dev:concurrent
 */
import { chromium } from 'playwright';

const BASE = process.env.VITE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('input[name="username"], input[autocomplete="username"]', 'admin');
  await page.fill('input[name="password"], input[type="password"]', 'SAAS_ADMIN_PASSWORD');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/p\//, { timeout: 60_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2000);

    const sessionItems = page.locator('[data-testid="sidebar-session-item"], [data-session-id], .sidebar-session');
    const count = await sessionItems.count();
    console.log(`[ui-conversation-catalog] sidebar session items visible: ${count}`);

    if (count === 0) {
      console.warn('[ui-conversation-catalog] WARN: no sessions in sidebar (empty tenant OK for CI)');
    } else {
      await sessionItems.first().click();
      await page.waitForTimeout(1500);
      const messages = page.locator('[data-testid="chat-message"], .message-bubble, [class*="Message"]');
      const msgCount = await messages.count();
      console.log(`[ui-conversation-catalog] messages after open: ${msgCount}`);
    }

    console.log('[ui-conversation-catalog] OK');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[ui-conversation-catalog] FAIL:', error.message);
  process.exit(1);
});
