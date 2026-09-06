#!/usr/bin/env node
/**
 * Generate Nova Ai-Studio brand assets from the real logo-3.png.
 *
 * Pipeline:
 *   1. Trim the white border off logo-3.png.
 *   2. Convert the remaining white background to transparent (with a soft
 *      edge ramp so there is no white halo on dark surfaces).
 *   3. Pad to a square master, then export favicon / PWA icons / wordmarks /
 *      banner from that single real-logo master.
 *
 * Run: node scripts/generate-nova-brand-assets.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'logo-3.png');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
// iOS PWA startup images (portrait, px = points x scale). Covers the
// mainstream iPhone matrix; iPads fall back to the icon-only launch.
const SPLASH_SIZES = [
  { w: 750, h: 1334 }, //  iPhone SE2/SE3/8        375x667@2
  { w: 828, h: 1792 }, //  iPhone XR/11            414x896@2
  { w: 1125, h: 2436 }, // iPhone X/XS/11 Pro      375x812@3
  { w: 1170, h: 2532 }, // iPhone 12/13/14         390x844@3
  { w: 1179, h: 2556 }, // iPhone 15/16 Pro        393x852@3
  { w: 1242, h: 2688 }, // iPhone XS Max/11 ProMax 414x896@3
  { w: 1284, h: 2778 }, // iPhone 12-14 Pro Max    428x926@3
  { w: 1290, h: 2796 }, // iPhone 15/16 Pro Max    430x932@3
];
const OUT = {
  faviconPng: path.join(ROOT, 'ui/public/favicon.png'),
  faviconSvg: path.join(ROOT, 'ui/public/favicon.svg'),
  logo128: path.join(ROOT, 'ui/public/logo-128.png'),
  logo256: path.join(ROOT, 'ui/public/logo-256.png'),
  iconsDir: path.join(ROOT, 'ui/public/icons'),
  banner: path.join(ROOT, 'assets/banner.png'),
  wordmarkLight: path.join(ROOT, 'ui/src/assets/pilotdeck-wordmark-light.png'),
  wordmarkDark: path.join(ROOT, 'ui/src/assets/pilotdeck-wordmark-dark.png'),
  logoMark: path.join(ROOT, 'ui/src/assets/nova-logo-mark.png'),
  splashDir: path.join(ROOT, 'ui/public/splash'),
};

function sampleCornerLuminance(data, channels, width, height) {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let sum = 0;
  for (const [x, y] of points) {
    const i = (y * width + x) * channels;
    sum += Math.max(data[i], data[i + 1], data[i + 2]);
  }
  return sum / (points.length * 255);
}

/**
 * Remove a near-uniform light or dark background while keeping logo colors.
 * Pixels are scored by min(R,G,B) for white backgrounds or max(R,G,B) for black.
 */
async function backgroundToTransparent(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const removeBlack = sampleCornerLuminance(data, channels, width, height) < 0.45;
  const HARD = removeBlack ? 42 : 250;
  const SOLID = removeBlack ? 96 : 205;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const edge = removeBlack ? Math.max(r, g, b) : Math.min(r, g, b);
    let alpha;
    if (removeBlack) {
      if (edge <= HARD) alpha = 0;
      else if (edge >= SOLID) alpha = 255;
      else alpha = Math.round(((edge - HARD) / (SOLID - HARD)) * 255);
    } else if (edge >= HARD) alpha = 0;
    else if (edge <= SOLID) alpha = 255;
    else alpha = Math.round(((HARD - edge) / (HARD - SOLID)) * 255);
    data[i + channels - 1] = Math.min(data[i + channels - 1], alpha);
  }

  return sharp(data, { raw: { width, height, channels } }).png();
}

/** Build a transparent, square master from the real logo. */
async function buildMaster() {
  const trimmed = await sharp(SOURCE).trim({ threshold: 18 }).png().toBuffer();
  const transparent = await (await backgroundToTransparent(trimmed)).png().toBuffer();

  const meta = await sharp(transparent).metadata();
  const maxDim = Math.max(meta.width, meta.height);
  // Smaller padding => the logo fills more of the icon (~20% larger than before).
  const pad = Math.round(maxDim * 0.04);
  const canvas = maxDim + pad * 2;

  const square = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: transparent, gravity: 'center' }])
    .png()
    .toBuffer();

  return sharp(square).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

async function exportIcon(masterBuf, size, outPath) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(masterBuf)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log('wrote', path.relative(ROOT, outPath), `${size}x${size}`);
}

