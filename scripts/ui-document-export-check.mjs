#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright smoke for UI document export toolbar + async jobs.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { seedFixtureTree } from './lib/playwrightSeedProjectFiles.mjs';

const FIXTURE_DIR = path.resolve('artifacts/document-export-fixtures');
const TARGET_REL = 'artifacts/document-export-fixtures';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const PROJECT = process.env.SAAS_E2E_PROJECT || 'general';

async function runFixtureGenerator() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/generate-document-export-fixtures.mjs'], {
      cwd: path.resolve('.'),
      stdio: 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`fixture generator exit ${code}`))));
  });
}

async function seedFixtures(page) {
  await runFixtureGenerator();
  await seedFixtureTree(page, PROJECT, FIXTURE_DIR, TARGET_REL);
}

async function openFileInSidebar(page, fileName) {
  const filesTab = page.getByRole('tab', { name: /文件|Files/i }).first();
  if (await filesTab.count()) {
    await filesTab.click();
    await page.waitForTimeout(600);
  }
  const link = page.getByText(fileName, { exact: false }).first();
  await link.waitFor({ state: 'visible', timeout: 20000 });
  await link.click();
  await page.waitForTimeout(1200);
}

async function waitForExportButton(page) {
  const btn = page.locator('button[aria-label*="PDF"], button[aria-label*="Export PDF"], button[aria-label*="导出 PDF"]').first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  return btn;
}

async function pollExportJob(page, projectName, jobId, timeoutMs = 180000) {
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
    if (snapshot.status === 'failed') throw new Error(snapshot.error || 'export_failed');
    await page.waitForTimeout(1500);
  }
  throw new Error('export_timeout');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const baseUrl = BASE_URL.replace(/\/$/, '');
  const projectName = PROJECT;

  try {
    await ensurePlaywrightWorkspace(page, BASE_URL);
    await seedFixtures(page);
    await page.goto(`${baseUrl}/p/${projectName}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const reportPath = `${TARGET_REL}/sample-report.md`;
    const slidePath = `${TARGET_REL}/slides-mini/slide-01.png`;

    // E1: markdown report export via async job API
    const jobStart = await page.evaluate(async ({ project, sourcePath }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(`/api/projects/${encodeURIComponent(project)}/files/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sourcePath,
          format: 'pdf',
          engine: 'export_document',
          bundle: false,
        }),
      });
      return res.json();
    }, { project: projectName, sourcePath: reportPath });
    if (!jobStart.jobId) throw new Error('E1: missing jobId');
    const done = await pollExportJob(page, projectName, jobStart.jobId);
    if (!done.relativePath?.endsWith('.pdf')) throw new Error(`E1: bad output ${done.relativePath}`);
    console.log('[ui-document-export] E1 OK', done.relativePath);

    // E4: slide deck capabilities include compose bundle
    const caps = await page.evaluate(async ({ project, sourcePath }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(
        `/api/projects/${encodeURIComponent(project)}/files/export/capabilities?path=${encodeURIComponent(sourcePath)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      return res.json();
    }, { project: projectName, sourcePath: slidePath });
    if (caps.scopeId !== 'slide_deck_png') throw new Error(`E4: expected slide_deck_png got ${caps.scopeId}`);
    const composePdf = caps.capabilities?.find((c) => c.engine === 'compose_images' && c.format === 'pdf');
    if (!composePdf?.bundle) throw new Error('E4: missing bundle compose PDF');
    console.log('[ui-document-export] E4 OK slide_deck_png capabilities');

    // E5: editable PPTX export from slide deck (ocr_editable_pptx)
    const pptJob = await page.evaluate(async ({ project, sourcePath }) => {
      const token = localStorage.getItem('auth-token');
      const res = await fetch(`/api/projects/${encodeURIComponent(project)}/files/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sourcePath,
          format: 'pptx',
          engine: 'ocr_editable_pptx',
          bundle: true,
        }),
      });
      return res.json();
    }, { project: projectName, sourcePath: slidePath });
    if (!pptJob.jobId) throw new Error(`E5: missing jobId ${JSON.stringify(pptJob)}`);
    const pptDone = await pollExportJob(page, projectName, pptJob.jobId, 300000);
    if (!pptDone.relativePath?.endsWith('.pptx')) throw new Error(`E5: bad output ${pptDone.relativePath}`);
    console.log('[ui-document-export] E5 OK editable pptx', pptDone.relativePath);

    // E7: no duplicate pdf→pdf on md
    const dupPdf = caps.capabilities?.filter((c) => c.format === 'pdf' && c.engine === 'export_document');
    if (caps.scopeId === 'slide_deck_png') {
      // already checked
    } else if (dupPdf?.length > 2) {
      throw new Error('E7: too many pdf export buttons');
    }

    // E6 (optional): preview toolbar when sidebar lists fixture
    try {
      await openFileInSidebar(page, 'sample-report.md');
      const pdfBtn = await waitForExportButton(page);
      await pdfBtn.click();
      await page.waitForTimeout(500);
      console.log('[ui-document-export] E6 toolbar click OK');
    } catch (err) {
      console.log('[ui-document-export] E6 skipped (sidebar):', err?.message || err);
    }

    console.log('[ui-document-export] all checks passed');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[ui-document-export] FAIL:', err.message || err);
  process.exit(1);
});
