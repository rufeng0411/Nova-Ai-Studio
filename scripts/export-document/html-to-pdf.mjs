#!/usr/bin/env node
/**
 * HTML → PDF via Playwright (same pattern as gen-product-brief-pdf.mjs)
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const input = readArg('--input');
const output = readArg('--output');
const landscape = readArg('--landscape') === '1';

if (!input || !output) {
  console.error('Usage: html-to-pdf.mjs --input <html> --output <pdf> [--landscape 1]');
  process.exit(1);
}

const htmlPath = path.resolve(input);
const pdfPath = path.resolve(output);
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.pdf({
  path: pdfPath,
  format: 'A4',
  landscape,
  printBackground: true,
  margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
});
await browser.close();
console.log(pdfPath);
