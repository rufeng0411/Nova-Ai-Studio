#!/usr/bin/env node
/**
 * L1: non-registry Hub cards must not open LaunchSheet.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  BASE_URL,
  OUT_DIR,
  SKIP_HUB_CARDS,
  openCapabilityHubTab,
  prepareLaunchSmokePage,
  searchAndClickCapability,
  isLaunchSheetVisible,
  closeLaunchSheet,
} from './lib/uiLaunchSmokeHelpers.mjs';

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    check: 'L1-hub-isolation',
    results: [],
    ok: true,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  try {
    await prepareLaunchSmokePage(page);

    for (const item of SKIP_HUB_CARDS) {
      await openCapabilityHubTab(page);
      await searchAndClickCapability(page, item.search, item.title, item.nav);
      const sheetVisible = await isLaunchSheetVisible(page);
      const ok = !sheetVisible;
      report.results.push({ slug: item.slug, ok, sheetVisible });
      if (!ok) report.ok = false;
      if (sheetVisible) await closeLaunchSheet(page);
      await page.keyboard.press('Escape').catch(() => {});
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'L1-hub-isolation.png'), fullPage: true });
  } finally {
    await browser.close();
  }

  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'L1-hub-isolation.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[L1-hub-isolation] ok=${report.ok} checked=${report.results.length}`);
  if (!report.ok) {
    for (const row of report.results.filter((r) => !r.ok)) {
      console.error(`  FAIL ${row.slug}: launch-sheet visible=${row.sheetVisible}`);
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[L1-hub-isolation] error:', error);
  process.exitCode = 1;
});
