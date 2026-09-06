#!/usr/bin/env node
/**
 * Screenshot the three mobile design sketches at phone viewport.
 * Usage: node scripts/mobile-design-screenshot.mjs
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import fs from 'fs/promises';

const __dir = dirname(fileURLToPath(import.meta.url));
const designDir = join(__dir, '../artifacts/mobile-design');
const outDir = designDir;

const versions = [
  { name: 'v1', file: 'v1-glass-dock.html' },
  { name: 'v2', file: 'v2-floating-pill.html' },
  { name: 'v3', file: 'v3-graphite-minimal.html' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  for (const v of versions) {
    const page = await context.newPage();
    const fileUrl = 'file:///' + join(designDir, v.file).replace(/\\/g, '/');
    console.log(`\n[${v.name}] ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(400);

    await page.screenshot({ path: join(outDir, `${v.name}-chat.png`) });
    console.log(`  chat ok`);

    await page.click('.tab[data-t="hub"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(outDir, `${v.name}-hub.png`) });
    console.log(`  hub ok`);

    await page.click('.tab[data-t="me"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(outDir, `${v.name}-me.png`) });
    console.log(`  me ok`);

    await page.click('.theme-toggle');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(outDir, `${v.name}-dark.png`) });
    console.log(`  dark ok`);

    await page.close();
  }

  await browser.close();
  const files = (await fs.readdir(outDir)).filter((f) => f.endsWith('.png'));
  console.log(`\nDone. ${files.length} screenshots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
