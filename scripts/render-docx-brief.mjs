#!/usr/bin/env node
/**
 * Render a minimal campaign brief .docx (smoke + template).
 * Usage: node scripts/render-docx-brief.mjs [--out path] [--title "标题"]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

const args = process.argv.slice(2);
function readArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

const outPath = path.resolve(readArg('--out', 'artifacts/docx-smoke/sample-brief.docx'));
const title = readArg('--title', '传播活动 Brief（示例）');

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 24 } } },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun(title)],
        }),
        new Paragraph({
          children: [new TextRun('由 PilotDeck anth-docx 技能生成 · 可直接在 Word/WPS 中编辑')],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun('1. 背景与目标')], }),
        new Paragraph({
          children: [
            new TextRun(
              '【在此填写：为什么做这次传播、要达成什么可衡量目标（曝光/线索/转化等）】',
            ),
          ],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun('2. 目标人群')] }),
        new Paragraph({
          children: [new TextRun('【在此填写：核心受众画像、场景、痛点】')],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun('3. 核心信息')] }),
        new Paragraph({
          children: [new TextRun('【在此填写：一句话主张 + 3 条支撑点】')],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun('4. 渠道与节奏')] }),
        new Paragraph({
          children: [new TextRun('【在此填写：渠道组合、发布时间、负责人】')],
        }),
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun('5. 交付物清单')] }),
        new Paragraph({
          children: [
            new TextRun('【通稿 Word / 海报 HTML / 社媒帖 / 短视频脚本等，并标注文件路径】'),
          ],
        }),
        new Paragraph({
          spacing: { before: 360 },
          alignment: AlignmentType.RIGHT,
          children: [new TextRun(`生成时间：${new Date().toISOString().slice(0, 10)}`)],
        }),
      ],
    },
  ],
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log(`[render-docx-brief] wrote ${outPath} (${buffer.length} bytes)`);
