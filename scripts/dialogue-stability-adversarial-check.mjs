#!/usr/bin/env node
/**
 * PD-SAAS-FORK: adversarial final review checks for dialogue stability.
 *
 * This script intentionally checks failure paths:
 * - broken deliverables must trigger final acceptance repair
 * - storyboard packs must require the three core files
 * - engine technical hard-stops must not leak as raw user-facing text
 * - the live UI must boot through the real browser without raw recovery leaks
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';
import { resolvePlaywrightBaseUrl } from './lib/devPortSync.mjs';
import { validateEngineDeliverables } from '../src/agent/deliverables/validateDeliverablesEngine.ts';
import {
  DEFAULT_ERROR_LABELS_ZH,
  formatUserFacingNotice,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  userGoalImpliesDeliverable,
} from '../src/agent/errors/userFacingErrors.ts';
import { resolveContinuationAction } from '../src/saas/taskContinuationPolicy.ts';

const OUT_DIR = path.resolve('artifacts', 'dialogue-stability-final-review');
const BASE_URL = resolvePlaywrightBaseUrl();

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function checkBrokenHtmlAcceptance() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-bad-html-'));
  await fs.mkdir(path.join(cwd, 'artifacts'), { recursive: true });
  await fs.writeFile(
    path.join(cwd, 'artifacts', 'broken.html'),
    '<<<html><body>placeholder</body></html>',
    'utf8',
  );
  const result = await validateEngineDeliverables({
    cwd,
    userGoal: '做官网落地页网页并报路径',
    messages: [{
      role: 'assistant',
      content: [{ type: 'text', text: '已完成 artifacts/broken.html' }],
    }],
  });
  return {
    ok: result?.acceptance === 'needs_repair'
      && (result.broken.some((p) => p.includes('broken.html'))
        || result.failures.some((f) => f.reason === 'invalid_html')),
    result,
  };
}

async function checkStoryboardMissingGate() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-storyboard-missing-'));
  await fs.mkdir(path.join(cwd, 'artifacts', 'storyboard'), { recursive: true });
  await fs.writeFile(
    path.join(cwd, 'artifacts', 'storyboard', 'continuity_bible.md'),
    '# Continuity Bible\n',
    'utf8',
  );
  const goal = '用「连续性分镜包」输出 bible、镜头卡、交接矩阵';
  const result = await validateEngineDeliverables({
    cwd,
    userGoal: goal,
    capabilitySlug: 'create-vid-storyboard-pack',
    messages: [{
      role: 'assistant',
      content: [{ type: 'text', text: '已保存 artifacts/storyboard/continuity_bible.md' }],
    }],
  });
  return {
    ok: result?.acceptance === 'needs_repair'
      && result.missing.some((p) => p.includes('shot_cards.md'))
      && result.missing.some((p) => p.includes('handoff_design_matrix.md')),
    result,
  };
}

function checkRawHardStopMasking() {
  const notice = formatUserFacingNotice({
    code: 'agent_tool_error_loop',
    raw: 'Repeated invalid tool input after recovery attempts.',
    exhausted: true,
  }, DEFAULT_ERROR_LABELS_ZH);
  return {
    ok: notice.summary === DEFAULT_ERROR_LABELS_ZH.unifiedExhausted
      && notice.technicalDetail === null
      && !/Repeated invalid|Large file repair/i.test(JSON.stringify(notice)),
    notice,
  };
}

function checkContinuationPolicy() {
  const userGoal = '用「连续性分镜包」输出 bible、镜头卡、交接矩阵';
  const action = resolveContinuationAction({
    userGoal,
    assistantText: '已完成 continuity_bible.md',
    validationResult: {
      verified: ['artifacts/storyboard/continuity_bible.md'],
      missing: ['artifacts/**/shot_cards.md'],
      broken: [],
    },
    autoRecoveryContinueEnabled: true,
    directStartRequested: true,
  });
  const planningStop = shouldAutoContinueAfterIncompleteDeliverableStop(
    '好的，我先读取已有的文件，然后逐个补充完整。',
    { userGoalText: userGoal, hadRecentToolSuccess: true },
  );
  return {
    ok: userGoalImpliesDeliverable(userGoal)
      && action === 'deliverable_repair'
      && planningStop === true,
    action,
    planningStop,
  };
}

async function checkLivePlaywright() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.url()} ${req.failure()?.errorText || ''}`);
  });
  try {
    await ensurePlaywrightWorkspace(page, BASE_URL);
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
    const composerCount = await page.locator('textarea').count();
    const rootLen = await page.locator('#root').innerHTML().then((s) => s.length).catch(() => 0);
    await page.screenshot({
      path: path.join(OUT_DIR, 'playwright-live-ui.png'),
      fullPage: true,
    });
    const rawLeak = /Large file repair|Repeated invalid tool input|fetch failed\s*$/im.test(bodyText);
    const blockingConsoleErrors = consoleErrors.filter((error) =>
      /change in the order of Hooks|Internal React error|Expected static flag/i.test(error),
    );
    return {
      ok: rootLen > 500 && composerCount > 0 && !rawLeak && blockingConsoleErrors.length === 0,
      url: page.url(),
      rootLen,
      composerCount,
      rawLeak,
      blockingConsoleErrors,
      consoleErrors: consoleErrors.slice(0, 10),
      failedRequests: failedRequests.slice(0, 10),
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  await ensureOutDir();
  const checks = {
    brokenHtmlAcceptance: await checkBrokenHtmlAcceptance(),
    storyboardMissingGate: await checkStoryboardMissingGate(),
    rawHardStopMasking: checkRawHardStopMasking(),
    continuationPolicy: checkContinuationPolicy(),
    livePlaywright: await checkLivePlaywright(),
  };
  const report = {
    at: new Date().toISOString(),
    checks,
    passed: Object.values(checks).every((check) => check.ok === true),
  };
  const reportPath = path.join(OUT_DIR, 'adversarial-check-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
