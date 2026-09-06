#!/usr/bin/env node
/**
 * Document IR JSON → DOCX via docx package
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
} from 'docx';

const args = process.argv.slice(2);
function readArg(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const irPath = readArg('--ir');
const output = readArg('--output');
if (!irPath || !output) {
  console.error('Usage: ir-to-docx.mjs --ir <ir.json> --output <file.docx>');
  process.exit(1);
}

let markdownInlineToDocxRuns = null;
try {
  const inlineModule = await import(
    path.resolve(process.cwd(), 'dist/src/saas/document-export/markdownInline.js')
  );
  markdownInlineToDocxRuns = inlineModule.markdownInlineToDocxRuns;
} catch {
  markdownInlineToDocxRuns = null;
}

function plainRuns(text) {
  const value = String(text ?? '').trim();
  return value ? [new TextRun(value)] : [new TextRun('')];
}

function inlineRuns(text) {
  if (!markdownInlineToDocxRuns) return plainRuns(text);
  const runs = markdownInlineToDocxRuns(String(text ?? ''));
  if (!runs.length) return plainRuns(text);
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italics,
        font: run.font,
      }),
  );
}

const ir = JSON.parse(readFileSync(path.resolve(irPath), 'utf8'));
const children = [];

for (const block of ir.blocks || []) {
  switch (block.type) {
    case 'heading': {
      const levels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ];
      children.push(
        new Paragraph({
          heading: levels[Math.min(Math.max(block.level, 1), 6) - 1],
          children: inlineRuns(block.text),
        }),
      );
      break;
    }
    case 'paragraph':
      children.push(new Paragraph({ children: inlineRuns(block.text) }));
      break;
    case 'blockquote':
      children.push(
        new Paragraph({
          indent: { left: 480 },
          children: inlineRuns(block.text),
        }),
      );
      break;
    case 'list':
      for (const item of block.items || []) {
        children.push(
          new Paragraph({
            children: inlineRuns(`${block.ordered ? '•' : '–'} ${item}`),
          }),
        );
      }
      break;
    case 'code':
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.text || '',
              font: 'Consolas',
            }),
          ],
        }),
      );
      break;
    case 'table': {
      const rows = [
        new TableRow({
          children: (block.headers || []).map(
            (h) =>
              new TableCell({
                width: { size: 2400, type: WidthType.DXA },
                children: [new Paragraph({ children: inlineRuns(h) })],
              }),
          ),
        }),
        ...(block.rows || []).map(
          (row) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [new Paragraph({ children: inlineRuns(String(cell)) })],
                  }),
              ),
            }),
        ),
      ];
      children.push(new Table({ rows }));
      break;
    }
    case 'image':
      if (block.resolvedPath && !block.resolvedPath.startsWith('http')) {
        try {
          const data = readFileSync(block.resolvedPath);
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data,
                  transformation: { width: 420, height: 280 },
                }),
              ],
            }),
          );
        } catch {
          children.push(new Paragraph({ children: inlineRuns(`[image: ${block.src}]`) }));
        }
      }
      break;
    case 'chartImage':
      if (block.resolvedPath) {
        try {
          const data = readFileSync(block.resolvedPath);
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data,
                  transformation: { width: 480, height: 300 },
                }),
              ],
            }),
          );
        } catch {
          /* skip */
        }
      }
      break;
    case 'videoLink':
      children.push(
        new Paragraph({
          children: inlineRuns(`视频: ${block.href}`),
        }),
      );
      break;
    case 'pageBreak':
      children.push(new Paragraph({ children: [new TextRun('')], pageBreakBefore: true }));
      break;
    default:
      break;
  }
}

const doc = new Document({
  sections: [{ children: children.length > 0 ? children : [new Paragraph('')] }],
});
const buffer = await Packer.toBuffer(doc);
writeFileSync(path.resolve(output), buffer);
console.log(path.resolve(output));
