#!/usr/bin/env node
/** PD-SAAS-FORK: seed artifacts for document export smoke + Playwright */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'artifacts', 'document-export-fixtures');
const SLIDES_MINI = path.join(FIXTURES, 'slides-mini');
const ENTERPRISE_DECK = path.join(
  ROOT,
  'skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance/enterprise-ai-training-2026',
);

const MINI_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'base64',
);

async function writeIfMissing(filePath, content) {
  try {
    await fs.access(filePath);
    return false;
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return true;
  }
}

async function main() {
  await fs.mkdir(FIXTURES, { recursive: true });

  await writeIfMissing(
    path.join(FIXTURES, 'sample-report.md'),
    `# Export Smoke Report

## Summary
This fixture validates **export_document** from Markdown.

| Metric | Value |
|--------|-------|
| Users | 1200 |
| Growth | 12% |

## Conclusion
Ready for PDF, Word, PPT, and Excel export.
`,
  );

  await writeIfMissing(
    path.join(FIXTURES, 'sample-simple.html'),
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/><title>Simple</title>
<style>body{font-family:system-ui;margin:2rem;} table{border-collapse:collapse;} td,th{border:1px solid #ccc;padding:6px;}</style></head>
<body><h1>HTML Export Fixture</h1><p>Paragraph for PDF export.</p>
<table><tr><th>Col</th><th>Val</th></tr><tr><td>A</td><td>1</td></tr></table></body></html>`,
  );

  await writeIfMissing(
    path.join(FIXTURES, 'sample-table.csv'),
    'name,score,team\nAlice,92,Alpha\nBob,88,Beta\n',
  );

  await fs.mkdir(SLIDES_MINI, { recursive: true });
  const enterpriseSlides = [];
  try {
    for (const name of await fs.readdir(ENTERPRISE_DECK)) {
      if (/^slide-0[1-3]\.png$/i.test(name)) enterpriseSlides.push(name);
    }
    enterpriseSlides.sort();
  } catch {
    /* use tiny placeholder */
  }
  for (let i = 1; i <= 3; i += 1) {
    const name = `slide-${String(i).padStart(2, '0')}.png`;
    const dest = path.join(SLIDES_MINI, name);
    const enterpriseSrc = enterpriseSlides[i - 1]
      ? path.join(ENTERPRISE_DECK, enterpriseSlides[i - 1])
      : null;
    if (enterpriseSrc) {
      await fs.copyFile(enterpriseSrc, dest);
    } else {
      await writeIfMissing(dest, MINI_PNG);
    }
  }

  const manifest = {
    skill_version: '1.0.0',
    deck_title: 'Export Mini Deck',
    idea_prompt: 'fixture',
    preset_id: null,
    template_style: 'minimal',
    aspect_ratio: '16:9',
    language: 'zh',
    detail_level: 'standard',
    page_count: 3,
    pages: [1, 2, 3].map((n) => ({
      index: n,
      title: `Slide ${n}`,
      image_path: `slide-${String(n).padStart(2, '0')}.png`,
    })),
  };
  await writeIfMissing(path.join(SLIDES_MINI, 'slide-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('[generate-document-export-fixtures] OK →', FIXTURES);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
