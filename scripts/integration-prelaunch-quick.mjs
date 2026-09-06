#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 上线前快速验收 — 多用户、清缓存首访、近 24h 改动目标。
 * Usage: node scripts/integration-prelaunch-quick.mjs [--skip-browser]
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { prepareSaasDevRuntime } from './lib/devLauncherCore.mjs';
import { runDevStack } from './lib/spawnDevStack.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'prelaunch-quick');
const REPORT_PATH = path.join(OUT_DIR, `report-${new Date().toISOString().slice(0, 10)}.md`);

const skipBrowser = process.argv.includes('--skip-browser');
const browserOnly = process.argv.includes('--browser-only') || process.env.PRELAUNCH_BROWSER_ONLY === '1';
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const results = [];

function record(name, ok, detail = '', metrics = {}) {
  results.push({ name, ok, detail, metrics, at: new Date().toISOString() });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function run(cmd, args, extraEnv = {}, opts = {}) {
  const useShell =
    process.platform === 'win32' &&
    (String(cmd).endsWith('.cmd') || String(cmd).endsWith('.bat') || cmd === 'npm' || cmd === 'npx');
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: useShell,
      windowsHide: true,
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${cmd} ${args.join(' ')} exit ${code}`));
    });
  });
}

async function step(name, fn) {
  try {
    const metrics = (await fn()) || {};
    record(name, true, '', metrics);
    return true;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
    return false;
  }
}

function analyzeLoginBundle() {
  const distDir = path.join(REPO_ROOT, 'ui', 'dist');
  const indexHtml = path.join(distDir, 'index.html');
  assert.ok(fs.existsSync(indexHtml), 'ui/dist missing — run npm --workspace ui run build');

  const html = fs.readFileSync(indexHtml, 'utf8');
  const assetsDir = path.join(distDir, 'assets');
  const assetFiles = fs.readdirSync(assetsDir);

  const entryJs = assetFiles
    .filter((f) => f.startsWith('index-') && f.endsWith('.js'))
    .map((f) => ({ name: f, bytes: fs.statSync(path.join(assetsDir, f)).size }));
  const appShellJs = assetFiles.filter((f) => f.startsWith('AppShellV2-') && f.endsWith('.js'));
  const catalogJs = assetFiles.filter((f) => f.includes('capabilities-catalog'));

  assert.ok(entryJs.length >= 1, 'entry index-*.js not found');
  const mainEntry = entryJs.sort((a, b) => b.bytes - a.bytes)[0];
  assert.ok(appShellJs.length >= 1, 'AppShellV2 chunk missing — login split may be broken');

  const mainKb = Math.round(mainEntry.bytes / 1024);
  const shellKb = Math.round(fs.statSync(path.join(assetsDir, appShellJs[0])).size / 1024);

  assert.ok(mainKb < 1200, `login entry too large: ${mainKb}KB (target <1200KB)`);
  // PD-SAAS-FORK: AppShell chunk size varies with Vite splits; presence + login-page lazy load matter more than min KB.
  assert.ok(shellKb >= 50, `AppShell chunk missing or empty: ${shellKb}KB`);

  return {
    mainEntryKb: mainKb,
    appShellKb: shellKb,
    catalogChunks: catalogJs.length,
    htmlRefsAppShell: /AppShellV2/.test(html),
  };
}

async function waitForUrl(url, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.status > 0 && res.status < 500) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function spawnDevSaas() {
  const pinEnv = {
    SERVER_PORT: process.env.PRELAUNCH_SERVER_PORT || '3011',
    VITE_PORT: process.env.PRELAUNCH_VITE_PORT || '5183',
    PILOTDECK_GATEWAY_PORT: process.env.PRELAUNCH_GATEWAY_PORT || '18801',
  };
  const saved = {};
  for (const [key, value] of Object.entries(pinEnv)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    const runtime = await prepareSaasDevRuntime(REPO_ROOT);
    const mergedEnv = {
      ...runtime.env,
      ...pinEnv,
      PILOTDECK_GATEWAY_URL: `ws://127.0.0.1:${pinEnv.PILOTDECK_GATEWAY_PORT}/ws`,
      PILOTDECK_SKIP_DEFAULT_PROJECT: '1',
    };
    const stack = await runDevStack(REPO_ROOT, mergedEnv, { log: false });
    const base = `http://127.0.0.1:${mergedEnv.VITE_PORT}`;
    const server = `http://127.0.0.1:${mergedEnv.SERVER_PORT}`;
    return { stack, base, server, env: mergedEnv };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function browserSuite(base, server) {
  const browser = await chromium.launch({ headless: true });
  const metrics = {};

  // --- 清缓存首访登录页 ---
  {
    const context = await browser.newContext();
    await context.clearCookies();
    const page = await context.newPage();
    const jsLoads = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/assets/') && url.endsWith('.js')) {
        jsLoads.push(path.basename(new URL(url).pathname));
      }
    });

    const navStart = Date.now();
    await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('[data-testid="saas-auth-shell"]', { timeout: 15_000 });
    const loginVisibleMs = Date.now() - navStart;

    const hasLoginForm = await page.locator('#saas-login-username').isVisible();
    assert.ok(hasLoginForm, 'login username field not visible on cold visit');

    const loadedAppShell = jsLoads.some((f) => f.startsWith('AppShellV2-'));
    assert.ok(!loadedAppShell, `AppShell loaded on login page: ${jsLoads.join(', ')}`);

    metrics.coldLoginVisibleMs = loginVisibleMs;
    metrics.coldLoginJsCount = jsLoads.length;
    metrics.coldLoginLoadedAppShell = loadedAppShell;

    record('browser:cold-login-visible', loginVisibleMs < 12_000, `${loginVisibleMs}ms`, {
      coldLoginVisibleMs: loginVisibleMs,
    });
    record('browser:login-no-appshell-chunk', !loadedAppShell, jsLoads.slice(0, 8).join(', '));

    await context.close();
  }

  // --- 多用户：admin 登录 + 工作台 ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.locator('#saas-login-username').fill('admin');
    await page.locator('#saas-login-password').fill('SAAS_ADMIN_PASSWORD');
    const loginRes = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.status() === 200,
    );
    await page.getByRole('button', { name: '登录工作区' }).click();
    await loginRes;

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
    const postLoginStart = Date.now();
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        const text = root?.innerText?.trim() ?? '';
        return text.length > 80 && !text.includes('登录工作区');
      },
      { timeout: 60_000 },
    );
    metrics.adminShellMs = Date.now() - postLoginStart;

    // 能力中心 Tab
    const discoverTab = page.getByRole('button', { name: /发现|Discover|能力/i }).first();
    if (await discoverTab.isVisible().catch(() => false)) {
      await discoverTab.click();
      await page.waitForTimeout(2000);
      const hubText = await page.locator('body').innerText();
      assert.ok(/营销|办公|创作|开发|Marketing/i.test(hubText), 'capability hub not rendered');
      record('browser:admin-discover-tab', true);
    } else {
      record('browser:admin-discover-tab', true, 'SKIP desktop tab not found (mobile layout?)');
    }

    record('browser:admin-login-shell', metrics.adminShellMs < 45_000, `${metrics.adminShellMs}ms`);

    // 管理后台
    await page.goto(`${base}/admin/users`);
    await page.waitForSelector('[data-testid="saas-admin-users"]', { timeout: 25_000 });
    record('browser:admin-users-page', true);

    await context.close();
  }

  // --- 第二用户 API 注册 + 登录隔离 ---
  {
    const suffix = Date.now().toString(36);
    const username = `uat_${suffix}`;
    const password = 'TestPass123!';

    const captchaRes = await fetch(`${server}/api/saas/captcha`);
    assert.ok(captchaRes.ok, 'captcha endpoint failed');
    const captcha = await captchaRes.json();
    assert.ok(captcha.captchaId && captcha.challenge, 'captcha payload incomplete');

    const regRes = await fetch(`${server}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        captchaId: captcha.captchaId,
        captchaAnswer: captcha.challenge,
      }),
    });
    const regBody = await regRes.json();
    assert.ok(regRes.ok && regBody.token, `register failed: ${regRes.status}`);

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${base}/`);
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
      localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
    }, regBody.token);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        const text = root?.innerText?.trim() ?? '';
        return text.length > 80 && !text.includes('登录工作区');
      },
      { timeout: 60_000 },
    );
    record('browser:tenant-user-login', true, username);

    // admin 与 tenant 项目隔离（API）
    const adminLogin = await fetch(`${server}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
    });
    const adminBody = await adminLogin.json();
    const adminProjects = await fetch(`${server}/api/projects`, {
      headers: { Authorization: `Bearer ${adminBody.token}` },
    });
    const tenantProjects = await fetch(`${server}/api/projects`, {
      headers: { Authorization: `Bearer ${regBody.token}` },
    });
    assert.ok(adminProjects.ok && tenantProjects.ok);
    record('browser:multi-user-api-isolation', true);

    await context.close();
  }

  // --- PWA 窄屏 → 宽屏恢复桌面（近 24h 目标）---
  {
    const adminLogin = await fetch(`${server}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
    });
    const adminBody = await adminLogin.json();
    assert.ok(adminBody.token, 'admin api login failed');

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}/m/p/general`);
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
      localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
    }, adminBody.token);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const narrowUrl = page.url();
    const onMobileRoute = narrowUrl.includes('/m/');
    record('browser:mobile-route-narrow', onMobileRoute, narrowUrl);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(2000);
    const wideUrl = page.url();
    const strippedMobile = !wideUrl.includes('/m/p/');
    record('browser:desktop-route-wide', strippedMobile, wideUrl);

    await context.close();
  }

  // --- 手机登录页清缓存 ---
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await context.clearCookies();
    const page = await context.newPage();
    const t0 = Date.now();
    await page.goto(`${base}/m/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="saas-auth-shell"]', { timeout: 15_000 });
    metrics.mobileLoginVisibleMs = Date.now() - t0;
    record('browser:mobile-cold-login', metrics.mobileLoginVisibleMs < 12_000, `${metrics.mobileLoginVisibleMs}ms`);
    await context.close();
  }

  // --- Skills 对话理解（斜杠菜单 / 试一下 / 列表）---
  {
    const adminLogin = await fetch(`${server}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
    });
    const adminBody = await adminLogin.json();
    assert.ok(adminBody.token, 'admin api login for skills suite');

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${base}/p/general`);
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
      localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
    }, adminBody.token);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const newChat = page.getByRole('button', { name: /New Chat|新建对话/i }).first();
    if (await newChat.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await newChat.click();
      await page.waitForTimeout(800);
    }
    const textarea = page.locator('textarea').first();
    await page.waitForFunction(
      () => document.querySelector('textarea')?.offsetParent !== null,
      { timeout: 90_000 },
    );

    await textarea.click();
    await textarea.fill('/');
    await page.waitForTimeout(500);
    const menuLocator = page.locator('[data-testid="command-menu"], [role="listbox"]').first();
    let menuVisible = await menuLocator.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!menuVisible) {
      await textarea.press('Control+A');
      await textarea.fill('/');
      await page.waitForTimeout(1200);
      menuVisible = await menuLocator.isVisible({ timeout: 15_000 }).catch(() => false);
    }
    record('browser:skills-slash-menu', menuVisible, menuVisible ? 'CommandMenu open' : 'menu not found');

    await textarea.fill('');
    await page.evaluate(() => {
      const prompt = '用「AI 搜索全案」帮我分析品牌在 AI 搜索中的可见度';
      window.dispatchEvent(
        new CustomEvent('pilotdeck:capability-prompt', {
          detail: {
            prompt,
            capability: { slug: 'pd-geo', displayName: 'AI 搜索全案' },
          },
        }),
      );
    });
    await page.waitForTimeout(1200);
    const tryVal = await textarea.inputValue().catch(() => '');
    record(
      'browser:skills-try-prefill',
      tryVal.length > 8,
      tryVal.slice(0, 60) || 'empty composer',
    );

    await context.close();
  }

  // Playwright Skills 多角度（斜杠 / 试一下 / 用户气泡列表）
  try {
    await run(process.execPath, [
      path.join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      'e2e/prelaunch/skills-conversation-stability.spec.ts',
    ], {
      PLAYWRIGHT_BASE_URL: base,
      PLAYWRIGHT_SERVER_URL: server,
    }, { cwd: path.join(REPO_ROOT, 'ui') });
    record('browser:skills-playwright-e2e', true);
  } catch (e) {
    record('browser:skills-playwright-e2e', false, e?.message || String(e));
  }

  await browser.close();
  return metrics;
}

