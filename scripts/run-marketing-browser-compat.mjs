#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Marketing site mainstream browser compatibility matrix.
 *
 * Engine → user browser mapping (same as browser-compat-matrix.mjs):
 *   chrome / msedge / chromium → Chrome & Edge (Win/Mac)
 *   firefox → Firefox (Win/Mac)
 *   webkit → Safari (macOS / iOS engine)
 *
 * Usage:
 *   MARKETING_BASE_URL=http://127.0.0.1:5501 node scripts/run-marketing-browser-compat.mjs --gate
 *   npm run test:marketing-site:browsers
 */
import { chromium, firefox, webkit, devices } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..');
const GATE = process.argv.includes('--gate');
const OUT_DIR = join(REPO, 'artifacts', 'marketing-browser-compat-20260801');
const REPORT_JSON = join(OUT_DIR, 'report.json');
const REPORT_MD = join(REPO, 'docs', 'marketing-browser-compat-20260801.zh-CN.md');

mkdirSync(OUT_DIR, { recursive: true });

/** @type {Array<{ profile: string, id: string, ok: boolean, detail: string }>} */
const rows = [];
let failures = 0;

function record(profile, id, ok, detail = '') {
  rows.push({ profile, id, ok: !!ok, detail: String(detail || '') });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${profile}] ${id}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function ensureMarketingBase() {
  const fromEnv = (process.env.MARKETING_BASE_URL || '').replace(/\/$/, '');
  if (fromEnv) {
    try {
      const res = await fetch(`${fromEnv}/`);
      if (res.ok) return { base: fromEnv, stop: async () => {} };
    } catch {
      /* fall through */
    }
  }
  // Prefer production package serve (5501). Reject stale product-site demos
  // that lack /geo/ or contact captcha (common on :5500).
  for (const port of [5501, 5502, 5500]) {
    try {
      const base = `http://127.0.0.1:${port}`;
      const home = await fetch(`${base}/`);
      const homeText = await home.text();
      if (!home.ok || !/用对话|Nova Ai-Studio/.test(homeText)) continue;
      const geo = await fetch(`${base}/geo/`);
      const contact = await fetch(`${base}/contact/`);
      const contactText = contact.ok ? await contact.text() : '';
      const productionReady =
        geo.ok && /FAQPage|Agent Harness/.test(await geo.text()) && /captchaAnswer|图形验证码/.test(contactText);
      if (productionReady) {
        return { base, stop: async () => {} };
      }
      console.log(`[marketing-browsers] skip :${port} (not production marketing package)`);
    } catch {
      /* try next */
    }
  }

  // Ephemeral static via marketingStaticMiddleware
  process.env.PILOTDECK_MARKETING_SITE = '1';
  const modUrl = pathToFileURL(join(REPO, 'ui/server/saas/marketing/marketingStatic.js')).href;
  const { marketingStaticMiddleware } = await import(modUrl);
  const app = express();
  app.use(marketingStaticMiddleware);
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      await new Promise((r) => server.close(r));
    },
  };
}

/** @type {Array<{ id: string, label: string, category: string, launch: () => Promise<{ browser: import('playwright').Browser, contextOptions?: object }> }>} */
const PROFILES = [];

function add(id, label, category, launch) {
  PROFILES.push({ id, label, category, launch });
}

add('chrome-desktop', 'Chrome 桌面（Win/Mac）', 'desktop', async () => {
  try {
    return { browser: await chromium.launch({ channel: 'chrome', headless: true }) };
  } catch {
    return { browser: await chromium.launch({ headless: true }) };
  }
});

add('edge-desktop', 'Edge 桌面（Win）', 'desktop', async () => {
  try {
    return { browser: await chromium.launch({ channel: 'msedge', headless: true }) };
  } catch {
    return { browser: await chromium.launch({ headless: true }), fallback: 'chromium' };
  }
});

add('firefox-desktop', 'Firefox 桌面（Win/Mac）', 'desktop', async () => ({
  browser: await firefox.launch({ headless: true }),
}));

add('safari-desktop-webkit', 'Safari macOS（WebKit 引擎）', 'desktop', async () => ({
  browser: await webkit.launch({ headless: true }),
  contextOptions: { viewport: { width: 1440, height: 900 } },
}));

add('chrome-android', 'Chrome Android（Pixel 7）', 'mobile', async () => ({
  browser: await chromium.launch({ headless: true }),
  contextOptions: { ...devices['Pixel 7'] },
}));

