#!/usr/bin/env node
/**
 * Document IR JSON → editable PPTX (pptxgenjs fallback when python-pptx unavailable).
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';

const inlineModule = await import(
  path.resolve(process.cwd(), 'dist/src/saas/document-export/markdownInline.js')
).catch(() => null);
const normalizeMarkdownInline = inlineModule?.normalizeMarkdownInline ?? ((text) => String(text ?? ''));

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const irPath = readArg('--ir');
const output = readArg('--output');
if (!irPath || !output) {
  console.error('Usage: ir-to-pptx.mjs --ir <ir.json> --output <file.pptx>');
  process.exit(1);
}

const ir = JSON.parse(readFileSync(path.resolve(irPath), 'utf8'));
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';

let slideTitle = ir.title || 'Presentation';
let bodyLines = [];

function flushSlide() {
  if (bodyLines.length === 0) return;
  const slide = pres.addSlide();
  slide.addText(normalizeMarkdownInline(slideTitle), {
    x: 0.5,
    y: 0.35,
    w: 12.3,
    h: 0.9,
    fontSize: 28,
    bold: true,
    color: '363636',
  });
  slide.addText(bodyLines.map((line) => normalizeMarkdownInline(line)).join('\n'), {
    x: 0.5,
    y: 1.35,
    w: 12.3,
    h: 5.8,
    fontSize: 18,
    color: '363636',
    valign: 'top',
  });
  bodyLines = [];
}

for (const block of ir.blocks || []) {
  switch (block.type) {
    case 'slideBreak':
      flushSlide();
      break;
    case 'heading':
      flushSlide();
      slideTitle = block.text || slideTitle;
      break;
    case 'paragraph':
      bodyLines.push(block.text || '');
      break;
    case 'blockquote':
      bodyLines.push(block.text || '');
      break;
    case 'list':
      for (const item of block.items || []) {
        bodyLines.push(block.ordered ? `${item}` : `• ${item}`);
      }
      break;
    case 'table': {
      flushSlide();
      const slide = pres.addSlide();
      const headers = block.headers || [];
      const rows = block.rows || [];
      const text = normalizeMarkdownInline(
        (headers.length ? headers.join(' | ') + '\n' : '') +
        rows.map((row) => row.join(' | ')).join('\n'),
      );
      slide.addText(text, {
        x: 0.5,
        y: 0.8,
        w: 12.3,
        h: 6,
        fontSize: 14,
        color: '363636',
        valign: 'top',
      });
      break;
    }
    case 'image':
    case 'chartImage': {
      const imagePath = block.resolvedPath;
      if (!imagePath) break;
      flushSlide();
      const slide = pres.addSlide();
      slide.addImage({
        path: imagePath,
        x: 0.5,
        y: 0.5,
        w: 12.3,
        h: 6.5,
        sizing: { type: 'contain', w: 12.3, h: 6.5 },
      });
      break;
    }
    default:
      break;
  }
}

flushSlide();
if (pres.slides.length === 0) {
  const slide = pres.addSlide();
  slide.addText(normalizeMarkdownInline(slideTitle), { x: 0.5, y: 0.35, w: 12.3, h: 0.9, fontSize: 28, bold: true });
  slide.addText('(empty)', { x: 0.5, y: 1.35, w: 12.3, h: 5.8, fontSize: 18 });
}

const outPath = path.resolve(output);
mkdirSync(path.dirname(outPath), { recursive: true });
await pres.writeFile({ fileName: outPath });
console.log(outPath);