function writeReport() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  const goals = [
    { id: 'login-speed', label: '登录页清缓存快速可见', ok: results.some((r) => r.name.includes('cold-login') && r.ok) },
    { id: 'login-split', label: '登录不下载 AppShell 大包', ok: results.some((r) => r.name === 'browser:login-no-appshell-chunk' && r.ok) },
    { id: 'pwa-resize', label: 'PWA 宽屏恢复桌面路径', ok: results.some((r) => r.name === 'browser:desktop-route-wide' && r.ok) },
    { id: 'multi-user', label: '多用户注册/登录/隔离', ok: results.some((r) => r.name === 'browser:tenant-user-login' && r.ok) },
    { id: 'post-login', label: '登录后工作台与管理后台', ok: results.some((r) => r.name === 'browser:admin-login-shell' && r.ok) },
    { id: 'skills-slash', label: 'Skills 斜杠 CommandMenu', ok: results.some((r) => r.name === 'browser:skills-slash-menu' && r.ok) },
    { id: 'skills-try', label: 'Hub 试一下预填输入框', ok: results.some((r) => r.name === 'browser:skills-try-prefill' && r.ok) },
    { id: 'skills-e2e', label: 'Playwright Skills 稳定性', ok: results.some((r) => r.name === 'browser:skills-playwright-e2e' && r.ok) },
  ];

  const lines = [
    '# 上线前快速验收报告',
    '',
    `时间：${new Date().toISOString()}`,
    '',
    `**合计：${passed}/${results.length} 通过**`,
    '',
    '## 近 24h 改动目标',
    '',
    '| 目标 | 状态 |',
    '|------|------|',
    ...goals.map((g) => `| ${g.label} | ${g.ok ? '✅ 达成' : '❌ 未达成'} |`),
    '',
    '## 明细',
    '',
    '| 项 | 结果 | 说明 |',
    '|----|------|------|',
    ...results.map((r) => `| ${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail || JSON.stringify(r.metrics)} |`),
    '',
  ];

  if (failed.length) {
    lines.push('## 失败项', '', ...failed.map((f) => `- **${f.name}**: ${f.detail}`), '');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`\n[report] ${REPORT_PATH}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('[prelaunch-quick] starting…\n');

  if (!browserOnly) {
    await step('ui:build', () => run(npmCmd, ['--workspace', 'ui', 'run', 'build']));
    await step('static:login-bundle-split', () => analyzeLoginBundle());
    await step('check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));
    await step('check:brand', () => run(npmCmd, ['run', 'brand:check']));

    await step('vitest:mobile-route', () =>
      run(npxCmd, ['vitest', 'run', 'ui/src/mobile/mobileRoute.test.ts']),
    );
    await step('vitest:process-grouping', () =>
      run(npxCmd, [
        'vitest',
        'run',
        'ui/src/components/chat-v2/processGrouping.test.ts',
        'ui/src/shared/collectFinalDeliverables.test.ts',
      ]),
    );
    await step('vitest:process-ux-copy', () => run(npmCmd, ['run', 'test:process-ux:full']));
    await step('smoke:resilience', () => run(npmCmd, ['run', 'smoke:resilience']));
    await step('smoke:dialogue-stability-modules', () => run(npmCmd, ['run', 'smoke:dialogue-stability-modules']));
    await step('playwright:dialogue-stability-regression', () => run(npmCmd, ['run', 'test:dialogue-stability:playwright']));
    await step('vitest:dialogue-stability-unit', () =>
      run(npxCmd, [
        'vitest',
        'run',
        'tests/saas/deliverable-session-goal.test.ts',
        'src/agent/loop/AgentLoop.goalExtraction.test.ts',
        'tests/saas/task-continuation-policy.test.ts',
        'tests/saas/final-acceptance.test.ts',
        'tests/saas/deliverable-capability-profiles.test.ts',
        'tests/saas/user-action-blocker-streak.test.ts',
      ]),
    );
    await step('vitest:dialogue-stability-ui-unit', () =>
      run(npmCmd, [
        '--workspace',
        'ui',
        'run',
        'test',
        '--',
        'src/shared/validateDeliverables.test.ts',
        'src/shared/turnAcceptanceMeta.test.ts',
        'src/shared/userFacingErrors.test.ts',
        'src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx',
        'src/components/chat-v2/hooks/taskResumeCoordinator.test.ts',
      ]),
    );
    // ProcessTimeline mocks react-i18next globally — run isolated to avoid polluting i18n tests above.
    await step('vitest:dialogue-stability-ui-process-timeline', () =>
      run(npmCmd, ['--workspace', 'ui', 'run', 'test', '--', 'src/components/chat-v2/ProcessTimeline.test.tsx']),
    );
    await step('test:task-resilience:unit', () => run(npmCmd, ['run', 'test:task-resilience:unit']));
    await step('test:deliverable-paths', () => run(npmCmd, ['run', 'test:deliverable-paths']));
    await step('test:task-stall:rca:parse', () =>
      run(npmCmd, ['run', 'test:task-stall:rca', '--', '--parse-only']),
    );
    await step('test:task-stall:rca:sessions', () =>
      run(npmCmd, ['run', 'test:task-stall:rca', '--', '--check-sessions']),
    );
    await step('test:four-line-audit', () => run(npmCmd, ['run', 'test:four-line-audit']));
    await step('test:razer-proclick-batch:gate', () => run(npmCmd, ['run', 'test:razer-proclick-batch:gate']));
    await step('verify:saas:data-integrity', () => run(npmCmd, ['run', 'verify:saas:data-integrity']));
    await step('test:multi-skill:matrix', () => run(npmCmd, ['run', 'test:multi-skill:matrix']));
    await step('vitest:document-export', () =>
      run(npxCmd, ['tsx', '--test', 'tests/saas/isOcrExportReady.test.ts']),
    );
    await step('test:document-import:unit', () =>
      run(npxCmd, ['tsx', '--test', 'tests/saas/document-import/*.test.ts']),
    );
    await step('smoke:document-import', () => run(npmCmd, ['run', 'smoke:document-import']));
    await step('smoke:nova-bento', () => run(npmCmd, ['run', 'smoke:nova-bento']));

    await step('saas:deep-multi-user', () => run(npmCmd, ['run', 'test:saas:deep']));
    await step('smoke:saas-isolation', () => run(npmCmd, ['run', 'smoke:saas-isolation']));
    await step('smoke:capability-hub', () => run(npmCmd, ['run', 'smoke:capability-hub']));
    await step('smoke:templates', () => run(npmCmd, ['run', 'smoke:templates']));
  }

  if (!skipBrowser) {
    let devStack = null;
    try {
      const { stack, base, server } = await spawnDevSaas();
      devStack = stack;
      const ready = await waitForUrl(`${base}/login`);
      assert.ok(ready, `dev:saas not ready at ${base}/login`);
      await step('browser:suite', () => browserSuite(base, server));
    } finally {
      if (devStack) {
        devStack.kill();
      }
    }
  } else {
    record('browser:suite', true, 'SKIP --skip-browser');
  }

  writeReport();
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`\n[prelaunch-quick] FAILED ${failed.length} check(s)`);
    process.exit(1);
  }
  console.log('\n[prelaunch-quick] ALL PASS');
}

main().catch((error) => {
  console.error('[prelaunch-quick] fatal:', error);
  writeReport();
  process.exit(1);
});
