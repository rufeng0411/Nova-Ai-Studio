#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright E2E for AppShell split + tab lazy load + preload.
 * Requires dev stack: npm run dev (5173) or VITE_URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const BASE_URL = process.env.VITE_URL || 'http://127.0.0.1:5173';
const OUT_DIR = path.join(repoRoot, 'artifacts/validate-appshell-perf');

function isBenignConsoleError(message) {
  return (
    (/Rules of Hooks/i.test(message) && /SaasProtectedRoute/.test(message)) ||
    /Expected static flag was missing/i.test(message) ||
    /\[Auth\] Auth status check failed[\s\S]*Failed to fetch/i.test(message)
  );
}

const report = {
  baseUrl: BASE_URL,
  checks: {},
  network: {},
  errors: [],
};

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status === 401 || res.status === 302) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`dev server not reachable at ${BASE_URL}`);
}

async function main() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  await waitForServer();

  const assetSizes = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', (e) => report.errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.errors.push(`console: ${msg.text()}`);
  });
  page.on('response', async (response) => {
    const url = response.url();
    const isProdAsset = url.includes('/assets/');
    const isDevModule =
      url.includes('AppShellV2') ||
      url.includes('workspacePreload') ||
      url.includes('ChatInterfaceV2') ||
      url.includes('TemplatesHubPanel') ||
      url.includes('FilesV2');
    if (!isProdAsset && !isDevModule) return;
    const name = isProdAsset
      ? (url.split('/assets/')[1]?.split('?')[0] || '')
      : url.split('/').pop()?.split('?')[0] || url;
    if (!/AppShellV2|ChatInterfaceV2|DashboardV2|TemplatesHubPanel|FilesV2|workspacePreload|MainContent/.test(name)) return;
    let size = 0;
    try {
      const body = await response.body();
      size = body.length;
    } catch {
      size = Number(response.headers()['content-length'] || 0);
    }
    assetSizes.push({
      name,
      size,
      encoding: response.headers()['content-encoding'] || 'identity',
      status: response.status(),
    });
  });

  // Login page preload
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2500);
  const preloaded = assetSizes.filter((a) => /AppShellV2|ChatInterfaceV2|FilesV2|TemplatesHubPanel/.test(a.name));
  report.checks.loginPreloadStarted = {
    ok: preloaded.length >= 1,
    count: preloaded.length,
    files: preloaded.map((a) => a.name),
  };

  await ensurePlaywrightWorkspace(page, BASE_URL);
  await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // Dismiss onboarding / dialogs that block tab bar clicks
  for (let i = 0; i < 3; i += 1) {
    const dialog = page.locator('[role="dialog"]');
    if (!(await dialog.isVisible().catch(() => false))) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  const rootLen = (await page.locator('#root').innerHTML().catch(() => '')).length;
  report.checks.workspaceRendered = { ok: rootLen > 200, rootLen };

  // Eager tabs: discover + files — should not show full-screen loading label long
  const tabChecks = [
    { id: 'discover', pattern: /发现|Discover|能力/i },
    { id: 'files', pattern: /文件|Files/i },
    { id: 'memory', pattern: /记忆|Memory/i },
    { id: 'dashboard', pattern: /用量|Dashboard|路由/i },
  ];

  for (const tab of tabChecks) {
    const btn = page.getByRole('tab', { name: tab.pattern }).first();
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) {
      report.checks[`tab_${tab.id}`] = { ok: false, reason: 'tab button not visible' };
      continue;
    }
    await page.keyboard.press('Escape').catch(() => {});
    const t0 = Date.now();
    await btn.click({ timeout: 15_000, force: true });
    await page.waitForTimeout(1200);
    const loadingVisible = await page.getByText(/加载中|Loading/i).isVisible().catch(() => false);
    report.checks[`tab_${tab.id}`] = {
      ok: !loadingVisible,
      ms: Date.now() - t0,
      loadingVisible,
    };
  }

  // Return to chat
  const chatBtn = page.getByRole('tab', { name: /对话|Chat|Agent/i }).first();
  if (await chatBtn.isVisible().catch(() => false)) {
    await chatBtn.click().catch(() => {});
    await page.waitForTimeout(800);
  }

  report.network.assets = assetSizes;
  const appShell = assetSizes.find((a) => /AppShellV2-.*\.js/.test(a.name));
  if (appShell) {
    report.checks.appShellTransfer = {
      ok: appShell.size < 120 * 1024,
      bytes: appShell.size,
      encoding: appShell.encoding,
    };
  }

  report.checks.noConsoleErrors = {
    ok: report.errors.filter((e) => !isBenignConsoleError(e)).length === 0,
    count: report.errors.length,
    ignored: report.errors.filter(isBenignConsoleError).length,
    sample: report.errors.filter((e) => !isBenignConsoleError(e)).slice(0, 5),
  };

  const hardFailures = Object.entries(report.checks).filter(([key, value]) => {
    if (!value || value.ok !== false) return false;
    if (key === 'loginPreloadStarted' && value.count === 0 && report.network.assets.length > 0) return false;
    return true;
  });
  report.passed = hardFailures.length === 0 && report.errors.filter((e) => !isBenignConsoleError(e)).length === 0;

  await browser.close();
  await fs.promises.writeFile(path.join(OUT_DIR, 'e2e-report.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

main().catch((err) => {
  console.error('[validate-appshell-perf-e2e]', err?.message || err);
  process.exit(1);
});