/** Icon-only horizontal mark for post-login chrome (sidebar, etc.). */
async function buildLogoMark(trimmedTransparentBuf, { height = 32 } = {}) {
  const meta = await sharp(trimmedTransparentBuf).metadata();
  const width = Math.max(1, Math.round((meta.width / meta.height) * height));
  return sharp(trimmedTransparentBuf)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();
}

/** Larger icon mark for login / marketing surfaces (caption rendered in UI). */
async function buildLogoMarkLarge(trimmedTransparentBuf, { height = 40 } = {}) {
  return buildLogoMark(trimmedTransparentBuf, { height });
}

async function buildFaviconSvg(masterBuf) {
  const icon = await sharp(masterBuf).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const b64 = icon.toString('base64');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <image width="256" height="256" href="data:image/png;base64,${b64}"/>
</svg>`;
}

/** iOS startup image: light canvas, centered logo above the wordmark. */
async function buildSplash(masterBuf, { w, h }) {
  const iconSize = Math.round(Math.min(w, h) * 0.28);
  const icon = await sharp(masterBuf)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const b64 = icon.toString('base64');
  const titleSize = Math.round(iconSize * 0.21);
  const titleY = Math.round(h / 2 + iconSize * 0.78);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <image x="${Math.round((w - iconSize) / 2)}" y="${Math.round(h / 2 - iconSize * 0.72)}" width="${iconSize}" height="${iconSize}" href="data:image/png;base64,${b64}"/>
  <text x="${w / 2}" y="${titleY}" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="${titleSize}" font-weight="700" letter-spacing="-0.5" fill="#111827">Nova Ai-Studio</text>
</svg>`;
  return sharp(Buffer.from(svg)).png();
}

async function buildBanner(masterBuf) {
  const iconSize = 144;
  const icon = await sharp(masterBuf).resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const b64 = icon.toString('base64');
  const W = 1280;
  const H = 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <image x="${W / 2 - iconSize / 2}" y="70" width="${iconSize}" height="${iconSize}" href="data:image/png;base64,${b64}"/>
  <text x="${W / 2}" y="248" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="52" font-weight="700" fill="#FAFAFA" letter-spacing="-1">Nova Ai-Studio</text>
  <text x="${W / 2}" y="290" text-anchor="middle" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="400" fill="#94A3B8">Agent-driven creative workspace</text>
</svg>`;
  return sharp(Buffer.from(svg)).png();
}

async function main() {
  const trimmed = await sharp(SOURCE).trim({ threshold: 18 }).png().toBuffer();
  const trimmedTransparent = await (await backgroundToTransparent(trimmed)).png().toBuffer();
  const masterBuf = await buildMaster();

  writeFileSync(OUT.faviconSvg, await buildFaviconSvg(masterBuf));
  console.log('wrote', path.relative(ROOT, OUT.faviconSvg));

  await exportIcon(masterBuf, 64, OUT.faviconPng);
  await exportIcon(masterBuf, 128, OUT.logo128);
  await exportIcon(masterBuf, 256, OUT.logo256);
  for (const size of ICON_SIZES) {
    await exportIcon(masterBuf, size, path.join(OUT.iconsDir, `icon-${size}x${size}.png`));
  }

  await (await buildLogoMark(trimmedTransparent, { height: 28 })).toFile(OUT.logoMark);
  console.log('wrote', path.relative(ROOT, OUT.logoMark));

  const wordmarkMark = await buildLogoMarkLarge(trimmedTransparent, { height: 40 });
  await wordmarkMark.toFile(OUT.wordmarkLight);
  console.log('wrote', path.relative(ROOT, OUT.wordmarkLight));
  await wordmarkMark.toFile(OUT.wordmarkDark);
  console.log('wrote', path.relative(ROOT, OUT.wordmarkDark));

  await (await buildBanner(masterBuf)).toFile(OUT.banner);
  console.log('wrote', path.relative(ROOT, OUT.banner));

  mkdirSync(OUT.splashDir, { recursive: true });
  for (const size of SPLASH_SIZES) {
    const out = path.join(OUT.splashDir, `splash-${size.w}x${size.h}.png`);
    await (await buildSplash(masterBuf, size)).toFile(out);
    console.log('wrote', path.relative(ROOT, out), `${size.w}x${size.h}`);
  }

  console.log('Nova brand assets generated from real logo-3.png.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
