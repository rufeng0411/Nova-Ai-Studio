#!/usr/bin/env node
/**
 * Compose ordered images into a PPTX (one full-bleed image per slide).
 * Node fallback when python-pptx / Pillow are unavailable.
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import { normalizeAspectRatio, slideSizeInches } from './lib/pptxAspectRatio.mjs';

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const output = readArg('--output');
const aspectRatio = readArg('--aspect-ratio') || '16:9';
const imagesIdx = args.indexOf('--images');
const imagePaths = imagesIdx >= 0 ? args.slice(imagesIdx + 1) : [];

if (!output || imagePaths.length === 0) {
  console.error('Usage: compose-images-pptx.mjs --output <file.pptx> [--aspect-ratio 16:9] --images <path> [...]');
  process.exit(1);
}

const [slideWidth, slideHeight] = slideSizeInches(normalizeAspectRatio(aspectRatio));

const pres = new pptxgen();
pres.defineLayout({ name: 'CUSTOM', width: slideWidth, height: slideHeight });
pres.layout = 'CUSTOM';

for (const imagePath of imagePaths) {
  const resolved = path.resolve(imagePath);
  if (!existsSync(resolved)) {
    console.error(`Slide image not found: ${imagePath}`);
    process.exit(1);
  }
  const slide = pres.addSlide();
  slide.addImage({
    path: resolved,
    x: 0,
    y: 0,
    w: slideWidth,
    h: slideHeight,
    sizing: { type: 'contain', w: slideWidth, h: slideHeight },
  });
}

const outPath = path.resolve(output);
mkdirSync(path.dirname(outPath), { recursive: true });
await pres.writeFile({ fileName: outPath });
console.log(`Successfully composed ${imagePaths.length} slide(s) to ${outPath}`);
