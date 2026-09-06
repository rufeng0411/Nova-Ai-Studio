/** PD-SAAS-FORK: Rasterize Preflight HTML/PNG → lightweight WebP thumbs */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const THUMB_W = 400;
const THUMB_H = 250;
const DETAIL_W = 960;
const DETAIL_H = 600;

export async function rasterizePngSource(srcAbs, thumbAbs, detailAbs) {
  mkdirSync(path.dirname(thumbAbs), { recursive: true });
  mkdirSync(path.dirname(detailAbs), { recursive: true });
  const input = sharp(srcAbs);
  await input.clone().resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'top' }).webp({ quality: 82 }).toFile(thumbAbs);
  await input.clone().resize(DETAIL_W, DETAIL_H, { fit: 'inside' }).webp({ quality: 85 }).toFile(detailAbs);
}

export async function rasterizeHtmlFile(page, htmlAbs, thumbAbs, detailAbs, viewport = { width: 1280, height: 800 }) {
  mkdirSync(path.dirname(thumbAbs), { recursive: true });
  mkdirSync(path.dirname(detailAbs), { recursive: true });
  const url = pathToFileURL(htmlAbs).href;
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(120);
  const pngBuf = await page.screenshot({ type: 'png', fullPage: false });
  await sharp(pngBuf).resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'top' }).webp({ quality: 82 }).toFile(thumbAbs);
  await sharp(pngBuf).resize(DETAIL_W, DETAIL_H, { fit: 'inside' }).webp({ quality: 85 }).toFile(detailAbs);
}

export async function withRasterBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export async function rasterizeOdHeroSet({ repoRoot, heroIds, htmlPathForId, log = console.log }) {
  const thumbDir = path.join(repoRoot, 'ui/public/vendor/preflight/od/thumbs');
  const detailDir = path.join(repoRoot, 'ui/public/vendor/preflight/od/detail');
  const results = [];

  await withRasterBrowser(async (page) => {
    for (const id of heroIds) {
      const htmlAbs = htmlPathForId(id);
      if (!htmlAbs || !existsSync(htmlAbs)) {
        log(`[preflight:raster] skip od:${id} — html missing`);
        continue;
      }
      const thumbAbs = path.join(thumbDir, `${id}.webp`);
      const detailAbs = path.join(detailDir, `${id}.webp`);
      await rasterizeHtmlFile(page, htmlAbs, thumbAbs, detailAbs);
      results.push({ id, thumbAbs, detailAbs });
      log(`[preflight:raster] od hero ${id}`);
    }
  });

  return results;
}

export async function rasterizePptStyleModeSet({ repoRoot, styleEntries, modeEntries, resolveStylePng, resolveModePng, log = console.log }) {
  const styleThumbDir = path.join(repoRoot, 'ui/public/vendor/preflight/ppt/thumbs/styles');
  const styleDetailDir = path.join(repoRoot, 'ui/public/vendor/preflight/ppt/detail/styles');
  const modeThumbDir = path.join(repoRoot, 'ui/public/vendor/preflight/ppt/thumbs/modes');
  const modeDetailDir = path.join(repoRoot, 'ui/public/vendor/preflight/ppt/detail/modes');
  const results = [];

  for (const entry of styleEntries) {
    const src = resolveStylePng(entry.id);
    if (!src || !existsSync(src)) continue;
    const thumbAbs = path.join(styleThumbDir, `${entry.id}.webp`);
    const detailAbs = path.join(styleDetailDir, `${entry.id}.webp`);
    await rasterizePngSource(src, thumbAbs, detailAbs);
    results.push({ kind: 'style', id: entry.id, thumbAbs, detailAbs });
  }

  for (const entry of modeEntries) {
    const src = resolveModePng(entry.id);
    if (!src || !existsSync(src)) continue;
    const thumbAbs = path.join(modeThumbDir, `${entry.id}.webp`);
    const detailAbs = path.join(modeDetailDir, `${entry.id}.webp`);
    await rasterizePngSource(src, thumbAbs, detailAbs);
    results.push({ kind: 'mode', id: entry.id, thumbAbs, detailAbs });
  }

  log(`[preflight:raster] ppt styles=${styleEntries.length} modes=${modeEntries.length} → ${results.length} webp`);
  return results;
}

export async function rasterizePptCanvasSet({ repoRoot, canvasIds, htmlPathForId, log = console.log }) {
  const thumbDir = path.join(repoRoot, 'ui/public/vendor/preflight/ppt/thumbs/canvas');
  const detailDir = path.join(repoRoot, 'ui/public/vendor/preflight/ppt/detail/canvas');
  const results = [];

  await withRasterBrowser(async (page) => {
    for (const id of canvasIds) {
      const htmlAbs = htmlPathForId(id);
      if (!htmlAbs || !existsSync(htmlAbs)) continue;
      const thumbAbs = path.join(thumbDir, `${id}.webp`);
      const detailAbs = path.join(detailDir, `${id}.webp`);
      await rasterizeHtmlFile(page, htmlAbs, thumbAbs, detailAbs);
      results.push({ id, thumbAbs, detailAbs });
    }
  });

  log(`[preflight:raster] ppt canvas=${results.length}`);
  return results;
}

export function odThumbUrl(id) {
  return `${'/api/launch/static/open-design'}/thumbs/${encodeURIComponent(id)}.webp`;
}

export function odDetailUrl(id) {
  return `${'/api/launch/static/open-design'}/detail/${encodeURIComponent(id)}.webp`;
}

export function pptStyleThumbUrl(id) {
  return `/api/launch/static/preflight-raster/ppt/thumbs/styles/${encodeURIComponent(id)}.webp`;
}

export function pptStyleDetailUrl(id) {
  return `/api/launch/static/preflight-raster/ppt/detail/styles/${encodeURIComponent(id)}.webp`;
}

export function pptModeThumbUrl(id) {
  return `/api/launch/static/preflight-raster/ppt/thumbs/modes/${encodeURIComponent(id)}.webp`;
}

export function pptModeDetailUrl(id) {
  return `/api/launch/static/preflight-raster/ppt/detail/modes/${encodeURIComponent(id)}.webp`;
}

export function pptCanvasThumbUrl(id) {
  return `/api/launch/static/preflight-raster/ppt/thumbs/canvas/${encodeURIComponent(id)}.webp`;
}

export function pptCanvasDetailUrl(id) {
  return `/api/launch/static/preflight-raster/ppt/detail/canvas/${encodeURIComponent(id)}.webp`;
}

export function getPreflightRasterStaticRoot(relativePath) {
  const root = path.join(REPO_ROOT, 'ui/public/vendor/preflight');
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  const abs = path.join(root, normalized);
  if (!abs.startsWith(root)) return null;
  if (!existsSync(abs)) return null;
  return abs;
}
