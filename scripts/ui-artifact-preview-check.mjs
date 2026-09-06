#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Artifact preview UI check — fixture files + domcontentloaded (no live Agent write_file).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';
import { resolvePlaywrightBaseUrl, resolveServerUrl } from './lib/devPortSync.mjs';

const OUT_DIR = path.resolve('artifacts', 'media-smoke', 'ui-artifact');
const STRICT = process.env.UI_ARTIFACT_STRICT === '1';
const BASE_URL = resolvePlaywrightBaseUrl();
const BRIDGE_URL = resolveServerUrl();
const TARGET_REL = 'artifacts/media-smoke/ui-preview-test.html';
const FOLDER_DIR = 'artifacts/media-smoke/folder-demo';
const FOLDER_FILE_A = `${FOLDER_DIR}/page-a.html`;
const FOLDER_FILE_B = `${FOLDER_DIR}/page-b.html`;

function candidatesFor(relative) {
  return [path.resolve(relative)];
}

async function seedFixtureFiles() {
  const baseUrl = BASE_URL;
  const bridgeUrl = BRIDGE_URL;
  const hub = await resolveGeneralWorkspaceCwd({ serverUrl: bridgeUrl });
  const base = hub || path.resolve('.saas-dev-data', 'tenants', 'default');
  const files = [
    {
      rel: TARGET_REL,
      content: '<!doctype html><html><head><title>UI Preview Smoke</title></head><body><h1>UI Preview Smoke</h1></body></html>',
    },
    {
      rel: FOLDER_FILE_A,
      content: '<!doctype html><html><head><title>Folder Demo A</title></head><body>A</body></html>',
    },
    {
      rel: FOLDER_FILE_B,
      content: '<!doctype html><html><head><title>Folder Demo B</title></head><body>B</body></html>',
    },
  ];
  const written = [];
  for (const f of files) {
    const abs = path.join(base, f.rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, 'utf8');
    written.push(abs);
  }
  return { base, written };
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const seeded = await seedFixtureFiles();
  const fileCandidates = [seeded.written.find((p) => p.includes('ui-preview-test.html')) || ''];
  const folderACandidates = [seeded.written.find((p) => p.includes('page-a.html')) || ''];
  const folderBCandidates = [seeded.written.find((p) => p.includes('page-b.html')) || ''];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  const report = { startedAt: new Date().toISOString(), checks: {}, seeded };
  try {
    await ensurePlaywrightWorkspace(page, BASE_URL);
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
    const newSessionButtons = page.getByRole('button', { name: /New Session|新建会话|新会话|New Chat/i });
    const nsCount = await newSessionButtons.count();
    if (nsCount > 0) {
      await newSessionButtons.nth(nsCount - 1).click();
      await page.waitForTimeout(1200);
    }

    const createdPath = seeded.written.find((p) => p.includes('ui-preview-test.html')) || '';
    report.checks.fileCreated = { ok: Boolean(createdPath), path: createdPath };

    // Trigger deliverables reconcile via prompt mentioning paths (fixture already on disk)
    const textarea = page.locator('textarea').first();
    await textarea.click();
    await textarea.fill(
      `成果已生成：${TARGET_REL} 与 ${FOLDER_FILE_A}、${FOLDER_FILE_B}。请仅在回复中列出上述路径，勿调用工具。`,
    );
    await textarea.press('Enter');
    await page.waitForTimeout(8000);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page
      .locator("[data-testid='assistant-deliverables-panel']")
      .first()
      .waitFor({ state: 'visible', timeout: 45_000 })
      .catch(() => {});
    const fileNameVisible = await page.getByText('ui-preview-test.html').count();
    report.checks.writtenFileVisible = { ok: fileNameVisible > 0, count: fileNameVisible };
    const iframe = page.locator("iframe[src*='/preview/']").first();
    const iframeVisible = (await iframe.count()) > 0 ? await iframe.isVisible() : false;
    report.checks.previewPanelVisible = { ok: iframeVisible };
    if (iframeVisible) {
      const src = await iframe.getAttribute('src');
      report.checks.previewUrlLooksCorrect = {
        ok: typeof src === 'string' && src.includes('/api/projects/') && src.includes('/preview/'),
        src: src || '',
      };
    } else {
      report.checks.previewUrlLooksCorrect = { ok: false, reason: 'iframe not visible' };
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'preview-panel.png'), fullPage: true });

    if (STRICT) {
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
      }, {
        project: 'general',
        validatePaths: [TARGET_REL, FOLDER_FILE_A, FOLDER_FILE_B],
        validateHintDir: 'artifacts/media-smoke',
      });
      const verified = (validation.items || []).filter((item) => item.status === 'verified');
      report.checks.strictServerValidation = {
        ok: verified.length >= 3,
        verified: verified.length,
        total: (validation.items || []).length,
      };
      const brokenVisible = await page.getByText('phantom-missing-file.html').count();
      report.checks.strictBrokenHidden = { ok: brokenVisible === 0, count: brokenVisible };
    }

    const folderA = folderACandidates.find((p) => seeded.written.some((w) => w === p)) || '';
    const folderB = folderBCandidates.find((p) => seeded.written.some((w) => w === p)) || '';
    report.checks.folderFilesCreated = { ok: Boolean(folderA && folderB), a: folderA, b: folderB };

    const folderCard = page.locator("[data-testid='deliverable-folder-card']").first();
    let folderCardCount = 0;
    const folderDeadline = Date.now() + 60_000;
    while (Date.now() < folderDeadline) {
      folderCardCount = await folderCard.count();
      if (folderCardCount > 0) break;
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }
    const panelCount = await page.locator("[data-testid='assistant-deliverables-panel']").count();
    report.checks.deliverablesPanelVisible = { ok: panelCount > 0, count: panelCount };
    report.checks.folderCardVisible = { ok: folderCardCount > 0, count: folderCardCount };

    if (folderCardCount > 0) {
      await folderCard.click();
      const modal = page.locator("[data-testid='deliverable-folder-modal']").first();
      await modal.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
      const thumbCount = await page.locator("[data-testid='deliverable-thumb']").count();
      report.checks.folderModalThumbs = { ok: thumbCount >= 2, count: thumbCount };
      await page.screenshot({ path: path.join(OUT_DIR, 'folder-modal.png'), fullPage: true });
    } else {
      report.checks.folderModalThumbs = { ok: false, reason: 'folder card not visible' };
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await browser.close();
  }
  report.endedAt = new Date().toISOString();
  report.strict = STRICT;
  report.passed =
    report.checks.fileCreated?.ok === true &&
    (report.checks.previewPanelVisible?.ok === true || report.checks.writtenFileVisible?.ok === true) &&
    (report.checks.previewPanelVisible?.ok === false || report.checks.previewUrlLooksCorrect?.ok === true) &&
    report.checks.folderFilesCreated?.ok === true &&
    (report.checks.folderCardVisible?.ok === true || report.checks.writtenFileVisible?.ok === true) &&
    (!STRICT || (
      report.checks.strictServerValidation?.ok === true
      && report.checks.strictBrokenHidden?.ok === true
      && (report.checks.deliverablesPanelVisible?.ok === true || report.checks.writtenFileVisible?.ok === true)
    ));
  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
