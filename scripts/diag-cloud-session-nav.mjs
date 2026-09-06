import { chromium } from 'playwright';

const BASE = 'https://www.novapage.online';
const USER = process.env.DIAG_USER || '84434775@qq.com';
const PASS = process.env.DIAG_PASS || 'Cs@19820208';

const SESSIONS = [
  { label: 'fast-458', id: 'web:s_342db6bd-a999-48b0-9773-c28145c0afaa' },
  { label: 'slow-ppt', id: 'web:s_e6a73b18-02c6-4887-8977-de0abe621682' },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.locator('#saas-login-username').fill(USER);
await page.locator('#saas-login-password').fill(PASS);
await page.getByRole('button', { name: /登录工作区/i }).click();
await page.waitForFunction(() => !!localStorage.getItem('auth-token'), null, { timeout: 60_000 });

for (const s of SESSIONS) {
  const enc = encodeURIComponent(s.id);
  const url = `${BASE}/p/general/c/${enc}`;
  const t0 = Date.now();
  const resp = page.waitForResponse(
    (r) => r.url().includes('/messages') && r.status() === 200,
    { timeout: 120_000 },
  );
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  try {
    const r = await resp;
    const body = await r.json();
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 });
    console.log(`${s.label}: API ${Date.now() - t0}ms total=${body.total} ret=${body.messages?.length}`);
    console.log(`  ${r.url()}`);
  } catch (e) {
    console.log(`${s.label}: FAIL ${Date.now() - t0}ms ${e.message}`);
  }
}

await browser.close();
