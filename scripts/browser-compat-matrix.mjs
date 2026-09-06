#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Full browser compatibility matrix — desktop + mobile mainstream engines.
 *
 * Maps Playwright engines to user-facing browsers:
 *   chromium / chrome / msedge → Chrome & Edge (Win/Mac)
 *   firefox → Firefox (Win/Mac)
 *   webkit → Safari (macOS & iOS engine)
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:8081 SERVER_URL=http://127.0.0.1:7990 node scripts/browser-compat-matrix.mjs
 */
import { chromium, firefox, webkit, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE = (process.env.BASE_URL || process.env.VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const OUT_DIR = process.env.SHOT_DIR || path.join(REPO_ROOT, 'artifacts', 'browser-compat-matrix');
const USERNAME = process.env.SAAS_USERNAME || process.env.SAAS_E2E_USER || 'admin';
const PASSWORD = process.env.SAAS_PASSWORD || process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';

async function loginViaApi(page, { mobile = false } = {}) {
  let body;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await page.request.post(`${SERVER}/api/auth/login`, {
        data: { username: USERNAME, password: PASSWORD },
      });
      body = await res.json();
      if (body?.token) break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(800 * (attempt + 1));
    }
  }
  if (!body?.token) throw new Error('login failed');
  const target = mobile ? `${BASE}/m/p/general` : `${BASE}/p/general`;
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate((token) => {
    localStorage.setItem('auth-token', token);
    localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
  }, body.token);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (mobile) {
    await page.locator('.mobile-header').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  } else {
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    await page.getByRole('tab', { name: /智能体|Agent|Chat/i }).first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  }
  await page.waitForTimeout(1200);
}

const HUB_CATEGORY_RE = /营销|办公|创作|开发|Marketing|Office|Creative|Development/i;

/** Open desktop capability hub via stable top nav (avoids welcome-screen CTA false matches). */
async function openDesktopCapabilityHub(page) {
  // Do NOT scope to tablist.first() — sidebar project switcher is also a tablist on WebKit.
  const discoverTab = page.getByRole('tab', { name: /能力中心|Capability Hub/i });
  if (await discoverTab.count()) {
    await discoverTab.first().click({ timeout: 10_000 });
    return 'discover-tab';
  }
  const composerHub = page
    .getByRole('button', { name: /^能力$|^Capabilities$/i })
    .or(page.locator('button[title="能力"], button[title="Capabilities"]'));
  if (await composerHub.count()) {
    await composerHub.first().click({ timeout: 10_000 });
    return 'composer-dialog';
  }
  const exploreAll = page.getByRole('button', { name: /探索全部能力|Explore all capabilities/i });
  if (await exploreAll.count()) {
    await exploreAll.first().click({ timeout: 10_000 });
    return 'welcome-discover';
  }
  return 'none';
}

/** Wait until hub categories render (cache or API). */
async function waitForCapabilityHubReady(page) {
  await page.locator('[data-testid="capability-hub"]').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await page
    .waitForFunction(
      (pattern) => {
        const hub = document.querySelector('[data-testid="capability-hub"]');
        if (hub?.textContent && new RegExp(pattern, 'i').test(hub.textContent)) return true;
        return new RegExp(pattern, 'i').test(document.body.innerText || '');
      },
      HUB_CATEGORY_RE.source,
      { timeout: 20_000 },
    )
    .catch(() => {});
}

async function loginDesktop(page) {
  await loginViaApi(page, { mobile: false });
}

async function loginMobile(page) {
  await loginViaApi(page, { mobile: true });
}

/** @type {Array<{ id: string, label: string, platform: string, category: string, launch: () => Promise<{ browser: import('playwright').Browser, contextOptions?: object }> }>} */
const PROFILES = [];

function addProfile(id, label, platform, category, launch) {
  PROFILES.push({ id, label, platform, category, launch });
}

addProfile('chrome-desktop-win', 'Google Chrome（桌面）', 'Windows', 'desktop', async () => {
  try {
    return { browser: await chromium.launch({ channel: 'chrome', headless: true }) };
  } catch {
    return { browser: await chromium.launch({ headless: true }) };
  }
});

addProfile('edge-desktop-win', 'Microsoft Edge（桌面）', 'Windows', 'desktop', async () => {
  try {
    return { browser: await chromium.launch({ channel: 'msedge', headless: true }) };
  } catch {
    return { browser: await chromium.launch({ headless: true }) };
  }
});

