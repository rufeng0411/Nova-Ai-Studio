/**
 * PD-SAAS-FORK: Admin users page smoke — balance column + user logs modal.
 */
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8082';

async function loginAdmin(page) {
  await ensurePlaywrightWorkspace(page, BASE_URL);
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (page.url().includes('/login')) {
    await page.locator('#saas-login-username').fill(process.env.SAAS_E2E_USER || 'admin');
    await page.locator('#saas-login-password').fill(process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD');
    await page.getByRole('button', { name: /登录工作区|Log in/i }).click();
    await page.waitForFunction(() => Boolean(localStorage.getItem('auth-token')), undefined, { timeout: 30_000 });
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle', timeout: 60_000 });
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await loginAdmin(page);
    await page.waitForSelector('[data-testid="saas-admin-users"]', { timeout: 30_000 });

    const firstBalance = await page.locator('.saas-admin-table tbody tr').first().locator('td').nth(3).innerText();
    console.log('first row balance cell:', firstBalance);

    const logBtn = page.locator('[data-testid^="saas-user-log-"]').first();
    await logBtn.click();
    await page.waitForSelector('[data-testid="saas-user-log-modal"]', { timeout: 15_000 });
    const modalText = await page.locator('[data-testid="saas-user-log-modal"]').innerText();
    const failed = modalText.includes('加载失败') || modalText.includes('Internal server error');
    console.log('log modal failed:', failed);
    console.log('log modal snippet:', modalText.slice(0, 200));
    if (failed || firstBalance === '0') {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
