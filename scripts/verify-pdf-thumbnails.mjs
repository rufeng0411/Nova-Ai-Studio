import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const BASE = process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:5173';
const FIXTURE_DIR = path.resolve('artifacts/media-smoke/document-canvas');
const TARGET_REL = 'artifacts/media-smoke/document-canvas';

function projectArtifactCandidates(relativePath) {
  const repoRoot = path.resolve('.saas-dev-data/tenants/tenant-admin/projects/general');
  return [
    path.resolve(relativePath),
    path.join(os.homedir(), '.pilotdeck', relativePath),
    path.join(repoRoot, relativePath),
    path.join(os.homedir(), 'Documents', 'general', relativePath),
  ];
}

async function seedFixturesToDisk() {
  for (const destDir of projectArtifactCandidates(TARGET_REL)) {
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(path.join(FIXTURE_DIR, 'sample-2p.pdf'), path.join(destDir, 'sample-2p.pdf'));
  }
}

async function seedVisibleProjectRoots(page) {
  const payload = await page.evaluate(async (base) => {
    const token = localStorage.getItem('auth-token');
    const response = await fetch(`${base}/api/projects`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return { ok: false, status: response.status };
    return response.json();
  }, BASE);
  const entries = Array.isArray(payload) ? payload : payload?.projects || payload?.data || [];
  const roots = new Set();
  for (const entry of entries) {
    const name = String(entry?.name || entry?.id || entry?.projectName || '');
    if (name && name !== 'general') continue;
    for (const key of ['fullPath', 'path', 'projectPath', 'root', 'cwd', 'fileRoot']) {
      const value = entry?.[key];
      if (typeof value === 'string' && path.isAbsolute(value)) roots.add(value);
    }
  }
  for (const root of roots) {
    const destDir = path.join(root, TARGET_REL);
    await fs.mkdir(destDir, { recursive: true });
    await fs.copyFile(path.join(FIXTURE_DIR, 'sample-2p.pdf'), path.join(destDir, 'sample-2p.pdf'));
  }
  return roots.size > 0;
}

async function openFileInTree(page, relativePath) {
  const filesTab = page.getByRole('tab', { name: /文件|Files/i }).first();
  if (await filesTab.count()) {
    await filesTab.click();
    await page.waitForTimeout(800);
  }
  const refreshBtn = page.getByRole('button', { name: /Refresh|刷新|Refresh files/i }).first();
  if (await refreshBtn.count()) {
    await refreshBtn.click();
    await page.waitForTimeout(1200);
  }
  const segments = relativePath.split('/');
  const fileName = segments.at(-1);
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
  if (await previewToggle.count()) await previewToggle.click();
  await page.waitForTimeout(2000);
}

async function main() {
  await seedFixturesToDisk();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  await ensurePlaywrightWorkspace(page, BASE);
  await seedVisibleProjectRoots(page);
  await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);

  await openFileInTree(page, `${TARGET_REL}/sample-2p.pdf`);
  const rail = page.locator('[data-testid=document-canvas-page-rail]').first();
  await rail.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(5000);

  const thumbs = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('[data-testid^="document-canvas-thumb-frame-"]')];
    return frames.map((frame) => {
      const canvas = frame.querySelector('canvas');
      if (!canvas) return { hasCanvas: false };
      const rect = canvas.getBoundingClientRect();
      return {
        hasCanvas: true,
        cssW: rect.width,
        cssH: rect.height,
        bitmapW: canvas.width,
        bitmapH: canvas.height,
        styleW: canvas.style.width,
        styleH: canvas.style.height,
      };
    });
  });

  const ok = thumbs.length >= 2
    && thumbs.every((t) => t.hasCanvas && t.bitmapW > 0 && t.bitmapH > 0 && t.cssW > 8 && t.cssH > 8);
  console.log(JSON.stringify({ ok, thumbs }, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
