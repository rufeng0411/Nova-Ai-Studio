/**
 * PD-SAAS-FORK: shared Playwright helpers for Launch Sheet smoke tests.
 */
import { ensurePlaywrightWorkspace } from './playwrightSaasLogin.mjs';

export const BASE_URL = process.env.VITE_URL || 'http://127.0.0.1:5173';
export const OUT_DIR = 'artifacts/launch-smoke';

/** Slugs that must never open LaunchSheet (launch_mode skip). */
export const SKIP_HUB_CARDS = [
  { slug: 'open-design', search: 'open-design', title: /设计总控|Open Design/i, nav: { stage: /创意内容|Create/i } },
  { slug: 'anth-docx', search: 'anth-docx', title: /Word文档|Word doc/i, nav: { stage: /创意内容|Create/i } },
  { slug: 'social-creative-matrix', search: '社媒矩阵', title: /社媒矩阵/i, nav: { stage: /创意内容|Create/i } },
  { slug: 'yixiaoer', search: '国内社媒', title: /国内社媒发布|yixiaoer|YiXiaoEr/i, nav: { stage: /发布分发|Publish|Distribut/i } },
];

export async function prepareLaunchSmokePage(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('pilotdeck-capability-onboarding-done', '1');
  });
  await ensurePlaywrightWorkspace(page, BASE_URL);
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
  await dismissBlockingModals(page);
}

export async function dismissBlockingModals(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const backdrop = page.locator('.modal-backdrop');
    if ((await backdrop.count()) === 0) break;
    const dismiss = page.getByRole('button', {
      name: /关闭|跳过|知道了|Got it|Skip|Close|Dismiss|开始|Start|Finish guide|完成引导/i,
    });
    if ((await dismiss.count()) > 0) {
      await dismiss.first().click({ timeout: 3000 }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
}

export async function openCapabilityHubTab(page) {
  const discoverTab = page.getByRole('tab', { name: /Capability Hub|能力中心/i }).first();
  await discoverTab.click({ timeout: 15_000 });
  await page.waitForTimeout(1000);
  const innerCapTab = page.getByRole('tab', { name: /^能力中心$|^Capabilities$/i }).last();
  if (await innerCapTab.isVisible().catch(() => false)) {
    await innerCapTab.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.locator('input[type="search"]:visible').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('article[role="button"]').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
}

export async function clickFlywheelStage(page, stagePattern) {
  const stageBtn = page.getByRole('button', { name: stagePattern }).filter({ visible: true }).first();
  if (await stageBtn.isVisible().catch(() => false)) {
    await stageBtn.click({ timeout: 8000 });
    await page.waitForTimeout(600);
  }
}

export async function clickMajorCategory(page, majorPattern) {
  const majorBtn = page.getByRole('button', { name: majorPattern }).filter({ visible: true }).first();
  if (await majorBtn.isVisible().catch(() => false)) {
    await majorBtn.click({ timeout: 8000 });
    await page.waitForTimeout(600);
  }
}

export async function clickCategorySubtag(page, subtagPattern) {
  if (!subtagPattern) return;
  const pill = page.getByRole('button', { name: subtagPattern }).filter({ visible: true }).first();
  if (await pill.isVisible().catch(() => false)) {
    await pill.click({ timeout: 8000 });
    await page.waitForTimeout(600);
  }
}

export async function navigateHubNav(page, nav) {
  if (!nav) return;
  if (nav.major) await clickMajorCategory(page, nav.major);
  if (nav.stage) await clickFlywheelStage(page, nav.stage);
  if (nav.subtag) await clickCategorySubtag(page, nav.subtag);
}

export async function searchAndClickCapability(page, searchText, titlePattern, nav) {
  if (nav) await navigateHubNav(page, nav);
  const search = page.locator('input[type="search"]:visible').first();
  await search.scrollIntoViewIfNeeded();
  await search.fill(searchText);
  await page.waitForTimeout(800);
  const card = page.getByRole('button', { name: titlePattern }).filter({ visible: true }).first();
  await card.waitFor({ state: 'visible', timeout: 12_000 });
  await card.scrollIntoViewIfNeeded();
  await card.click({ timeout: 10_000 });
  await page.waitForTimeout(500);
}

export async function isLaunchSheetVisible(page) {
  return page.locator('[data-testid="launch-sheet"]').isVisible().catch(() => false);
}

export async function closeLaunchSheet(page) {
  const closeBtn = page.locator('[data-testid="launch-sheet"]').getByRole('button', { name: 'close' });
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(400);
  }
}
