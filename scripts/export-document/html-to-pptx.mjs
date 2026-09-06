#!/usr/bin/env node
/**
 * HTML → PPTX: Playwright section screenshots + image compose (fidelity path).
 */
import { chromium } from 'playwright';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const input = readArg('--input');
const output = readArg('--output');
const screenshotsDirArg = readArg('--screenshots-dir');
const aspectRatio = readArg('--aspect-ratio') || '16:9';
const viewportWidth = Number.parseInt(readArg('--width') || '1440', 10);

if (!input || (!output && !screenshotsDirArg)) {
  console.error('Usage: html-to-pptx.mjs --input <html> (--output <pptx> | --screenshots-dir <dir>) [--aspect-ratio 16:9] [--width 1440]');
  process.exit(1);
}

const htmlPath = path.resolve(input);
const pptxPath = output ? path.resolve(output) : '';
const persistScreenshots = Boolean(screenshotsDirArg);
const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

const SLIDE_SELECTORS = [
  'header.hero',
  'section.section',
  'section.slide',
  '[data-export-slide]',
  'main > section',
  'body > section',
];

async function waitForRichContent(page) {
  await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (typeof window.Chart !== 'undefined') await sleep(800);
    if (typeof window.ApexCharts !== 'undefined') await sleep(800);
    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (canvases.length > 0) await sleep(600);
  }).catch(() => {});
  await page.waitForTimeout(400);
}

async function captureElementScreenshots(page) {
  const handles = await page.$$(SLIDE_SELECTORS.join(', '));
  const unique = [];
  const seen = new Set();
  for (const handle of handles) {
    const box = await handle.boundingBox();
    if (!box || box.width < 40 || box.height < 40) continue;
    const key = `${Math.round(box.y / 20)}:${Math.round(box.height / 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(handle);
  }
  if (unique.length === 0) return captureViewportScroll(page);

  const buffers = [];
  for (const handle of unique) {
    await handle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    buffers.push(await handle.screenshot({ type: 'png', animations: 'disabled' }));
  }
  return buffers;
}

async function captureViewportScroll(page) {
  const viewport = page.viewportSize() ?? { width: viewportWidth, height: Math.round(viewportWidth * 9 / 16) };
  const totalHeight = await page.evaluate(() => Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0,
  ));
  const buffers = [];
  let offsetY = 0;
  while (offsetY < totalHeight) {
    await page.evaluate((y) => window.scrollTo(0, y), offsetY);
    await page.waitForTimeout(300);
    const height = Math.min(viewport.height, totalHeight - offsetY);
    buffers.push(await page.screenshot({
      type: 'png',
      animations: 'disabled',
      clip: { x: 0, y: 0, width: viewport.width, height },
    }));
    if (height <= 0) break;
    offsetY += viewport.height;
  }
  return buffers;
}

function runCommand(command, commandArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

async function composePptx(imagePaths) {
  if (!pptxPath) return;
  const pyScript = path.join(REPO_ROOT, 'scripts', 'compose-images-pptx.py');
  const nodeScript = path.join(REPO_ROOT, 'scripts', 'compose-images-pptx.mjs');
  const pyArgs = ['--output', pptxPath, '--aspect-ratio', aspectRatio, '--images', ...imagePaths];
  try {
    await runCommand(process.platform === 'win32' ? 'python' : 'python3', [pyScript, ...pyArgs], REPO_ROOT);
  } catch {
    await runCommand(process.execPath, [nodeScript, ...pyArgs], REPO_ROOT);
  }
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: viewportWidth, height: Math.round(viewportWidth * 9 / 16) },
});
await waitForRichContent(page);
const screenshots = await captureElementScreenshots(page);
await browser.close();

if (screenshots.length === 0) {
  console.error('html-to-pptx: no slide screenshots captured');
  process.exit(3);
}

const tempDir = persistScreenshots
  ? path.resolve(screenshotsDirArg)
  : mkdtempSync(path.join(tmpdir(), 'html-to-pptx-'));
mkdirSync(tempDir, { recursive: true });
const imagePaths = screenshots.map((buffer, index) => {
  const imagePath = path.join(tempDir, `slide-${String(index + 1).padStart(2, '0')}.png`);
  writeFileSync(imagePath, buffer);
  return imagePath;
});

try {
  if (pptxPath) {
    mkdirSync(path.dirname(pptxPath), { recursive: true });
    await composePptx(imagePaths);
    console.log(pptxPath);
  } else {
    console.log(JSON.stringify({ images: imagePaths, count: imagePaths.length }));
  }
} finally {
  if (!persistScreenshots) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
