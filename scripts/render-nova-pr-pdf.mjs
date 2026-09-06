/**
 * Render Nova PR HTML → PDF (print CSS).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'artifacts/nova-product-pr-20260812');
const htmlPath = path.join(DIR, 'index.html');
const pdfPath = path.join(DIR, 'nova-ai-product-overview.pdf');
const pdfTmp = path.join(DIR, 'nova-ai-product-overview.tmp.pdf');

async function main() {
  if (!fs.existsSync(htmlPath)) throw new Error('missing index.html');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(800);
  await page.pdf({
    path: pdfTmp,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  try {
    fs.copyFileSync(pdfTmp, pdfPath);
    fs.unlinkSync(pdfTmp);
    console.log('PDF', pdfPath, fs.statSync(pdfPath).size);
  } catch (err) {
    console.warn('target locked, kept temp:', pdfTmp, err.code || err.message);
    console.log('PDF', pdfTmp, fs.statSync(pdfTmp).size);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
