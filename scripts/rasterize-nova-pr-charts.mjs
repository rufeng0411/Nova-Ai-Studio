/**
 * Rasterize PR SVG charts → PNG for Word embed.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARTS = path.join(ROOT, 'artifacts/nova-product-pr-20260812/charts');
const FILES = ['architecture.svg', 'compare-bars.svg', 'flow-e2e.svg'];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  for (const name of FILES) {
    const svgPath = path.join(CHARTS, name);
    const pngPath = path.join(CHARTS, name.replace(/\.svg$/i, '.png'));
    await page.goto(pathToFileURL(svgPath).href, { waitUntil: 'networkidle' });
    const box = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return { w: 1100, h: 520 };
      const r = svg.getBoundingClientRect();
      return { w: Math.ceil(r.width || 1100), h: Math.ceil(r.height || 520) };
    });
    await page.setViewportSize({
      width: Math.max(800, box.w + 40),
      height: Math.max(400, box.h + 40),
    });
    const svg = page.locator('svg').first();
    await svg.screenshot({ path: pngPath, omitBackground: false });
    console.log('PNG', pngPath, fs.statSync(pngPath).size);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