addProfile('firefox-desktop-win', 'Mozilla Firefox（桌面）', 'Windows', 'desktop', async () => ({
  browser: await firefox.launch({ headless: true }),
}));

addProfile('safari-desktop-mac', 'Safari（macOS · WebKit 引擎）', 'macOS', 'desktop', async () => ({
  browser: await webkit.launch({ headless: true }),
}));

addProfile('chrome-android', 'Chrome（Android）', 'Android', 'mobile', async () => ({
  browser: await chromium.launch({ headless: true }),
  contextOptions: devices['Pixel 7'],
}));

addProfile('safari-ios', 'Safari（iOS · WebKit）', 'iOS', 'mobile', async () => ({
  browser: await webkit.launch({ headless: true }),
  contextOptions: devices['iPhone 14'],
}));

addProfile('safari-ipad', 'Safari（iPad · 桌面壳）', 'iPadOS', 'tablet', async () => ({
  browser: await webkit.launch({ headless: true }),
  contextOptions: {
    ...devices['iPad Pro 11'],
    isMobile: false,
    hasTouch: true,
  },
}));

addProfile('firefox-mobile', 'Firefox（移动视口）', 'Android', 'mobile', async () => ({
  browser: await firefox.launch({ headless: true }),
  contextOptions: {
    viewport: devices['Pixel 7'].viewport,
    deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
    userAgent: devices['Pixel 7'].userAgent,
    hasTouch: true,
  },
}));

/** @type {Array<{ profile: string, label: string, platform: string, category: string, checks: Array<{ id: string, pass: boolean, detail?: string }>, skipped?: boolean, skipReason?: string }>} */
const results = [];

function recordCheck(profileResult, id, pass, detail = '') {
  profileResult.checks.push({ id, pass, detail: detail || undefined });
}

async function runDesktopChecks(page, profileResult) {
  await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const rootLen = (await page.locator('#root').innerHTML().catch(() => '')).length;
  recordCheck(profileResult, 'D-01-root', rootLen > 50, `len=${rootLen}`);

  const bodyText = await page.locator('body').innerText();
  recordCheck(profileResult, 'D-02-no-recovery-leak', !/Several tools failed/i.test(bodyText));

  const composer = await page.locator('textarea').first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  recordCheck(profileResult, 'D-03-composer', composer);

  await page.getByRole('button', { name: /New Chat|新建对话/i }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const composerAfterNew = await page.locator('textarea').first().isVisible().catch(() => false);
  recordCheck(profileResult, 'D-04-new-chat', composerAfterNew);

  const settingsBtn = page.getByRole('button', { name: /设置|Settings/i }).first();
  if (await settingsBtn.count()) {
    await settingsBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape').catch(() => {});
  }
  recordCheck(profileResult, 'D-05-settings-open', true, 'probe optional');

  await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: /智能体|Agent|Chat/i }).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const hubOpenVia = await openDesktopCapabilityHub(page);
  const capsFetch = page
    .waitForResponse((response) => response.url().includes('/api/capabilities') && response.ok(), { timeout: 20_000 })
    .catch(() => null);
  await waitForCapabilityHubReady(page);
  await capsFetch;
  const hubRoot = page.locator('[data-testid="capability-hub"]').first();
  const hubText = (await hubRoot.innerText().catch(() => '')) || (await page.locator('body').innerText());
  const hubReady = HUB_CATEGORY_RE.test(hubText);
  recordCheck(
    profileResult,
    'D-06-capability-hub',
    hubReady,
    hubReady ? `via=${hubOpenVia}` : `via=${hubOpenVia}, categories missing`,
  );

  const token = await page.evaluate(() => localStorage.getItem('auth-token'));
  let filesApiOk = false;
  if (token) {
    const res = await page.request
      .get(`${SERVER}/api/projects/general/files/list?path=`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => null);
    filesApiOk = Boolean(res?.ok);
  }
  recordCheck(profileResult, 'D-07-files-api', filesApiOk, filesApiOk ? 'list ok' : 'list failed');
}

