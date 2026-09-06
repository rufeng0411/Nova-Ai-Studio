import sharp from 'sharp';
import fs from 'node:fs';

const out = 'deploy/marketing/showcase/assets/thumb-logo-placeholder-3x4.png';
const logoPath = 'deploy/marketing/showcase/assets/nova-logo-mark.png';
const W = 900;
const H = 1200;
const logoSize = 220;

const logo = await sharp(logoPath)
  .resize(logoSize, logoSize, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const left = Math.round((W - logoSize) / 2);
const top = Math.round((H - logoSize) / 2) - 20;

const bg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="55%" stop-color="#121212"/>
      <stop offset="100%" stop-color="#0e0e0e"/>
    </linearGradient>
    <radialGradient id="r" cx="35%" cy="28%" r="55%">
      <stop offset="0%" stop-color="rgba(16,163,127,0.14)"/>
      <stop offset="100%" stop-color="rgba(16,163,127,0)"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#r)"/>
</svg>`);

await sharp(bg)
  .composite([{ input: logo, left, top }])
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log('wrote', out, fs.statSync(out).size);
