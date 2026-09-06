#!/usr/bin/env node
/**
 * PD-SAAS-FORK: live UI check for root-level React/Remotion video template deliverables.
 *
 * Covers the regression where ai-video-template/* files were created correctly
 * but all preview cards were hidden and "open task folder" surfaced fetch failed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';

const OUT_DIR = path.resolve('artifacts', 'media-smoke', 'video-template-deliverable');
const TEST_DIR = `ai-video-template-live-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}`;
const FILES = [
  {
    rel: `${TEST_DIR}/package.json`,
    content: `${JSON.stringify({ scripts: { start: 'remotion studio', render: 'remotion render' } }, null, 2)}\n`,
  },
  {
    rel: `${TEST_DIR}/Root.tsx`,
    content: 'export const RemotionRoot = () => null;\n',
  },
  {
    rel: `${TEST_DIR}/src/AiVideoTemplate.tsx`,
    content: 'export function AiVideoTemplate(){ return null; }\n',
  },
  {
    rel: `${TEST_DIR}/batch-render.js`,
    content: 'export const variants = [{ title: "AI 用途", value: 42 }];\n',
  },
  {
    rel: `${TEST_DIR}/demo-preview.html`,
    content: '<!doctype html><html><head><title>AI Video Template Preview</title></head><body><main><h1>AI Video Template</h1><section>42</section></main></body></html>',
  },
];

async function seedFixtureFiles() {
  const bridgeUrl = process.env.SERVER_URL || 'http://127.0.0.1:3001';
  const hub = await resolveGeneralWorkspaceCwd({ serverUrl: bridgeUrl });
  if (!hub) throw new Error('无法解析 general 云端工作区目录');
  const written = [];
  for (const file of FILES) {
    const abs = path.join(hub, file.rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.content, 'utf8');
    written.push(abs);
  }
  return { hub, written };
}

async function serverProbe(page) {
  return page.evaluate(async ({ testDir, paths }) => {
    const token = localStorage.getItem('auth-token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const validateRes = await fetch('/api/projects/general/deliverables/validate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ paths, hintDir: testDir }),
    });
    const validateJson = await validateRes.json();
    const resolveRes = await fetch(`/api/projects/general/file/resolve?filePath=${encodeURIComponent(`${testDir}/demo-preview.html`)}&hintDir=${encodeURIComponent(testDir)}`, {
      headers,
    });
    const resolveJson = await resolveRes.json();
    return {
      validateStatus: validateRes.status,
      validate: validateJson,
      resolveStatus: resolveRes.status,
      resolve: resolveJson,
    };
  }, {
    testDir: TEST_DIR,
    paths: FILES.map((file) => file.rel),
  });
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const seeded = await seedFixtureFiles();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  const report = {
    startedAt: new Date().toISOString(),
    testDir: TEST_DIR,
    seeded,
    checks: {},
    network: {
      deliverableValidate: [],
    },
  };

  try {
    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/deliverables/validate')) return;
      try {
        report.network.deliverableValidate.push({
          status: response.status(),
          url,
          body: await response.json(),
        });
      } catch (error) {
        report.network.deliverableValidate.push({
          status: response.status(),
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    const baseUrl = process.env.VITE_URL || 'http://127.0.0.1:5173';
    await ensurePlaywrightWorkspace(page, baseUrl);
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});

    report.serverProbe = await serverProbe(page);
    const validationItems = report.serverProbe.validate?.items ?? [];
    const verified = validationItems.filter((item) => item.status === 'verified');
    report.checks.serverValidatesAllTemplateFiles = {
      ok: verified.length === FILES.length,
      verified: verified.map((item) => item.resolvedPath || item.path),
      statuses: validationItems.map((item) => ({ path: item.path, status: item.status, resolvedPath: item.resolvedPath })),
    };
    report.checks.serverResolvePreview = {
      ok: report.serverProbe.resolveStatus === 200
        && report.serverProbe.resolve?.ok === true
        && report.serverProbe.resolve?.relativePath === `${TEST_DIR}/demo-preview.html`,
      response: report.serverProbe.resolve,
    };

    const newSessionButtons = page.getByRole('button', { name: /New Session|新建会话|新会话|New Chat/i });
    const nsCount = await newSessionButtons.count();
    if (nsCount > 0) {
      await newSessionButtons.nth(nsCount - 1).click();
      await page.waitForTimeout(1200);
    }

    const textarea = page.locator('textarea').first();
    await textarea.click();
    await textarea.fill([
      '这是实机回归测试，请不要调用工具，只回复下面这些已存在的 React 程序化视频模板成果路径：',
      ...FILES.map((file) => file.rel),
    ].join('\n'));
    await textarea.press('Enter');

    await page
      .locator("[data-testid='assistant-deliverables-panel']")
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 })
      .catch(() => {});

    const panel = page.locator("[data-testid='assistant-deliverables-panel']").last();
    const panelCount = await page.locator("[data-testid='assistant-deliverables-panel']").count();
    const thumbCount = await page.locator("[data-testid='deliverable-thumb']").count();
    const previewNameCount = await page.getByText('demo-preview.html').count();
    const hiddenNoticeCount = await page.getByText(/部分成果.*隐藏|部分成果未能自动匹配预览路径|暂未通过打开校验/).count();
    report.checks.deliverablesPanelVisible = { ok: panelCount > 0, count: panelCount };
    report.checks.previewCardVisible = { ok: thumbCount > 0 && previewNameCount > 0, thumbCount, previewNameCount };
    report.checks.noHiddenDeliverableNotice = { ok: hiddenNoticeCount === 0, count: hiddenNoticeCount };

    if (panelCount > 0) {
      await panel.screenshot({ path: path.join(OUT_DIR, 'deliverables-panel.png') });
    }

    const openFolder = page.locator("[data-testid='open-task-folder']").last();
    const openFolderVisible = await openFolder.count().then((count) => count > 0);
    report.checks.openTaskFolderButtonVisible = { ok: openFolderVisible };
    if (openFolderVisible) {
      await openFolder.click();
      await page.waitForTimeout(2500);
      const fileTreeRows = await page.locator('[data-file-tree-path]').evaluateAll((rows) =>
        rows.map((row) => row.getAttribute('data-file-tree-path') || ''),
      ).catch(() => []);
      const matchedRows = fileTreeRows.filter((value) => value.replace(/\\/g, '/').includes(TEST_DIR));
      report.checks.openTaskFolderNavigatesFileTree = {
        ok: matchedRows.some((value) => value.replace(/\\/g, '/').includes('demo-preview.html')),
        matchedRows: matchedRows.slice(0, 12),
      };
      await page.screenshot({ path: path.join(OUT_DIR, 'file-tree-after-open-folder.png'), fullPage: true });
    } else {
      report.checks.openTaskFolderNavigatesFileTree = { ok: false, reason: 'open task folder button missing' };
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await browser.close();
  }

  report.endedAt = new Date().toISOString();
  report.passed = [
    report.checks.serverValidatesAllTemplateFiles,
    report.checks.serverResolvePreview,
    report.checks.deliverablesPanelVisible,
    report.checks.previewCardVisible,
    report.checks.noHiddenDeliverableNotice,
    report.checks.openTaskFolderButtonVisible,
    report.checks.openTaskFolderNavigatesFileTree,
  ].every((check) => check?.ok === true);

  await fs.writeFile(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
