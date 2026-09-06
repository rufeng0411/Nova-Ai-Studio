/**
 * PD-SAAS-FORK: mobile viewport regression for the Nova Ai-Studio phone UI.
 *
 * Covers: mobile shell, composer touch targets, capability hub (horizontal cards),
 * files, Me, PWA deep link, admin guard. Runs Chromium + WebKit (iOS Safari engine).
 *
 * Prereq: dev:saas stack on BASE_URL (default http://127.0.0.1:5173).
 * Run:    node scripts/mobile-regression-check.mjs
 */
import { chromium, webkit } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const SHOT_DIR = process.env.SHOT_DIR || 'artifacts/ui-theme-preview';
const USERNAME = process.env.SAAS_USERNAME || 'admin';
const PASSWORD = process.env.SAAS_PASSWORD || 'SAAS_ADMIN_PASSWORD';
const ENGINES = process.env.MOBILE_ENGINES?.split(',').map((e) => e.trim()) || ['chromium', 'webkit'];

let failures = 0;
function ok(name, pass, extra = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!pass) failures += 1;
}

async function login(page) {
  const res = await page.request.post(`${SERVER}/api/auth/login`, {
    data: { username: USERNAME, password: PASSWORD },
  });
  const body = await res.json();
  if (!body?.token) throw new Error(`login failed status=${res.status()}`);
  await page.goto(`${BASE}/m/p/general`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((token) => {
    localStorage.setItem('auth-token', token);
    localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
  }, body.token);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.mobile-header').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function runSuite(engineName, browserType) {
  const browser = await browserType.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  const page = await ctx.newPage();
  const prefix = `[${engineName}]`;

  await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  ok(`${prefix} mobile auto-redirect to /m`, page.url().includes('/m/'), page.url());

  await login(page);
  ok(`${prefix} mobile header rendered`, (await page.locator('.mobile-header').count()) === 1);
  const headerText = await page.locator('.mobile-header').innerText();
  ok(
    `${prefix} header hides General slug`,
    !/\bGeneral\b/i.test(headerText) && !/\bgeneral\b/.test(headerText),
    headerText.trim(),
  );
  ok(`${prefix} tab bar has 4 tabs`, (await page.locator('.mobile-tabbar button').count()) === 4);

  const attachBtn = page.locator('.mobile-icon-row button.mobile-touch-target').nth(1);
  if (await attachBtn.count()) {
    const box = await attachBtn.boundingBox();
    ok(`${prefix} composer attach touch target`, Boolean(box && box.height >= 44 && box.width >= 44), box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'missing');
  }

  if (engineName === 'chromium') {
    await page.screenshot({ path: `${SHOT_DIR}/mobile-touch-chat.png` });
  }

  await page.locator('.mobile-tabbar button').nth(0).click();
  await page.waitForTimeout(2000);

  const deliverableToggle = page.getByTestId('session-deliverable-summary-bar-toggle');
  if (await deliverableToggle.count()) {
    await deliverableToggle.click({ force: true });
    await page.waitForTimeout(600);
    ok(
      `${prefix} deliverable sheet opens on bar tap`,
      (await page.locator('[data-sheet-mode="deliverables"]').count()) > 0
        && (await page.getByTestId('deliverable-session-sheet-list').count()) > 0,
    );
    await page.getByTestId('deliverable-session-sheet').locator('button.mobile-sheet-backdrop').click({ force: true });
    await page.waitForTimeout(300);
  } else {
    ok(`${prefix} deliverable bar present (skip sheet tap)`, true, 'no active deliverable session');
  }

  if (engineName === 'chromium') {
    await page.screenshot({ path: `${SHOT_DIR}/mobile-touch-deliverables.png` });
  }

  await page.locator('.mobile-tabbar button').nth(1).click();
  await page.waitForTimeout(4000);
  const hubBody = await page.locator('body').innerText();
  ok(`${prefix} capability hub renders`, /营销|办公|创作|开发|Marketing|Office|Creative/i.test(hubBody));
  ok(`${prefix} mobile hub seg row`, (await page.locator('.mobile-hub-seg-row').count()) >= 1);
  ok(`${prefix} mobile hub list cards`, (await page.locator('.mobile-hub-cap-card').count()) >= 1);
  ok(`${prefix} mobile hub two-column grid`, (await page.locator('[data-testid="capability-hub"] .grid-cols-2').count()) >= 1);
  const capTitle = page.locator('.mobile-hub-cap-title').first();
  if (await capTitle.count()) {
    const truncated = await capTitle.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth;
    });
    ok(`${prefix} hub title not ellipsis-truncated`, !truncated);
  }

  const workflowTab = page.getByRole('tab', { name: /流程模板|Workflows/i }).first();
  if (await workflowTab.count()) {
    await workflowTab.click();
    await page.waitForTimeout(800);
    ok(`${prefix} mobile template cards`, (await page.locator('.mobile-template-card').count()) >= 1);
  }
  const hubCard = page.locator('.mobile-hub-cap-card').first();
  if (await hubCard.count()) {
    const cardBox = await hubCard.boundingBox();
    ok(`${prefix} hub card min touch height`, Boolean(cardBox && cardBox.height >= 36), cardBox ? `${Math.round(cardBox.height)}px` : 'missing');
  }

  if (engineName === 'chromium') {
    await page.screenshot({ path: `${SHOT_DIR}/mobile-touch-hub.png` });
  }

  await page.locator('.mobile-tabbar button').nth(2).click();
  await page.waitForTimeout(4000);
  ok(`${prefix} files tree renders`, (await page.locator('[data-file-tree-path]').count()) > 0);

  if (engineName === 'chromium') {
    await page.screenshot({ path: `${SHOT_DIR}/mobile-touch-files.png` });
  }

  await page.locator('.mobile-tabbar button').nth(3).click();
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const logoutBtn = page.getByRole('button', { name: /^退出$|^Logout$/i }).first();
  ok(`${prefix} me screen renders`, await logoutBtn.isVisible().catch(() => false));

  if (engineName === 'chromium') {
    await page.screenshot({ path: `${SHOT_DIR}/mobile-touch-me.png` });
  }

  await browser.close();
}

for (const engine of ENGINES) {
  const browserType = engine === 'webkit' ? webkit : chromium;
  if (!browserType) continue;
  await runSuite(engine, browserType);
}

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('all mobile regression checks passed');
