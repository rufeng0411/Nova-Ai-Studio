#!/usr/bin/env node
/**
 * 实机验收：UI 预览栏 PPT 导出（报告 MD + 幻灯片 PNG，含 Node 兜底路径）
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { seedFixtureTree, statProjectRelative } from './lib/playwrightSeedProjectFiles.mjs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const FIXTURE_DIR = path.resolve('artifacts/document-export-fixtures');
const TARGET_REL = 'artifacts/document-export-fixtures';
const PROJECT = process.env.SAAS_E2E_PROJECT || 'general';
const REPORT_PATH = 'artifacts/document-export-fixtures/sample-report.md';
const SLIDE_PATH = 'artifacts/document-export-fixtures/slides-mini/slide-01.png';

async function enterWorkspace(page) {
  const target = `${BASE_URL.replace(/\/$/, '')}/p/${PROJECT}`;
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) {
    const saasUser = page.locator('#saas-login-username');
    if (await saasUser.count()) {
      await ensurePlaywrightWorkspace(page, BASE_URL);
      return;
    }
    throw new Error('login wall without SaaS form — start dev:saas or open workspace manually');
  }
  await page.evaluate(() => {
    localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
  });
}

async function seedFixtures(page) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/generate-document-export-fixtures.mjs'], {
      cwd: path.resolve('.'),
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`fixture exit ${code}`))));
  });
  await seedFixtureTree(page, PROJECT, FIXTURE_DIR, TARGET_REL);
}

async function pollExport(page, projectName, jobId, timeoutMs = 480000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const snapshot = await page.evaluate(async ({ project, id }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(`/api/projects/${encodeURIComponent(project)}/files/export/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    }, { project: projectName, id: jobId });
    if (snapshot.status === 'done') return snapshot;
    if (snapshot.status === 'failed') {
      throw new Error(snapshot.error || 'export_failed');
    }
    await page.waitForTimeout(1200);
  }
  throw new Error('export_timeout');
}

async function startExport(page, projectName, body, pollTimeoutMs = 480000) {
  const result = await page.evaluate(async ({ project, payload }) => {
    const token = localStorage.getItem('auth-token');
    const res = await fetch(`/api/projects/${encodeURIComponent(project)}/files/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }, { project: projectName, payload: body });
  if (!result.jobId) throw new Error('missing jobId');
  return pollExport(page, projectName, result.jobId, pollTimeoutMs);
}

async function assertFileSize(page, projectName, relativePath, minBytes, label) {
  const stat = await statProjectRelative(page, projectName, relativePath);
  if (stat.size < minBytes) {
    throw new Error(`${label}: file too small (${stat.size} bytes)`);
  }
  console.log(`[ppt-live] ${label} OK ${relativePath} (${stat.size} bytes)`);
}

async function openFile(page, fileName) {
  const filesTab = page.getByRole('tab', { name: /文件|Files/i }).first();
  if (await filesTab.count()) {
    await filesTab.click();
    await page.waitForTimeout(800);
  }
  for (const folder of ['artifacts', 'document-export-fixtures']) {
    const row = page.getByText(folder, { exact: true }).first();
    if (await row.count()) {
      await row.click();
      await page.waitForTimeout(400);
    }
  }
  const link = page.getByText(fileName, { exact: true }).first();
  await link.waitFor({ state: 'visible', timeout: 20_000 });
  await link.click();
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await enterWorkspace(page);
    await seedFixtures(page);

    // T1: 报告 MD → PPT（export_document）
    const reportDone = await startExport(page, PROJECT, {
      sourcePath: REPORT_PATH,
      format: 'pptx',
      engine: 'export_document',
      bundle: false,
    });
    if (!reportDone.relativePath?.endsWith('.pptx')) {
      throw new Error(`T1: bad output ${reportDone.relativePath}`);
    }
    await assertFileSize(page, PROJECT, reportDone.relativePath, 5000, 'T1 report→pptx');

    // T2: 幻灯片 PNG → PPT（compose_images，Node 兜底）
    const caps = await page.evaluate(async ({ project, sourcePath }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project)}/files/export/capabilities?path=${encodeURIComponent(sourcePath)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      return res.json();
    }, { project: PROJECT, sourcePath: SLIDE_PATH });
    if (caps.scopeId !== 'slide_deck_png') {
      throw new Error(`T2: expected slide_deck_png got ${caps.scopeId}`);
    }
    const composePptx = caps.capabilities?.find((c) => c.engine === 'compose_images' && c.format === 'pptx');
    if (!composePptx) throw new Error('T2: missing compose_images pptx capability');

    const slideDone = await startExport(page, PROJECT, {
      sourcePath: SLIDE_PATH,
      format: 'pptx',
      engine: 'compose_images',
      bundle: true,
    });
    if (!slideDone.relativePath?.endsWith('.pptx')) {
      throw new Error(`T2: bad output ${slideDone.relativePath}`);
    }
    await assertFileSize(page, PROJECT, slideDone.relativePath, 3000, 'T2 slides→pptx');

    // T4: 幻灯片 PNG → 可编辑 PPT（ocr_editable_pptx / Kit pipeline）
    const editableDone = await startExport(page, PROJECT, {
      sourcePath: SLIDE_PATH,
      format: 'pptx',
      engine: 'ocr_editable_pptx',
      bundle: true,
    }, 300000);
    if (!editableDone.relativePath?.endsWith('.pptx')) {
      throw new Error(`T4: bad output ${editableDone.relativePath}`);
    }
    await assertFileSize(page, PROJECT, editableDone.relativePath, 5000, 'T4 editable slides→pptx');

    // T3: 浏览器内二次导出（模拟预览栏点击后的同一 API 链路）
    const reportCaps = await page.evaluate(async ({ project, sourcePath }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project)}/files/export/capabilities?path=${encodeURIComponent(sourcePath)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      return res.json();
    }, { project: PROJECT, sourcePath: REPORT_PATH });
    const pptCap = reportCaps.capabilities?.find((c) => c.format === 'pptx' && c.engine === 'export_document');
    if (!pptCap) throw new Error('T3: report missing pptx capability');
    const t3Done = await startExport(page, PROJECT, {
      sourcePath: REPORT_PATH,
      format: 'pptx',
      engine: 'export_document',
      bundle: false,
    });
    await assertFileSize(page, PROJECT, t3Done.relativePath, 5000, 'T3 browser re-export');
    console.log('[ppt-live] T3 browser export OK', t3Done.relativePath);

    console.log('[ppt-live] all checks passed');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[ppt-live] FAIL:', err.message || err);
  process.exit(1);
});
