import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const html =
  'F:/Ai-pilotdeck/.saas-dev-data/tenants/default/cloud-storage/users/1/workspaces/9a498782-6cab-4ca0-b3c7-796926e9af34/artifacts/task-20260803-684507f7/index.html';
const outs = [
  'F:/Ai-pilotdeck/deploy/marketing/showcase/media/sc-design-lanxi-site',
  'F:/Ai-pilotdeck/.saas-dev-data/marketing-showcase/media/sc-design-lanxi-site',
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 900, height: 1200 },
  deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle', timeout: 60000 });
await page.addStyleTag({
  content: `
  .hero{padding-top:72px!important;padding-bottom:28px!important}
  .hero-title{font-size:40px!important;line-height:1.28!important}
  .hero-dek{font-size:14px!important;max-width:36em!important}
  .hero-figure{margin-top:24px!important}
  .nav-inner,.wrap{padding-left:22px!important;padding-right:22px!important}
`,
});
await page.waitForTimeout(500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const shot = await page.screenshot({ type: 'png', fullPage: false });
const cover = await sharp(shot)
  .resize(900, 1200, { fit: 'cover', position: 'top' })
  .jpeg({ quality: 92, mozjpeg: true })
  .toBuffer();
for (const d of outs) {
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'thumb-cover.jpg'), cover);
  fs.writeFileSync(path.join(d, 'thumb-raw.png'), shot);
}
fs.writeFileSync(path.join(path.dirname(html), 'thumb-cover.jpg'), cover);
console.log('LANXI3', cover.length);
await browser.close();