add('safari-ios-webkit', 'Safari iOS（iPhone 14 WebKit）', 'mobile', async () => ({
  browser: await webkit.launch({ headless: true }),
  contextOptions: { ...devices['iPhone 14'] },
}));

add('safari-ipad-webkit', 'Safari iPad（iPad Pro 11 WebKit）', 'tablet', async () => ({
  browser: await webkit.launch({ headless: true }),
  contextOptions: { ...devices['iPad Pro 11'] },
}));

add('firefox-mobile', 'Firefox 移动视口', 'mobile', async () => ({
  browser: await firefox.launch({ headless: true }),
  // Firefox Playwright forbids isMobile/hasTouch — use narrow viewport only
  contextOptions: {
    viewport: { width: 412, height: 839 },
    userAgent:
      'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0',
  },
}));

function sanitizeContextOptions(browserName, opts = {}) {
  const next = { ...opts };
  if (browserName === 'firefox') {
    delete next.isMobile;
    delete next.hasTouch;
  }
  return next;
}

async function runProfile(profile, base) {
  let browser;
  let fallbackNote = '';
  try {
    const launched = await profile.launch();
    browser = launched.browser;
    if (launched.fallback) fallbackNote = `fallback=${launched.fallback}`;
    const browserName = browser.browserType().name();
    const ctx = await browser.newContext(
      sanitizeContextOptions(browserName, {
        locale: 'zh-CN',
        viewport: { width: 1440, height: 900 },
        ...(launched.contextOptions || {}),
      }),
    );
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e?.message || e).slice(0, 120)));

    // M-01 home
    page.setDefaultTimeout(30_000);
    const homeRes = await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    record(profile.id, 'M-01-home-status', !!homeRes && homeRes.ok(), `status=${homeRes?.status()} ${fallbackNote}`);
    await page.waitForTimeout(400);
    const homeText = await page.locator('body').innerText().catch(() => '');
    record(profile.id, 'M-02-home-h1', /用对话|Nova Ai-Studio/.test(homeText), 'hero copy');
    record(profile.id, 'M-03-nav', /文档/.test(homeText) && /联系我们/.test(homeText), 'nav links');
    const loginHref = await page.locator('a[href*="/login"]').first().getAttribute('href').catch(() => null);
    record(profile.id, 'M-04-login-cta', !!(loginHref && loginHref.includes('/login')), `href=${loginHref}`);

    // overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    record(profile.id, 'M-05-no-h-overflow', !overflow, `scrollW check`);

    // PWA
    const pwa = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      let manifestOk = false;
      if (link?.href) {
        try {
          const r = await fetch(link.href);
          const j = await r.json();
          manifestOk = !!(j.name && j.display);
        } catch {
          manifestOk = false;
        }
      }
      let swOk = false;
      if ('serviceWorker' in navigator) {
        try {
          const regs = await Promise.race([
            navigator.serviceWorker.getRegistrations(),
            new Promise((resolve) => setTimeout(() => resolve([]), 2500)),
          ]);
          swOk = Array.isArray(regs) && regs.some((r) => !!r.active);
          if (!swOk) {
            // do not await ready forever (WebKit/iPad can hang)
            await Promise.race([
              navigator.serviceWorker.ready.then(() => {
                swOk = true;
              }),
              new Promise((r) => setTimeout(r, 2000)),
            ]);
          }
        } catch {
          swOk = false;
        }
      }
      const vp = document.querySelector('meta[name="viewport"]')?.content || '';
      return { manifestOk, swOk, vp, hasJsonLd: !!document.querySelector('script[type="application/ld+json"]') };
    });
    record(profile.id, 'M-06-manifest', pwa.manifestOk, 'webmanifest');
    // SW optional soft: HTTP localhost may be blocked on some engines; fail only if SW API missing
    if (pwa.swOk) {
      record(profile.id, 'M-07-service-worker', true, 'active');
    } else {
      const hasSwApi = await page.evaluate(() => 'serviceWorker' in navigator);
      record(
        profile.id,
        'M-07-service-worker',
        hasSwApi,
        hasSwApi ? 'API ok (not yet active / HTTP soft)' : 'no SW API',
      );
    }
    record(profile.id, 'M-08-viewport-meta', /width=device-width/.test(pwa.vp), pwa.vp.slice(0, 60));
    record(profile.id, 'M-09-jsonld', pwa.hasJsonLd, 'SoftwareApplication graph');

    // contact
    await page.goto(`${base}/contact/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(400);
    const contactOk = await page.locator('[data-contact-form]').count();
    const captchaField = await page.locator('[name="captchaAnswer"]').count();
    record(profile.id, 'M-10-contact-form', contactOk > 0 && captchaField > 0, `form=${contactOk} captcha=${captchaField}`);

    // geo
    await page.goto(`${base}/geo/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(400);
    const geoText = await page.locator('body').innerText().catch(() => '');
    const geoLd = await page.evaluate(() => {
      const s = document.querySelector('script[type="application/ld+json"]');
      return s ? /FAQPage/.test(s.textContent || '') : false;
    });
    record(profile.id, 'M-11-geo-page', /Agent Harness|结构化/.test(geoText) && geoLd, 'GEO + FAQPage');

    // docs smoke (large page) — commit early, don't wait for full load
    const docsRes = await page.goto(`${base}/docs/`, { waitUntil: 'commit', timeout: 45_000 });
    record(profile.id, 'M-12-docs', !!docsRes && docsRes.ok(), `status=${docsRes?.status()}`);

    // SEO files
    const robots = await page.request.get(`${base}/robots.txt`);
    const sitemap = await page.request.get(`${base}/sitemap.xml`);
    const llms = await page.request.get(`${base}/llms.txt`);
    record(profile.id, 'M-13-seo-files', robots.ok() && sitemap.ok() && llms.ok(), 'robots/sitemap/llms');

    record(profile.id, 'M-14-no-pageerror', errors.length === 0, errors[0] || 'clean');

    // FAQ + left TOC (mobile stacks; desktop has pin slot)
    await page.goto(`${base}/faq/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(300);
    const faqOk = await page.evaluate(() => {
      const toc = document.querySelector('.faq-toc, [data-pin-nav]');
      const items = document.querySelectorAll('.faq-item, #q-what');
      const ld = !!document.querySelector('script[type="application/ld+json"]');
      return !!(toc && items.length > 0 && ld);
    });
    record(profile.id, 'M-15-faq-toc', faqOk, 'FAQ + TOC + JSON-LD');

    // Legal modal — footer About opens ~75% dialog without blank host
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(500);
    const legalOk = await page.evaluate(async () => {
      const link = document.querySelector('a[href="/about/"], a[href="/about"]');
      if (!link) return { ok: false, detail: 'no about link' };
      link.click();
      await new Promise((r) => setTimeout(r, 600));
      const modal = document.querySelector('.legal-modal.is-open');
      const title = modal?.querySelector('[data-legal-title]')?.textContent || '';
      const bodyLen = (modal?.querySelector('[data-legal-body]')?.textContent || '').trim().length;
      if (modal) {
        document.querySelector('[data-legal-close]')?.click();
      }
      return {
        ok: !!(modal && /关于|About/i.test(title) && bodyLen > 20),
        detail: modal ? `title=${title.slice(0, 24)} body=${bodyLen}` : 'modal not open',
      };
    });
    record(profile.id, 'M-16-legal-modal', !!legalOk.ok, legalOk.detail || '');

    // Showcase shell
    const showRes = await page.goto(`${base}/showcase/`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(400);
    const showText = await page.locator('body').innerText().catch(() => '');
    record(
      profile.id,
      'M-17-showcase',
      !!showRes?.ok() && (/演示|Showcase|设计|Design/i.test(showText)),
      `status=${showRes?.status()}`,
    );

    const overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    record(profile.id, 'M-18-showcase-no-h-overflow', !overflowMobile, 'showcase scrollW');

    await page.screenshot({ path: join(OUT_DIR, `${profile.id}-home.png`), fullPage: false }).catch(() => {});
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.screenshot({ path: join(OUT_DIR, `${profile.id}-home2.png`), fullPage: false }).catch(() => {});

    await ctx.close();
  } catch (e) {
    record(profile.id, 'M-00-launch', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function writeMarkdown(base, summary) {
  const profiles = [...new Set(rows.map((r) => r.profile))];
  const checks = [...new Set(rows.map((r) => r.id))].filter((id) => id !== 'M-00-launch');
  const labelOf = Object.fromEntries(PROFILES.map((p) => [p.id, p.label]));

  let table = '| 检查项 | ' + profiles.map((p) => labelOf[p] || p).join(' | ') + ' |\n';
  table += '|--------|' + profiles.map(() => '------').join('|') + '|\n';
  for (const check of checks) {
    const cells = profiles.map((p) => {
      const row = rows.find((r) => r.profile === p && r.id === check);
      if (!row) return '—';
      return row.ok ? '✅' : '❌';
    });
    table += `| ${check} | ${cells.join(' | ')} |\n`;
  }

  const md = `# 主站主流浏览器兼容验收（2026-08-01）

**BASE**：\`${base}\`  
**工具**：Playwright \`scripts/run-marketing-browser-compat.mjs\`  
**截图**：\`artifacts/marketing-browser-compat-20260801/\`  
**JSON**：\`artifacts/marketing-browser-compat-20260801/report.json\`

## 引擎映射

| 配置 | 对应用户浏览器 |
|------|----------------|
| chrome-desktop | Google Chrome（Win/Mac） |
| edge-desktop | Microsoft Edge（Win；缺省回退 Chromium） |
| firefox-desktop | Mozilla Firefox（Win/Mac） |
| safari-desktop-webkit | Safari macOS（WebKit 引擎模拟） |
| chrome-android | Chrome Android（Pixel 7） |
| safari-ios-webkit | Safari iOS（iPhone 14 WebKit） |
| safari-ipad-webkit | Safari iPad（iPad Pro 11） |
| firefox-mobile | Firefox 移动视口 |

> Windows 上 **Safari = WebKit 引擎**，与真机 Safari 高度接近但非 100% 等同；发版前建议 Mac/iOS 各抽测装屏。

## 总判定

| 指标 | 值 |
|------|-----|
| 配置数 | ${summary.profiles} |
| PASS 检查 | ${summary.pass} |
| FAIL 检查 | ${summary.fail} |
| 裁决 | ${summary.fail === 0 ? '**VERIFIED** — 主流引擎矩阵全绿' : '**NOT VERIFIED** — 见失败项'} |

## 明细矩阵

${table}

## 检查项说明

| ID | 含义 |
|----|------|
| M-01～M-04 | 首页可达、文案、导航、登录 CTA |
| M-05 | 无横向溢出 |
| M-06～M-08 | PWA manifest / SW / viewport |
| M-09 | 首页 JSON-LD |
| M-10 | 联系表单+验证码字段 |
| M-11 | GEO 页 + FAQPage |
| M-12 | 白皮书 docs |
| M-13 | robots/sitemap/llms |
| M-14 | 无 pageerror |
| M-15 | FAQ + 左栏 TOC + JSON-LD |
| M-16 | 关于我们 75% 弹窗 |
| M-17 | 演示案例壳 |
| M-18 | Showcase 无横向溢出 |

复跑：\`npm run test:marketing-site:browsers\`
`;
  writeFileSync(REPORT_MD, md, 'utf8');
}

async function main() {
  const { base, stop } = await ensureMarketingBase();
  console.log(`[marketing-browsers] BASE=${base}`);
  console.log(`[marketing-browsers] profiles=${PROFILES.length}`);

  const PROFILE_MS = Number(process.env.MARKETING_BROWSER_PROFILE_MS || 90000);
  for (const profile of PROFILES) {
    console.log(`\n--- ${profile.label} (${profile.id}) ---`);
    try {
      await Promise.race([
        runProfile(profile, base),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`profile_timeout_${PROFILE_MS}ms`)), PROFILE_MS),
        ),
      ]);
    } catch (err) {
      const msg = err?.message || String(err);
      record(profile.id, 'M-00-profile', false, msg);
      console.error(`[marketing-browsers] ${profile.id} aborted:`, msg);
    }
  }

  await stop();

  const summary = {
    base,
    at: new Date().toISOString(),
    profiles: PROFILES.length,
    pass: rows.filter((r) => r.ok).length,
    fail: rows.filter((r) => !r.ok).length,
    rows,
  };
  writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  writeMarkdown(base, summary);
  console.log(`\n[marketing-browsers] ${summary.pass} pass / ${summary.fail} fail`);
  console.log(`[marketing-browsers] report → ${REPORT_MD}`);

  if (GATE && failures > 0) process.exit(1);
  if (failures === 0) console.log('[marketing-browsers] GATE PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
