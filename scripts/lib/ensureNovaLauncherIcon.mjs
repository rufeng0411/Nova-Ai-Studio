#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Build full-color .ico for Nova Dev Console (to-ico + white canvas).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const launcherRoot = join(repoRoot, 'tools/nova-launcher');
const require = createRequire(join(launcherRoot, 'package.json'));

/** @type {(input: Buffer[]) => Promise<Buffer>} */
const toIco = require('to-ico');

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

function pickLogoSource() {
  for (const rel of ['ui/public/logo-256.png', 'ui/src/assets/nova-logo-mark.png', 'logo-3.png']) {
    const p = join(repoRoot, rel);
    if (existsSync(p)) return p;
  }
  throw new Error('N2 logo source not found');
}

/**
 * @param {string} logoSource
 * @param {number} size
 */
async function renderPng(logoSource, size) {
  const pad = Math.round(size * 0.1);
  const inner = size - pad * 2;
  const logo = await sharp(logoSource)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 255 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

/**
 * @returns {Promise<string>}
 */
export async function ensureNovaLauncherIcon() {
  const logoSource = pickLogoSource();
  const assetsDir = join(launcherRoot, 'assets');
  const icoPath = join(assetsDir, 'nova-dev-console.ico');
  const previewPath = join(assetsDir, 'nova-dev-console-256.png');

  mkdirSync(assetsDir, { recursive: true });

  const sourceMtime = statSync(logoSource).mtimeMs;
  const icoMtime = existsSync(icoPath) ? statSync(icoPath).mtimeMs : 0;
  if (existsSync(icoPath) && sourceMtime <= icoMtime) {
    return icoPath;
  }

  const pngs = await Promise.all(ICON_SIZES.map((size) => renderPng(logoSource, size)));
  const ico = await toIco(pngs);
  writeFileSync(icoPath, ico);
  writeFileSync(previewPath, pngs[pngs.length - 1]);

  return icoPath;
}
