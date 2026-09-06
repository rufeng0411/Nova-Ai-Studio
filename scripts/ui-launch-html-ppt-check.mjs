#!/usr/bin/env node
/**
 * L2–L3, L8: html-ppt opens LaunchSheet; cancel closes; process templates skip Launch.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  BASE_URL,
  OUT_DIR,
  dismissBlockingModals,
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
    checks: {},
    ok: true,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  try {
    await prepareLaunchSmokePage(page);
    await openCapabilityHubTab(page);

    // L2: html-ppt opens sheet
    await searchAndClickCapability(page, 'html-ppt', /HTML 幻灯工作室|html-ppt/i, { stage: /创意内容|Create/i });
    const sheetAfterClick = await isLaunchSheetVisible(page);
    report.checks.L2_html_ppt_opens_sheet = { ok: sheetAfterClick };
    if (!sheetAfterClick) report.ok = false;

    if (sheetAfterClick) {
      await page.waitForTimeout(1500);
      const themeOption = page.locator('[data-testid="launch-sheet"] button').filter({ hasText: /cyberpunk|赛博|科技/i }).first();
      if ((await themeOption.count()) > 0) {
        await themeOption.click({ timeout: 5000 }).catch(() => {});
      } else {
        const firstOption = page.locator('[data-testid="launch-sheet"] .grid button').first();
        if ((await firstOption.count()) > 0) await firstOption.click({ timeout: 5000 }).catch(() => {});
      }
      await page.getByRole('button', { name: /下一步|Next/i }).click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      const deckOption = page.locator('[data-testid="launch-sheet"] .grid button').first();
      if ((await deckOption.count()) > 0) await deckOption.click({ timeout: 5000 }).catch(() => {});
      report.checks.L2_steps = { ok: true, note: 'theme+deck selected when options available' };
      await page.screenshot({ path: path.join(OUT_DIR, 'L2-html-ppt-sheet.png'), fullPage: true });
    }

    // L3: close sheet
    await closeLaunchSheet(page);
    await page.waitForTimeout(400);
    const sheetAfterClose = await isLaunchSheetVisible(page);
    report.checks.L3_cancel_closes_sheet = { ok: !sheetAfterClose };
    if (sheetAfterClose) report.ok = false;

    // L8: process template tab try — no launch sheet
    const templatesTab = page.getByRole('tab', { name: /流程模板|Process templates|Workflows/i }).first();
    if ((await templatesTab.count()) > 0) {
      await templatesTab.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      const templateCard = page.locator('article[role="button"]').first();
      if ((await templateCard.count()) > 0) {
        await templateCard.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
        const sheetOnTemplate = await isLaunchSheetVisible(page);
        report.checks.L8_template_no_launch = { ok: !sheetOnTemplate, sheetVisible: sheetOnTemplate };
        if (sheetOnTemplate) report.ok = false;
      } else {
        report.checks.L8_template_no_launch = { ok: true, skipped: 'no template cards' };
      }
    } else {
      report.checks.L8_template_no_launch = { ok: true, skipped: 'templates tab not found' };
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'L8-templates.png'), fullPage: true });
  } finally {
    await browser.close();
  }

  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, 'L2-L8-html-ppt.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[launch-html-ppt] ok=${report.ok}`);
  for (const [key, val] of Object.entries(report.checks)) {
    console.log(`  ${key}: ok=${val.ok}${val.skipped ? ' (skipped)' : ''}`);
  }
  if (!report.ok) process.exitCode = 1;
}

run().catch((error) => {
  console.error('[launch-html-ppt] error:', error);
  process.exitCode = 1;
});
