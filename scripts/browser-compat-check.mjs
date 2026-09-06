#!/usr/bin/env node
/**
 * PD-SAAS-FORK: desktop browser compatibility (Chromium full + Firefox/WebKit lean).
 */
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BASE = (process.env.BASE_URL || process.env.VITE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const SHOT_DIR = process.env.SHOT_DIR || path.join(REPO_ROOT, 'artifacts', 'browser-compat');
const LEAN = process.argv.includes('--lean') || process.env.BROWSER_COMPAT_LEAN === '1';

const engines = {
  chromium: { type: chromium, full: true },
  firefox: { type: firefox, full: !LEAN },
  webkit: { type: webkit, full: !LEAN },
};

let failures = 0;
function ok(name, pass, extra = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!pass) failures += 1;
}

async function login(page) {
  await ensurePlaywrightWorkspace(page, BASE);
  await page.waitForTimeout(1500);
}

async function checkCore(page, engineName, mode) {
  const prefix = `[${engineName}/${mode}]`;
  await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const rootLen = (await page.locator('#root').innerHTML().catch(() => '')).length;
  ok(`${prefix} P1 root non-empty`, rootLen > 50, `len=${rootLen}`);

  const body = page.locator('body');
  ok(`${prefix} R-02 no Recovery leak`, !(await body.innerText()).match(/Several tools failed/i));

  const textarea = page.locator('textarea').first();
  const composerVisible = await textarea
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  ok(`${prefix} composer visible`, composerVisible);

  if (mode === 'full') {
    await page.getByRole('button', { name: /New Chat|新建对话/i }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const newChatComposer = await textarea
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    ok(`${prefix} P2 new chat composer`, newChatComposer);

    await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const hubBtn = page.getByRole('button', { name: /能力|Capability|Discover/i }).first();
    if (await hubBtn.count()) await hubBtn.click();
    await page.waitForTimeout(2000);
    const hubText = await body.innerText();
    ok(`${prefix} P4 capability hub`, /营销|办公|创作|Marketing|Office/i.test(hubText));
  }

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, `${engineName}-${mode}-chat.png`) }).catch(() => {});
}

async function runEngine(name, browserType, full) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
  } catch (error) {
    console.log(`SKIP [${name}] ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    return;
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  await login(page);
  await checkCore(page, name, full ? 'full' : 'lean');
  await browser.close();
}

async function main() {
  console.log(`[browser-compat] BASE=${BASE} lean=${LEAN}`);
  for (const [name, { type, full }] of Object.entries(engines)) {
    if (LEAN && name !== 'chromium' && !full) {
      await runEngine(name, type, false);
    } else if (!LEAN || name === 'chromium' || full) {
      await runEngine(name, type, full || name === 'chromium');
    }
  }
  if (failures > 0) {
    console.error(`${failures} browser compat check(s) failed`);
    process.exit(1);
  }
  console.log('all browser compat checks passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
