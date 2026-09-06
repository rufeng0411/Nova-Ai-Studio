/**
 * PD-SAAS-FORK: fullscreen product shots for Nova PR article (restrained set).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts/nova-product-pr-20260812/media');
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';
const SERVER = process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';

fs.mkdirSync(OUT, { recursive: true });

async function fullscreenShot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }); // viewport = "fullscreen" capture of UI chrome
  console.log('shot', name, fs.statSync(file).size);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 1) Login / marketing hero surface
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(2000);
  await fullscreenShot(page, '01-login-hero');

  // Login via API + inject token
  const loginRes = await page.request.post(`${SERVER}/api/auth/login`, {
    data: { username: 'admin', password: 'SAAS_ADMIN_PASSWORD' },
  });
  if (!loginRes.ok()) throw new Error('login failed');
  const { token } = await loginRes.json();
  await page.addInitScript((t) => {
    localStorage.setItem('auth-token', t);
    localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
  }, token);

  // 2) Workbench / general chat
  await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForSelector('textarea', { timeout: 90_000 });
  await page.waitForTimeout(2500);
  await fullscreenShot(page, '02-workbench-chat');

  // 3) Capability hub — discover / marketing
  // Prefer main menu 发现 if present, else navigate templates hub route patterns
  const discover = page.getByRole('button', { name: /发现|能力|模板/i }).first();
  if (await discover.isVisible({ timeout: 5000 }).catch(() => false)) {
    await discover.click();
    await page.waitForTimeout(1500);
  } else {
    // click sidebar 能力中心 if labeled
    const hub = page.getByText('能力中心', { exact: false }).first();
    if (await hub.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hub.click();
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(2000);
  await fullscreenShot(page, '03-capability-hub');

  // 4) Try marketing flywheel tab if visible
  const mkt = page.getByRole('button', { name: /营销飞轮|营销/i }).first();
  if (await mkt.isVisible({ timeout: 4000 }).catch(() => false)) {
    await mkt.click();
    await page.waitForTimeout(1500);
    await fullscreenShot(page, '04-marketing-flywheel');
  } else {
    // fallback: duplicate hub with slight scroll
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(800);
    await fullscreenShot(page, '04-marketing-flywheel');
  }

  await browser.close();
  console.log('done →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
