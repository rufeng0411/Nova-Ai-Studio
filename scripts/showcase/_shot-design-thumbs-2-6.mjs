import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WS =
  'F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34/artifacts';
const OUT_DIRS = [
  'F:/Ai-pilotdeck/deploy/marketing/showcase/media',
  'F:/Ai-pilotdeck/.saas-dev-data/marketing-showcase/media',
];

function writeAll(id, filename, buf) {
  for (const root of OUT_DIRS) {
    const dir = path.join(root, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buf);
  }
}

async function waitImages(page) {
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? 1
          : new Promise((r) => {
              img.onload = img.onerror = () => r(1);
            }),
      ),
    ),
  );
}

/**
 * Wide dashboard → 3:4 card: graphite canvas + top-aligned content (no brutal mid-crop).
 */
async function padToCover3x4(shotBuf, { bg = { r: 18, g: 22, b: 27 } } = {}) {
  const targetW = 900;
  const targetH = 1200;
  const side = 24;
  const topPad = 36;
  const fitted = await sharp(shotBuf)
    .resize({ width: targetW - side * 2, withoutEnlargement: false })
    .png()
    .toBuffer();
  const fm = await sharp(fitted).metadata();
  const fw = fm.width || 1;
  const fh = fm.height || 1;
  const maxH = targetH - topPad - 24;
  let content = fitted;
  if (fh > maxH) {
    content = await sharp(fitted)
      .extract({ left: 0, top: 0, width: fw, height: maxH })
      .png()
      .toBuffer();
  }
  return sharp({
    create: { width: targetW, height: targetH, channels: 3, background: bg },
  })
    .composite([{ input: content, top: topPad, left: side }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** Magazine site hero → 3:4 from top (brand + claim + CTA). */
async function heroToCover3x4(shotBuf) {
  const meta = await sharp(shotBuf).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  let cropW = w;
  let cropH = Math.round((cropW * 4) / 3);
  if (cropH > h) {
    cropH = h;
    cropW = Math.round((cropH * 3) / 4);
  }
  const left = Math.max(0, Math.floor((w - cropW) / 2));
  return sharp(shotBuf)
    .extract({ left, top: 0, width: Math.min(cropW, w - left), height: Math.min(cropH, h) })
    .resize(900, 1200, { fit: 'cover', position: 'top' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

const browser = await chromium.launch({ headless: true });

// 2 · 澜析 — hero + layers band (product narrative), not empty footer whitespace
{
  const html = path.join(WS, 'task-20260803-684507f7/index.html');
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
  });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  await waitImages(page);
  // Scroll layers into composition if present
  await page.evaluate(() => {
    const layers = document.querySelector('#layers');
    if (layers) layers.scrollIntoView({ block: 'nearest' });
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const height = await page.evaluate(() => {
    const layers = document.querySelector('#layers');
    if (!layers) return 1200;
    const bottom = layers.getBoundingClientRect().top + window.scrollY + Math.min(layers.offsetHeight, 520);
    return Math.min(Math.max(bottom, 1000), 1680);
  });

  const shot = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: 1440, height },
  });
  writeAll('sc-design-lanxi-site', 'thumb-raw.png', shot);
  const cover = await heroToCover3x4(shot);
  writeAll('sc-design-lanxi-site', 'thumb-cover.jpg', cover);
  fs.writeFileSync(path.join(WS, 'task-20260803-684507f7', 'thumb-cover.jpg'), cover);
  // remove broken white thumb
  for (const root of OUT_DIRS) {
    const bad = path.join(root, 'sc-design-lanxi-site', 'thumb-3x4-msdas0eu.jpg');
    if (fs.existsSync(bad)) fs.unlinkSync(bad);
  }
  console.log('LANXI cover bytes', cover.length);
  await page.close();
}

// 6 · 织野 — brand + KPI + charts (+ alerts), Chart.js settled; pad to 3:4
{
  const html = path.join(WS, 'task-20260803-0d251d18/index.html');
  const page = await browser.newPage({
    viewport: { width: 1560, height: 1100 },
    deviceScaleFactor: 2,
  });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.fonts?.ready?.catch?.(() => {}));

  const clip = await page.evaluate(() => {
    const pageEl = document.querySelector('.page') || document.body;
    const head = document.querySelector('.head');
    const charts = document.querySelector('.charts');
    const alerts = document.querySelector('.alerts');
    const rectPage = pageEl.getBoundingClientRect();
    const top = Math.max(0, (head?.getBoundingClientRect().top ?? 0) - 10);
    const bottomEl = alerts || charts || head;
    const bottom = (bottomEl?.getBoundingClientRect().bottom ?? 900) + 14;
    const left = Math.max(0, rectPage.left);
    const width = Math.min(rectPage.width, window.innerWidth - left);
    const height = Math.min(Math.max(bottom - top, 720), window.innerHeight - top);
    return {
      x: Math.floor(left),
      y: Math.floor(top),
      width: Math.floor(width),
      height: Math.floor(height),
    };
  });

  const shot = await page.screenshot({ type: 'png', clip });
  writeAll('sc-design-zhiye-dash', 'thumb-raw.png', shot);
  const cover = await padToCover3x4(shot);
  writeAll('sc-design-zhiye-dash', 'thumb-cover.jpg', cover);
  fs.writeFileSync(path.join(WS, 'task-20260803-0d251d18', 'thumb-cover.jpg'), cover);
  console.log('ZHIYE cover bytes', cover.length, 'clip', clip);
  await page.close();
}

await browser.close();
console.log('ok');
