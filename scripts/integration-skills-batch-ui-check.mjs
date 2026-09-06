#!/usr/bin/env node
/**
 * Playwright: verify batch-installed capabilities appear in Hub and prefill composer.
 * Requires dev stack at VITE_URL (default http://127.0.0.1:5173).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  BASE_URL,
  OUT_DIR,
  openCapabilityHubTab,
  prepareLaunchSmokePage,
  searchAndClickCapability,
  navigateHubNav,
} from './lib/uiLaunchSmokeHelpers.mjs';

const BATCH_HUB_CARDS = [
  { slug: 'web-just-scrape', search: '轻量网页', title: /轻量网页/i, nav: { stage: /调研|Research/i } },
  { slug: 'fc-firecrawl-cli', search: 'Firecrawl 联网', title: /Firecrawl 联网/i, nav: { stage: /调研|Research/i } },
  { slug: 'create-ui-ux-pro-max', search: 'UI/UX 专业', title: /UI\/UX 专业审查/i, nav: { major: /创作|Creation/i, subtag: /UI|界面/i } },
  { slug: 'edu-fun-caveman', search: '趣味 CLI', title: /趣味 CLI 学习/i, nav: { major: /教育|Education/i, subtag: /趣味/i } },
  { slug: 'legal-risk-assessment', search: '法务风险', title: /法务风险评估/i, nav: { major: /办公|Office/i, subtag: /法务/i } },
  { slug: 'mcp-playwright', search: '浏览器自动化', title: /浏览器自动化 MCP/i, nav: { major: /开发|Development/i, subtag: /测试|Test/i } },
  { slug: 'mkt-sales-enablement', search: '销售赋能', title: /销售赋能|Sales enablement/i, nav: { stage: /触达|Outreach|Activate/i, subtag: /销售赋能|Sales/i } },
];

async function composerHasTryPrompt(page) {
  const textarea = page.locator('textarea:visible').last();
  await textarea.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  const value = await textarea.inputValue().catch(() => '');
  return value.includes('用「') && value.length > 20;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    check: 'batch-hub-ui',
    results: [],
    ok: true,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  try {
    await prepareLaunchSmokePage(page);

    for (const item of BATCH_HUB_CARDS) {
      const row = { slug: item.slug, ok: true, issues: [] };
      try {
        await openCapabilityHubTab(page);
        await searchAndClickCapability(page, item.search, item.title, item.nav);
        const prefilled = await composerHasTryPrompt(page);
        row.prefilled = prefilled;
        if (!prefilled) row.issues.push('composer_not_prefilled');
      } catch (e) {
        row.ok = false;
        row.issues.push(e instanceof Error ? e.message : String(e));
      }
      if (row.issues.length) {
        row.ok = false;
        report.ok = false;
      }
      report.results.push(row);
      await page.keyboard.press('Escape').catch(() => {});
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'batch-hub-ui.png'), fullPage: true });
  } finally {
    await browser.close();
  }

  report.finishedAt = new Date().toISOString();
  const outPath = path.join(OUT_DIR, 'batch-hub-ui.json');
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[batch-hub-ui] ok=${report.ok} checked=${report.results.length}`);
  console.log(`[batch-hub-ui] report=${outPath}`);
  if (!report.ok) {
    for (const row of report.results.filter((r) => !r.ok)) {
      console.error(`  FAIL ${row.slug}: ${row.issues.join('; ')}`);
    }
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error('[batch-hub-ui] error:', e);
  process.exitCode = 1;
});
