import { chromium } from 'playwright';

const BASE = 'https://www.novapage.online';
const USER = '84434775@qq.com';
const PASS = 'Cs@19820208';
const SID = 'web:s_342db6bd-a999-48b0-9773-c28145c0afaa';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const apis = [];
page.on('response', async (r) => {
  if (r.url().includes('/api/')) {
    apis.push({ url: r.url(), status: r.status(), ms: Date.now() });
  }
});

await page.goto(`${BASE}/login`);
await page.locator('#saas-login-username').fill(USER);
await page.locator('#saas-login-password').fill(PASS);
await page.getByRole('button', { name: /登录工作区/i }).click();
await page.waitForFunction(() => !!localStorage.getItem('auth-token'), null, { timeout: 60_000 });

const t0 = Date.now();
await page.goto(`${BASE}/p/general/c/${encodeURIComponent(SID)}`, { waitUntil: 'networkidle', timeout: 180_000 }).catch(() => {});
console.log('nav done', Date.now() - t0);
await page.waitForTimeout(5000);
console.log('apis', apis.filter((a) => a.url.includes('messages') || a.url.includes('projects')).map((a) => `${a.status} ${a.url.slice(0, 120)}`));
console.log('textarea visible', await page.locator('textarea').first().isVisible().catch(() => false));
await browser.close();
