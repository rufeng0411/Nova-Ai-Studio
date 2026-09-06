import { chromium } from 'playwright';

const BASE = 'https://www.novapage.online';
const USER = '84434775@qq.com';
const PASS = 'Cs@19820208';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/login`);
await page.locator('#saas-login-username').fill(USER);
await page.locator('#saas-login-password').fill(PASS);
await page.getByRole('button', { name: /登录工作区/i }).click();
await page.waitForFunction(() => !!localStorage.getItem('auth-token'), null, { timeout: 60_000 });

await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
await page.waitForResponse((r) => r.url().includes('/api/projects') && r.status() === 200, { timeout: 60_000 });

// Expand project if needed
const projectRow = page.getByText('general', { exact: false }).first();
if (await projectRow.isVisible().catch(() => false)) {
  await projectRow.click().catch(() => {});
}

const sessionLinks = page.locator('a[href*="/c/"], button').filter({ hasText: /继续|对话|Nova|PPT|幻灯/i });
const count = await sessionLinks.count();
console.log('session-like elements', count);

for (let i = 0; i < Math.min(count, 3); i += 1) {
  const el = sessionLinks.nth(i);
  const label = (await el.innerText().catch(() => '')).slice(0, 40);
  const t0 = Date.now();
  const msgWait = page.waitForResponse(
    (r) => r.url().includes('/messages') && r.status() === 200,
    { timeout: 120_000 },
  );
  await el.click();
  try {
    const r = await msgWait;
    const body = await r.json();
    console.log(`[${i}] "${label}" → ${Date.now() - t0}ms total=${body.total} ret=${body.messages?.length}`);
    console.log(`     ${new URL(r.url()).search}`);
  } catch (e) {
    console.log(`[${i}] "${label}" → FAIL ${Date.now() - t0}ms`);
  }
  await page.waitForTimeout(1000);
}

await browser.close();
