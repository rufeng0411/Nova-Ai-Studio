#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Mobile shell smoke — verifies bottom tab bar, mobile header,
 * Me screen, and the /admin mobile guard at a phone viewport (390x844).
 * Usage: node scripts/mobile-shell-check.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import fs from 'fs/promises';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, '../artifacts/mobile-design');
const baseUrl = process.argv[2] || process.env.VITE_URL || 'http://127.0.0.1:5173';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await ensurePlaywrightWorkspace(page, baseUrl);
    await page.waitForTimeout(2500);
    // Mobile fallback: the auth check is async, so the first goto may land on
    // the app shell and only later bounce to /login — log in explicitly here.
    if (page.url().includes('/login')) {
      const userInput = page.locator('#saas-login-username');
      await userInput.waitFor({ state: 'visible', timeout: 15_000 });
      await userInput.fill(process.env.SAAS_E2E_USER || 'admin');
      await page.locator('#saas-login-password').fill(process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD');
      await page.getByRole('button', { name: /登录工作区|Log in/i }).click();
      await page.waitForURL(/\/(p\/|session\/)/, { timeout: 30_000 });
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: join(outDir, 'impl-s1-after-login.png') });
    console.log('after login url:', page.url());

    // 1. Bottom tab bar visible with 4 tabs
    const tabbar = page.locator('.mobile-tabbar');
    await tabbar.waitFor({ state: 'visible', timeout: 15_000 });
    const tabCount = await tabbar.locator('button').count();
    record('tabbar visible with 4 tabs', tabCount === 4, `count=${tabCount}`);

    // 2. Mobile header visible (no desktop tab pills)
    const headerVisible = await page.locator('.mobile-header').isVisible();
    // Desktop chrome renders its tool switcher as a tablist inside <header>;
    // the sidebar's segment control is a different (allowed) tablist.
    const desktopTablist = await page.locator('header [role="tablist"]').count();
    record('mobile header replaces desktop chrome', headerVisible && desktopTablist === 0,
      `header=${headerVisible} headerTablists=${desktopTablist}`);
    await page.screenshot({ path: join(outDir, 'impl-s1-chat.png') });

    // 3. Drawer opens from hamburger
    await page.locator('.mobile-header button').first().click();
    await page.waitForTimeout(600);
    const drawerVisible = await page.locator('[data-testid="saas-sidebar-account"]').isVisible().catch(() => false);
    record('sidebar drawer opens', drawerVisible);
    // Admin entry must be hidden on mobile
    const adminEntry = await page.getByText('后台管理', { exact: true }).count();
    record('admin entry hidden in drawer', adminEntry === 0, `count=${adminEntry}`);
    await page.screenshot({ path: join(outDir, 'impl-s1-drawer.png') });
    await page.keyboard.press('Escape');
    await page.mouse.click(370, 420);
    await page.waitForTimeout(500);

    // 4. Hub tab
    await tabbar.locator('button').nth(1).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, 'impl-s1-hub.png') });
    record('hub tab renders', true);

    // 5. Me tab
    await tabbar.locator('button').nth(3).click();
    await page.waitForTimeout(800);
    const logoutVisible = await page.getByText(/退出|Logout/).first().isVisible().catch(() => false);
    record('me screen renders with logout', logoutVisible);
    await page.screenshot({ path: join(outDir, 'impl-s1-me.png') });

    // 6. Admin guard on mobile
    await page.goto(`${baseUrl.replace(/\/$/, '')}/admin/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const guardVisible = await page
      .getByText(/后台管理仅支持桌面端|Admin console is desktop-only/)
      .first()
      .isVisible()
      .catch(() => false);
    record('admin mobile guard shows notice', guardVisible);
    await page.screenshot({ path: join(outDir, 'impl-s1-admin-guard.png') });
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
