import { chromium } from 'playwright';

const BASE = 'https://www.novapage.online';
const USER = process.env.DIAG_USER || '84434775@qq.com';
const PASS = process.env.DIAG_PASS || 'Cs@19820208';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const msgUrls = [];
page.on('request', (req) => {
  if (req.url().includes('/messages')) msgUrls.push(req.url());
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.locator('#saas-login-username').fill(USER);
await page.locator('#saas-login-password').fill(PASS);
await page.getByRole('button', { name: /登录工作区/i }).click();
await page.waitForFunction(() => !!localStorage.getItem('auth-token'), null, { timeout: 60_000 });

const t0 = Date.now();
await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 120_000 });
console.log('composer ms', Date.now() - t0);

const sessions = page.locator('[data-testid="sidebar-session-item"], [class*="SessionRow"], aside a[href*="/s/"]');
const count = await sessions.count();
console.log('session rows', count);

if (count > 0) {
  msgUrls.length = 0;
  const t1 = Date.now();
  const resp = page.waitForResponse((r) => r.url().includes('/messages') && r.status() === 200, { timeout: 120_000 });
  await sessions.first().click();
  const r = await resp;
  console.log('first session messages ms', Date.now() - t1);
  console.log('request url', msgUrls[msgUrls.length - 1] || r.url());
  const body = await r.json();
  console.log('returned', body.messages?.length, 'total', body.total);
}

await browser.close();
