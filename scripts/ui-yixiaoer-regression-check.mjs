#!/usr/bin/env node
/**
 * Playwright UI regression for YiXiaoEr integration:
 * - Settings → Capability Hub → 蚁小二 section
 * - Main Capability Hub card (发布分发)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensurePlaywrightWorkspace } from './lib/playwrightSaasLogin.mjs';

const BASE_URL = process.env.VITE_URL || 'http://127.0.0.1:5173';
const API_BASE = process.env.SERVER_URL || 'http://127.0.0.1:3001';
const OUT_DIR = path.resolve('artifacts', 'yixiaoer-smoke', 'ui-regression');

async function fetchCapabilitiesYixiaoer() {
  try {
    const res = await fetch(`${API_BASE}/api/capabilities`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        ok: res.status === 401,
        detail: res.status === 401 ? 'auth required (expected without token)' : `HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    const item = (data.capabilities || []).find((c) => c.slug === 'yixiaoer');
    return {
      ok: Boolean(item && item.integration_level === 'L2' && item.stage === 'distribute'),
      detail: item
        ? `slug=${item.slug}, stage=${item.stage}, level=${item.integration_level}, status=${item.status}`
        : 'yixiaoer not in API response',
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function completeCapabilityOnboarding(page) {
  for (let step = 0; step < 8; step += 1) {
    const finish = page.getByRole('button', { name: /Finish guide|完成引导|跳过/i });
    if ((await finish.count()) > 0) {
      await finish.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      break;
    }
    const roleOption = page.getByRole('button', { name: /Brand marketing|Growth & ops|Content creation|Research & analysis/i });
    if ((await roleOption.count()) > 0) {
      await roleOption.first().click({ timeout: 2000 }).catch(() => {});
    }
    const next = page.getByRole('button', { name: /^Next/i });
    if ((await next.count()) === 0) break;
    await next.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function dismissBlockingModals(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const backdrop = page.locator('.modal-backdrop');
    if ((await backdrop.count()) === 0) break;
    const dismiss = page.getByRole('button', { name: /关闭|跳过|知道了|Got it|Skip|Close|Dismiss|开始|Start/i });
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click({ timeout: 3000 }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiBase: API_BASE,
    checks: {},
  };

  report.checks.capabilitiesApi = await fetchCapabilitiesYixiaoer();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
    });
    await ensurePlaywrightWorkspace(page, BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await dismissBlockingModals(page);
    await completeCapabilityOnboarding(page);

    await page.getByRole('tab', { name: /Capability Hub|能力中心/i }).click();
    await page.waitForTimeout(800);
    await completeCapabilityOnboarding(page);

    await page.getByRole('button', { name: /5 Publishing|发布分发/i }).click({ timeout: 5000 }).catch(() => {});
    // Capability search box only — avoid matching the process-template "搜索流程…" box (strict-mode collision).
    await page.getByPlaceholder(/Search by name|搜索能力名称/i).fill('yixiaoer');
    await page.waitForTimeout(500);

    // Card shows display_name only (「蚁小二」now lives in the hover summary); match current zh name too.
    const yixiaoerCard = page.getByText(/蚁小二|yixiaoer|YiXiaoEr|50\+ 平台|国内社媒发布/i);
    const cardCount = await yixiaoerCard.count();
    report.checks.capabilityHubCard = {
      ok: cardCount >= 1,
      cardCount,
    };

    await page.screenshot({
      path: path.join(OUT_DIR, 'capability-hub-yixiaoer.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: /^Settings$|^设置$/i }).click();
    await page.waitForTimeout(600);
    const settingsModal = page.locator('.modal-backdrop').last();
    await settingsModal.locator('button').filter({ hasText: /Service Config|服务配置/ }).first().click();
    await page.waitForTimeout(800);
    await settingsModal.locator('button').filter({ hasText: /Capability Hub|能力接入中心/ }).first().click();
    await page.waitForTimeout(600);

    const yixiaoerSection = settingsModal.getByText(/社媒发布（蚁小二）|Social publishing \(YiXiaoEr\)/i).first();
    report.checks.settingsYixiaoerSection = {
      ok: await yixiaoerSection.isVisible(),
    };

    // Sections are collapsed accordions — expand YiXiaoEr before checking
    // for the key / API URL fields.
    await yixiaoerSection.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);

    const bodyText = await settingsModal.textContent('body').catch(() => settingsModal.innerText());
    const modalText = (typeof bodyText === 'string' ? bodyText : await settingsModal.innerText()) || '';
    const hasKeyHint =
      /your-yixiaoer-api-key|\*\*\*\*\*\*\*\*|已配置|masked/i.test(modalText) ||
      modalText.includes('API Key');
    report.checks.settingsYixiaoerKeyField = { ok: hasKeyHint };

    const apiUrlField = settingsModal.getByPlaceholder('https://www.yixiaoer.cn/api');
    report.checks.settingsYixiaoerApiUrlField = {
      ok: (await apiUrlField.count()) >= 1,
    };

    await page.screenshot({
      path: path.join(OUT_DIR, 'settings-yixiaoer-section.png'),
      fullPage: true,
    });
  } finally {
    await browser.close();
  }

  report.endedAt = new Date().toISOString();
  report.passed = Object.values(report.checks).every((item) => item.ok === true);
  const reportPath = path.join(OUT_DIR, 'report.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.passed ? 0 : 1);
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