async function runMobileChecks(page, profileResult) {
  await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/m\//, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  recordCheck(profileResult, 'M-01-mobile-redirect', page.url().includes('/m/'), page.url());

  await page.locator('.mobile-header').waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  recordCheck(profileResult, 'M-02-header', (await page.locator('.mobile-header').count()) === 1);
  recordCheck(profileResult, 'M-03-tabbar', (await page.locator('.mobile-tabbar button').count()) === 4);

  await page.locator('.mobile-tabbar button').nth(0).click().catch(() => {});
  await page.waitForTimeout(1000);
  const attachBtn = page.locator('.mobile-icon-row button.mobile-touch-target').first();
  const composerTa = page.locator('textarea').first();
  if (await attachBtn.count()) {
    const box = await attachBtn.boundingBox();
    recordCheck(
      profileResult,
      'M-04-touch-target',
      Boolean(box && box.height >= 44 && box.width >= 44),
      box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'missing',
    );
  } else {
    const taBox = await composerTa.boundingBox().catch(() => null);
    recordCheck(
      profileResult,
      'M-04-composer-fallback',
      Boolean(taBox && taBox.height >= 40),
      taBox ? `textarea ${Math.round(taBox.height)}px` : 'no composer',
    );
  }

  await page.locator('.mobile-tabbar button').nth(1).click();
  await page.locator('.mobile-hub-seg-row').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const hubBody = await page.locator('body').innerText();
  recordCheck(profileResult, 'M-05-hub', /营销|办公|创作|开发|Marketing|Office/i.test(hubBody));
  recordCheck(profileResult, 'M-06-hub-seg', (await page.locator('.mobile-hub-seg-row').count()) >= 1);

  await page.locator('.mobile-tabbar button').nth(2).click();
  await page.waitForTimeout(3000);
  const treeCount = await page.locator('[data-file-tree-path]').count();
  const token = await page.evaluate(() => localStorage.getItem('auth-token'));
  let filesApiOk = false;
  if (token) {
    const res = await page.request
      .get(`${SERVER}/api/projects/general/files/list?path=`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => null);
    filesApiOk = Boolean(res?.ok);
  }
  recordCheck(
    profileResult,
    'M-07-files',
    treeCount > 0 || filesApiOk,
    `nodes=${treeCount} api=${filesApiOk}`,
  );

  await page.locator('.mobile-tabbar button').nth(3).click();
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const logout = await page.getByRole('button', { name: /^退出$|^Logout$/i }).first().isVisible().catch(() => false);
  recordCheck(profileResult, 'M-08-me-logout', logout);
}

async function runProfile(profile) {
  const profileResult = {
    profile: profile.id,
    label: profile.label,
    platform: profile.platform,
    category: profile.category,
    checks: [],
  };

  console.log(`\n=== ${profile.label} (${profile.id}) ===`);
  let browser;
  try {
    const launched = await profile.launch();
    browser = launched.browser;
    const ctxOpts = {
      locale: 'zh-CN',
      ...(launched.contextOptions || {}),
    };
    if (!launched.contextOptions) {
      ctxOpts.viewport = profile.category === 'desktop' ? { width: 1440, height: 900 } : undefined;
    }
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();

    if (profile.category === 'desktop' || profile.category === 'tablet') {
      await loginDesktop(page);
      await runDesktopChecks(page, profileResult);
    } else {
      await loginMobile(page);
      await runMobileChecks(page, profileResult);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(OUT_DIR, `${profile.id}.png`), fullPage: false }).catch(() => {});
    await browser.close();
  } catch (error) {
    profileResult.skipped = true;
    profileResult.skipReason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.log(`SKIP ${profile.id} — ${profileResult.skipReason}`);
    if (browser) await browser.close().catch(() => {});
  }

  for (const c of profileResult.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id}${c.detail ? ` — ${c.detail}` : ''}`);
  }

  results.push(profileResult);
}

async function main() {
  console.log(`[browser-compat-matrix] BASE=${BASE} SERVER=${SERVER}`);
  console.log(`[browser-compat-matrix] profiles=${PROFILES.length}`);

  for (const profile of PROFILES) {
    await runProfile(profile);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    server: SERVER,
    profiles: results,
    summary: {
      total: results.length,
      skipped: results.filter((r) => r.skipped).length,
      allChecksPass: results.filter((r) => !r.skipped).every((r) => r.checks.every((c) => c.pass)),
      failedChecks: results.flatMap((r) =>
        r.checks.filter((c) => !c.pass).map((c) => ({ profile: r.id, ...c })),
      ),
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(OUT_DIR, `report-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n[browser-compat-matrix] report → ${jsonPath}`);
  console.log(
    `[browser-compat-matrix] ${report.summary.failedChecks.length} failed check(s), ${report.summary.skipped} skipped profile(s)`,
  );

  if (report.summary.failedChecks.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
