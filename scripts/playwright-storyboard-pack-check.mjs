#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright-side validation for the latest storyboard pack smoke.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const BASE_URL = process.env.VITE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const PROJECT = process.env.SAAS_E2E_PROJECT || 'general';
const LAST_REPORT = path.resolve('artifacts', 'storyboard-pack-smoke-last.json');
const OUT_DIR = path.resolve('artifacts', 'dialogue-stability-final-review');

async function loadLastReport() {
  const raw = await fs.readFile(LAST_REPORT, 'utf8');
  return JSON.parse(raw);
}

function requiredPaths(report) {
  return (report.deliverables?.required || [])
    .map((item) => item.path || item.basename)
    .filter(Boolean);
}

function inferHintDir(paths) {
  const first = paths.find((p) => String(p).startsWith('artifacts/'));
  if (!first) return undefined;
  const parts = String(first).split('/');
  if (parts.length < 3) return undefined;
  return parts.slice(0, 2).join('/');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = await loadLastReport();
  const paths = requiredPaths(report);
  const hintDir = inferHintDir(paths);
  if (paths.length !== 3) {
    throw new Error(`Expected 3 storyboard paths, got ${paths.length}`);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const result = {
    startedAt: new Date().toISOString(),
    checks: {},
    paths,
    hintDir,
  };

  try {
    await ensurePlaywrightWorkspace(page, BASE_URL);
    await page.goto(`${BASE_URL.replace(/\/$/, '')}/p/${PROJECT}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(1500);

    const textarea = page.locator('textarea').first();
    if (await textarea.count()) {
      await textarea.click();
      await textarea.fill(`分镜包成果已生成：${paths.join('、')}。请只确认这些路径，不要调用工具。`);
      await textarea.press('Enter');
      await page.waitForTimeout(6000);
    }

    const validation = await page.evaluate(async ({ project, validatePaths, validateHintDir }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(`/api/projects/${encodeURIComponent(project)}/deliverables/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ paths: validatePaths, hintDir: validateHintDir }),
      });
      return res.json();
    }, { project: PROJECT, validatePaths: paths, validateHintDir: hintDir });
    const items = validation.items || [];
    const verified = items.filter((item) => item.status === 'verified');
    result.checks.serverValidation = {
      ok: verified.length === paths.length,
      verified: verified.length,
      total: paths.length,
      broken: items.filter((item) => item.status !== 'verified'),
    };

    const resolveResults = [];
    for (const filePath of paths) {
      const resolved = await page.evaluate(async ({ project, pathToResolve, resolveHintDir }) => {
        const token = localStorage.getItem('auth-token');
        const qs = new URLSearchParams({ filePath: pathToResolve });
        if (resolveHintDir) qs.set('hintDir', resolveHintDir);
        const res = await fetch(`/api/projects/${encodeURIComponent(project)}/file/resolve?${qs.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return { status: res.status, body: await res.json().catch(() => null) };
      }, { project: PROJECT, pathToResolve: filePath, resolveHintDir: hintDir });
      resolveResults.push({ path: filePath, ...resolved });
    }
    result.checks.resolveEach = {
      ok: resolveResults.every((item) => item.status >= 200 && item.status < 300 && item.body?.ok !== false),
      results: resolveResults,
    };

    const bodyText = await page.locator('body').innerText().catch(() => '');
    result.checks.rawErrorLeak = {
      ok: !/fetch failed|Large file repair|Repeated invalid tool input/i.test(bodyText),
    };
    result.checks.pathEchoVisible = {
      ok: paths.every((p) => bodyText.includes(path.basename(p))),
    };

    await page.screenshot({
      path: path.join(OUT_DIR, 'storyboard-pack-playwright.png'),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }

  result.endedAt = new Date().toISOString();
  result.passed =
    result.checks.serverValidation?.ok === true
    && result.checks.resolveEach?.ok === true
    && result.checks.rawErrorLeak?.ok === true
    && result.checks.pathEchoVisible?.ok === true;

  const outPath = path.join(OUT_DIR, 'storyboard-pack-playwright-report.json');
  await fs.writeFile(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
}

main().catch((error) => {
  console.error('[playwright-storyboard-pack]', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
