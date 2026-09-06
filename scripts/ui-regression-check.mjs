#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { ensurePlaywrightWorkspace } from "./lib/playwrightSaasLogin.mjs";
import { resolvePlaywrightBaseUrl } from "./lib/devPortSync.mjs";

const OUT_DIR = path.resolve("artifacts", "media-smoke", "ui-regression");
const BASE_URL = resolvePlaywrightBaseUrl();

function textHasApiKeyHint(text) {
  return /api\s*key|请先填写\s*api/i.test(text || "");
}

async function preparePage(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("pilotdeck-capability-onboarding-done", "1");
  });
  await ensurePlaywrightWorkspace(page, BASE_URL);
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  const newChatBtn = page.getByRole("button", { name: /New Chat|新建对话|新对话/i }).first();
  if (await newChatBtn.isVisible().catch(() => false)) {
    await newChatBtn.click({ timeout: 10_000 });
  } else {
    const newSessionBtn = page.getByRole("button", { name: /New Session|新建会话|新会话/i }).first();
    await newSessionBtn.click({ timeout: 10_000 }).catch(() => {});
  }
  await page.waitForTimeout(1500);
  await page
    .locator("button.rounded-full")
    .filter({ hasText: /官网|海报|onboarding|宣传|视频|landing|SaaS/i })
    .first()
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
}

async function openProviderHubSection(page) {
  await page.evaluate(() => {
    if (typeof window.openSettings === "function") {
      window.openSettings("config");
    }
  });
  await page.waitForTimeout(800);
  const hubNav = page.getByRole("button", { name: /能力接入中心|Capability Hub/i }).first();
  await hubNav.waitFor({ state: "visible", timeout: 15_000 });
  await hubNav.click({ timeout: 15_000 });
  await page.getByText(/图片能力|generate_image|Image/i).first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(300);
  // Sections are collapsed accordions now — expand image & video so the
  // "拉取模型列表" buttons are in the DOM before counting them.
  const imageHeader = page.getByRole("button", { name: /generate_image|图片能力/i }).first();
  const videoHeader = page.getByRole("button", { name: /generate_video|视频能力/i }).first();
  if (await imageHeader.count()) await imageHeader.click().catch(() => {});
  if (await videoHeader.count()) await videoHeader.click().catch(() => {});
  await page.waitForTimeout(500);
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    checks: {},
  };

  try {
    await preparePage(page);

    const chipLocator = page
      .locator("button.rounded-full")
      .filter({ hasNotText: /流程模板|探索全部|Capability Hub|能力中心/i });
    const chipCount = await chipLocator.count();
    report.checks.welcomeChips = { ok: chipCount >= 5, chipCount };
    if (chipCount > 0) {
      await chipLocator.first().click();
      const textarea = page.locator("textarea").first();
      const value = await textarea.inputValue();
      report.checks.chipFillComposer = { ok: value.length > 0, valueSample: value.slice(0, 60) };
    } else {
      report.checks.chipFillComposer = { ok: false, reason: "no chip found" };
    }

    await openProviderHubSection(page);

    const hubHeader = page.getByText(/Capability Hub|能力接入中心/).first();
    report.checks.providerHubVisible = { ok: await hubHeader.isVisible() };

    const fetchButtons = page.getByRole("button", { name: /拉取模型列表|Fetch model list/i });
    const fetchCount = await fetchButtons.count();
    report.checks.providerHubFetchButtons = { ok: fetchCount >= 2, fetchCount };

    if (fetchCount > 0) {
      await fetchButtons.first().click();
      await page.waitForTimeout(500);
      const hubBody = await page.textContent("body");
      report.checks.providerHubApiKeyHint = {
        ok: textHasApiKeyHint(hubBody),
      };
    } else {
      report.checks.providerHubApiKeyHint = { ok: false, reason: "no fetch button" };
    }

    await page.screenshot({
      path: path.join(OUT_DIR, "settings-provider-hub.png"),
      fullPage: true,
    });
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    await page.screenshot({
      path: path.join(OUT_DIR, "failure.png"),
      fullPage: true,
    }).catch(() => {});
  } finally {
    await browser.close();
  }

  report.endedAt = new Date().toISOString();
  const hubOk =
    report.checks.providerHubVisible?.ok &&
    report.checks.providerHubFetchButtons?.ok &&
    report.checks.providerHubApiKeyHint?.ok;
  const welcomeOk = report.checks.welcomeChips?.ok && report.checks.chipFillComposer?.ok;
  report.hubPassed = hubOk;
  report.welcomePassed = welcomeOk;
  report.passed = !report.error && hubOk;
  if (!welcomeOk) {
    report.checks.welcomeChips = { ...report.checks.welcomeChips, note: "SKIP if active session blocks empty welcome" };
  }
  const reportPath = path.join(OUT_DIR, "report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
