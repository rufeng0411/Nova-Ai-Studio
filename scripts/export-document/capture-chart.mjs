#!/usr/bin/env node
/** Capture [data-export-chart] or .chart-box from HTML to PNG */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import path from 'path';

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const input = readArg('--input');
const output = readArg('--output');
if (!input || !output) process.exit(1);

const htmlPath = path.resolve(input);
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(fileUrl, { waitUntil: 'networkidle' });
const el = await page.$('[data-export-chart], .chart-box, canvas');
if (!el) {
  await browser.close();
  process.exit(2);
}
const buffer = await el.screenshot({ type: 'png' });
writeFileSync(path.resolve(output), buffer);
await browser.close();
