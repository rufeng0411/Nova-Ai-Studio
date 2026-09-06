/**
 * Capture marketing site shots for Nova PR v2 (home / token 70% / showcase).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts/nova-product-pr-20260812/media');
const BASE = process.env.NOVA_SITE_BASE || 'https://www.novapage.online';

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('shot', name, fs.statSync(file).size);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(2000);
  await shot(page, '05-site-home');

  const token = page.locator('#token');
  if (await token.count()) {
    await token.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
  } else {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2,p,span')].find((n) =>
        /70%|节省.*Token|智能路由/.test(n.textContent || ''),
      );
      el?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(1200);
  }
  await shot(page, '06-site-token70');

  await page.goto(`${BASE}/showcase/`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(2500);
  await shot(page, '07-showcase-home');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
