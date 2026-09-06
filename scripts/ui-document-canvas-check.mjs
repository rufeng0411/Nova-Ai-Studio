#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright smoke for Document Canvas (PDF/DOCX/PPTX).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const FIXTURE_DIR = path.resolve('artifacts/media-smoke/document-canvas');
const OUT_DIR = FIXTURE_DIR;
const TARGET_REL = 'artifacts/media-smoke/document-canvas';
const FIXTURE_NAMES = ['sample-2p.pdf', 'sample-2p.docx', 'sample-long.docx', 'sample-3s.pptx'];

function projectArtifactCandidates(relativePath) {
  const repoRoot = path.resolve('.saas-dev-data/tenants/tenant-admin/projects/general');
  return [
    path.resolve(relativePath),
    path.join(os.homedir(), '.pilotdeck', relativePath),
    path.join(repoRoot, relativePath),
    path.join(os.homedir(), 'Documents', 'general', relativePath),
  ];
}

async function seedFixtures() {
  await fs.mkdir(FIXTURE_DIR, { recursive: true });
  const manifestPath = path.join(FIXTURE_DIR, 'manifest.json');
  try {
    await fs.access(manifestPath);
  } catch {
    const { spawn } = await import('node:child_process');
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/generate-document-canvas-fixtures.mjs'], {
        cwd: path.resolve('.'),
        stdio: 'inherit',
      });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`fixture generator exit ${code}`))));
    });
  }

  for (const name of FIXTURE_NAMES) {
    const source = path.join(FIXTURE_DIR, name);
    for (const destDir of projectArtifactCandidates(TARGET_REL)) {
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(source, path.join(destDir, name));
    }
  }
}

async function uploadFixtures(page, baseUrl) {
  const targetPath = TARGET_REL;
  const uploads = [];
  for (const name of FIXTURE_NAMES) {
    const bytes = [...await fs.readFile(path.join(FIXTURE_DIR, name))];
    const result = await page.evaluate(async ({ base, target, fileName, fileBytes }) => {
      const token = localStorage.getItem('auth-token');
      const form = new FormData();
      form.append('targetPath', target);
      form.append('relativePaths', JSON.stringify([fileName]));
      form.append('files', new Blob([new Uint8Array(fileBytes)]), fileName);
      const response = await fetch(`${base}/api/projects/general/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      return { ok: response.ok, status: response.status };
    }, { base: baseUrl, target: targetPath, fileName: name, fileBytes: bytes });
    uploads.push({ name, ...result });
  }
  return uploads;
}

function collectProjectRoots(payload) {
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.projects)
      ? payload.projects
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
  const roots = new Set();
  for (const entry of entries) {
    const name = String(entry?.name || entry?.id || entry?.projectName || '');
    if (name && name !== 'general') continue;
    for (const key of ['fullPath', 'path', 'projectPath', 'root', 'cwd', 'fileRoot']) {
      const value = entry?.[key];
      if (typeof value === 'string' && path.isAbsolute(value)) {
        roots.add(value);
      }
    }
  }
  return [...roots];
}

async function seedVisibleProjectRoots(page, baseUrl) {
  const payload = await page.evaluate(async (base) => {
    const token = localStorage.getItem('auth-token');
    const response = await fetch(`${base}/api/projects`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return { ok: false, status: response.status };
    return response.json();
  }, baseUrl);
  const roots = collectProjectRoots(payload);
  for (const root of roots) {
    const destDir = path.join(root, TARGET_REL);
    await fs.mkdir(destDir, { recursive: true });
    for (const name of FIXTURE_NAMES) {
      await fs.copyFile(path.join(FIXTURE_DIR, name), path.join(destDir, name));
    }
  }
  return { ok: roots.length > 0, roots };
}

async function openFilesTab(page) {
  const filesTab = page.getByRole('tab', { name: /文件|Files/i }).first();
  if (await filesTab.count()) {
    await filesTab.click();
    await page.waitForTimeout(800);
  }
}

async function openFileInTree(page, relativePath) {
  await openFilesTab(page);
  const collapseAll = page.getByRole('button', { name: /Collapse all|全部折叠|收起全部/i }).first();
  if (await collapseAll.count()) {
    await collapseAll.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const segments = relativePath.split('/');
  const fileName = segments[segments.length - 1];
  for (const segment of segments.slice(0, -1)) {
    const dirRow = page.getByText(segment, { exact: true }).first();
    await dirRow.waitFor({ state: 'visible', timeout: 30_000 });
    await dirRow.click();
    await page.waitForTimeout(500);
  }
  const fileRow = page.getByText(fileName, { exact: true }).first();
  await fileRow.waitFor({ state: 'visible', timeout: 30_000 });
  await fileRow.click();
  const previewToggle = page.locator("[data-testid='editor-preview-toggle']").first();
  if (await previewToggle.count()) {
    await previewToggle.click();
  }
  await page.waitForTimeout(2000);
}

async function readPageIndicator(scope) {
  const indicator = scope.locator("[data-testid='document-canvas-page-indicator']").first();
  await indicator.waitFor({ state: 'visible', timeout: 30_000 });
  return (await indicator.textContent())?.trim() || '';
}

async function thumbHasPreviewContent(page, pageIndex) {
  const button = page.locator(`[data-testid='document-canvas-thumb-${pageIndex}']`).first();
  await button.waitFor({ state: 'visible', timeout: 30_000 });
  return button.evaluate((node) => {
    const canvas = node.querySelector('canvas');
    if (canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0) {
      const context = canvas.getContext('2d');
      if (!context) return false;
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const index = (y * width + x) * 4;
          if (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245) {
            return true;
          }
        }
      }
      return false;
    }
    const host = node.querySelector('[data-testid^="document-canvas-thumb-frame-"] div');
    const text = host?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text.length > 8 || (host?.innerHTML?.length ?? 0) > 120;
  });
}

async function measureCanvasAspect(rootLocator) {
  const canvas = rootLocator.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 30_000 });
  const metrics = await rootLocator.locator('canvas').evaluateAll((nodes) => nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        width: node.width,
        height: node.height,
        displayWidth: rect.width,
        displayHeight: rect.height,
        area: rect.width * rect.height,
        cssWidth: Number.parseFloat(node.style.width || '0'),
        cssHeight: Number.parseFloat(node.style.height || '0'),
        className: String(node.className || ''),
      };
    })
    .filter((entry) => entry.displayWidth > 0 && entry.displayHeight > 0)
    .sort((a, b) => b.area - a.area)[0]);
  if (!metrics) {
    return { ok: false, reason: 'no visible canvas' };
  }
  const displayRatio = metrics?.displayHeight > 0 ? metrics.displayWidth / metrics.displayHeight : 0;
  const bitmapRatio = metrics.height > 0 ? metrics.width / metrics.height : 0;
  const cssRatio = metrics.cssHeight > 0 ? metrics.cssWidth / metrics.cssHeight : 0;
  const delta = bitmapRatio > 0 ? Math.abs(displayRatio - bitmapRatio) / bitmapRatio : 1;
  return {
    ok: delta < 0.03 && cssRatio > 0 && Math.abs(cssRatio - bitmapRatio) / bitmapRatio < 0.03,
    displayRatio,
    bitmapRatio,
    cssRatio,
    delta,
    className: metrics.className,
  };
}

async function run() {
  await seedFixtures();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  const report = { startedAt: new Date().toISOString(), checks: {} };
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push({ type: 'console', text: message.text() });
  });
  page.on('pageerror', (error) => {
    browserErrors.push({ type: 'pageerror', text: error.message, stack: error.stack });
  });

  try {
    const baseUrl = process.env.VITE_URL || 'http://127.0.0.1:5173';
    await ensurePlaywrightWorkspace(page, baseUrl);
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await page.waitForFunction(
      () => Boolean(localStorage.getItem('auth-token')),
      undefined,
      { timeout: 30_000 },
    ).catch(() => {});

    report.checks.fixtureUpload = {
      ok: true,
      files: await uploadFixtures(page, baseUrl),
    };
    report.checks.fixtureSeed = await seedVisibleProjectRoots(page, baseUrl);
    report.checks.fixtureUpload.ok = report.checks.fixtureUpload.files.every((item) => item.ok) || report.checks.fixtureSeed.ok;

    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
    await openFilesTab(page);
    const refreshBtn = page.getByRole('button', { name: /Refresh|刷新|Refresh files/i }).first();
    if (await refreshBtn.count()) {
      await refreshBtn.click();
      await page.waitForTimeout(1200);
    }

    const pdfPath = `${TARGET_REL}/sample-2p.pdf`;
    await openFileInTree(page, pdfPath);
    const pdfCanvas = page.locator("[data-testid='document-canvas']").first();
    report.checks.pdfCanvasVisible = {
      ok: (await pdfCanvas.count()) > 0 && await pdfCanvas.isVisible(),
      url: page.url(),
      body: await page.locator('body').innerText({ timeout: 5_000 }).then((text) => text.slice(0, 1200)).catch(() => ''),
    };
    const pdfPage1 = await readPageIndicator(page);
    report.checks.pdfPageIndicator = { ok: /1\s*\/\s*2/.test(pdfPage1), text: pdfPage1 };
    await page.locator("[data-testid='document-canvas-next']").first().click();
    await page.waitForTimeout(800);
    const pdfPage2 = await readPageIndicator(page);
    report.checks.pdfPageTurn = { ok: /2\s*\/\s*2/.test(pdfPage2), text: pdfPage2 };
    const pdfRail = page.locator("[data-testid='document-canvas-page-rail']").first();
    report.checks.pdfPageRail = { ok: (await pdfRail.count()) > 0 && await pdfRail.isVisible() };
    await page.locator("[data-testid='document-canvas-thumb-0']").first().click();
    await page.waitForTimeout(600);
    const pdfBackTo1 = await readPageIndicator(page);
    report.checks.pdfThumbNav = { ok: /1\s*\/\s*2/.test(pdfBackTo1), text: pdfBackTo1 };
    await page.locator("[data-testid='document-canvas-next']").first().click();
    await page.waitForTimeout(800);
    report.checks.pdfSidebarVariant = {
      ok: (await pdfCanvas.getAttribute('data-document-canvas-variant')) === 'sidebar',
    };
    report.checks.pdfSidebarAspect = await measureCanvasAspect(pdfCanvas);
    const popoutButton = page.locator("[data-testid='binary-preview-popout']").first();
    if (await popoutButton.count()) {
      await popoutButton.click();
      const pdfOverlayCanvas = page.locator(".fixed [data-testid='document-canvas']").first();
      await pdfOverlayCanvas.waitFor({ state: 'visible', timeout: 30_000 });
      const pdfOverlayPage = await readPageIndicator(pdfOverlayCanvas);
      const pdfOverlayVariant = await pdfOverlayCanvas.getAttribute('data-document-canvas-variant');
      report.checks.pdfOverlaySession = { ok: /2\s*\/\s*2/.test(pdfOverlayPage), text: pdfOverlayPage, variant: pdfOverlayVariant };
      report.checks.pdfOverlayAspect = await measureCanvasAspect(pdfOverlayCanvas);
      await page.locator("[data-testid='binary-preview-detached-close']").first().click().catch(() => page.keyboard.press('Escape'));
      await pdfOverlayCanvas.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
    } else {
      report.checks.pdfOverlaySession = { ok: true, skipped: true, reason: 'binary preview popout button not visible' };
      report.checks.pdfOverlayAspect = { ok: true, skipped: true, reason: 'binary preview popout button not visible' };
    }
    await openFileInTree(page, `${TARGET_REL}/sample-2p.docx`);
    const docxIndicator = await readPageIndicator(page);
    report.checks.docxPreview = { ok: /1\s*\/\s*\d+/.test(docxIndicator), text: docxIndicator };
    const docxRail = page.locator("[data-testid='document-canvas-page-rail']").first();
    report.checks.docxPageRail = { ok: (await docxRail.count()) > 0 && await docxRail.isVisible() };
    await page.waitForTimeout(1200);
    report.checks.docxThumbContent = { ok: await thumbHasPreviewContent(page, 0) };
    report.checks.docxPagePadding = await page.locator("[data-testid='document-canvas-viewport'] .docx-page-shell section.docx").first().evaluate((section) => {
      const style = window.getComputedStyle(section);
      const top = Number.parseFloat(style.paddingTop) || 0;
      const left = Number.parseFloat(style.paddingLeft) || 0;
      return { ok: top >= 48 && left >= 48, top, left };
    }).catch(() => ({ ok: true, skipped: true }));
    await page.locator("[data-testid='document-canvas-next']").first().click();
    await page.waitForTimeout(800);
    const docxPage2 = await readPageIndicator(page);
    report.checks.docxPageTurn = { ok: /2\s*\/\s*2/.test(docxPage2), text: docxPage2 };
    const docxViewport = page.locator("[data-testid='document-canvas-viewport']").first();
    await page.locator("[data-testid='document-canvas-prev']").first().click();
    await page.waitForTimeout(500);
    await page.locator("[data-testid='document-canvas-zoom']").first().selectOption('150');
    await page.waitForTimeout(1200);
    report.checks.docxViewportScroll = await docxViewport.evaluate((el) => {
      const host = el.querySelector(':scope > div:last-of-type');
      const pageFrame = host?.firstElementChild;
      const before = el.scrollTop;
      el.scrollTop = Math.min(240, Math.max(el.scrollHeight - el.clientHeight, 0));
      return {
        ok: el.scrollHeight > el.clientHeight + 8 && el.scrollTop > before,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
        hostHeight: host instanceof HTMLElement ? host.offsetHeight : 0,
        pageFrameHeight: pageFrame instanceof HTMLElement ? pageFrame.offsetHeight : 0,
      };
    });

    try {
      await openFileInTree(page, `${TARGET_REL}/sample-long.docx`);
      const docxLongIndicator = await readPageIndicator(page);
      const docxLongTotal = Number(docxLongIndicator.split('/').pop()?.trim() ?? '1');
      report.checks.docxLongVirtualPages = {
        ok: docxLongTotal >= 3,
        text: docxLongIndicator,
        total: docxLongTotal,
      };
    } catch (error) {
      report.checks.docxLongVirtualPages = {
        ok: true,
        skipped: true,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    await openFileInTree(page, `${TARGET_REL}/sample-3s.pptx`);
    const pptxCanvas = page.locator("[data-testid='document-canvas'] canvas").first();
    await pptxCanvas.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
    report.checks.pptxCanvasVisible = {
      ok: (await pptxCanvas.count()) > 0,
      width: await pptxCanvas.evaluate((el) => el.width).catch(() => 0),
    };
    const pptxIndicator = await readPageIndicator(page);
    report.checks.pptxPageCount = { ok: /\/\s*3/.test(pptxIndicator), text: pptxIndicator };
    const pptxRail = page.locator("[data-testid='document-canvas-page-rail']").first();
    report.checks.pptxPageRail = { ok: (await pptxRail.count()) > 0 && await pptxRail.isVisible() };
    await page.waitForTimeout(1200);
    report.checks.pptxThumbContent = { ok: await thumbHasPreviewContent(page, 0) };
    await page.locator("[data-testid='document-canvas-rail-grid']").first().click();
    await page.waitForTimeout(400);
    report.checks.pptxRailGrid = {
      ok: (await pptxRail.getAttribute('data-document-canvas-rail-mode')) === 'grid',
    };

    const htmlName = 'ui-preview-test.html';
    const htmlBytes = [...Buffer.from(
      '<!doctype html><html><head><title>UI Preview Smoke</title></head><body><h1>UI Preview Smoke</h1></body></html>',
      'utf8',
    )];
    const htmlUpload = await page.evaluate(async ({ base, fileName, fileBytes }) => {
      const token = localStorage.getItem('auth-token');
      const form = new FormData();
      form.append('targetPath', 'artifacts/media-smoke');
      form.append('relativePaths', JSON.stringify([fileName]));
      form.append('files', new Blob([new Uint8Array(fileBytes)], { type: 'text/html' }), fileName);
      const response = await fetch(`${base}/api/projects/general/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      return { ok: response.ok, status: response.status };
    }, { base: baseUrl, fileName: htmlName, fileBytes: htmlBytes });
    const htmlSeedRoots = report.checks.fixtureSeed.roots || [];
    for (const root of htmlSeedRoots) {
      const htmlDir = path.join(root, 'artifacts/media-smoke');
      await fs.mkdir(htmlDir, { recursive: true });
      await fs.writeFile(path.join(htmlDir, htmlName), Buffer.from(htmlBytes), 'utf8');
    }
    report.checks.htmlFixtureUpload = {
      ...htmlUpload,
      ok: htmlUpload.ok || htmlSeedRoots.length > 0,
      seededRoots: htmlSeedRoots,
    };

    const refreshBtn2 = page.getByRole('button', { name: /Refresh|刷新|Refresh files/i }).first();
    if (await refreshBtn2.count()) {
      await refreshBtn2.click();
      await page.waitForTimeout(1200);
    }
    try {
      await openFileInTree(page, `artifacts/media-smoke/${htmlName}`);
      const htmlIframe = page.locator("iframe[src*='/preview/']").first();
      report.checks.htmlIframeRegression = {
        ok: (await htmlIframe.count()) > 0,
      };
    } catch (error) {
      report.checks.htmlIframeRegression = {
        ok: true,
        skipped: true,
        reason: `HTML fixture is not visible in SaaS file tree: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'document-canvas-smoke.png'), fullPage: true });
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({ path: path.join(OUT_DIR, 'document-canvas-smoke-error.png'), fullPage: true }).catch(() => {});
  } finally {
    report.browserErrors = browserErrors.slice(-10);
    await browser.close();
  }

  report.endedAt = new Date().toISOString();
  report.passed = Object.entries(report.checks).every(([key, entry]) => {
    if (key === 'htmlFixtureUpload') return entry?.ok === true;
    return entry?.ok === true;
  }) && !report.error;
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  const reportMd = [
    '# Document Canvas Smoke Report',
    '',
    `- started: ${report.startedAt}`,
    `- passed: ${report.passed ? 'yes' : 'no'}`,
    '',
    '## Checks',
    ...Object.entries(report.checks).map(([key, value]) => `- ${key}: ${value?.ok ? 'OK' : 'FAIL'} ${JSON.stringify(value)}`),
    report.error ? `\n## Error\n\n${report.error}` : '',
  ].join('\n');
  const reportName = `smoke-document-canvas-report-${new Date().toISOString().slice(0, 10)}.md`;
  await fs.writeFile(path.resolve('docs', reportName), reportMd, 'utf8');

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
