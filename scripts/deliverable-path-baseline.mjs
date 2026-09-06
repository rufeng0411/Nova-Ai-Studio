#!/usr/bin/env node
/**
 * PD-SAAS-FORK: snapshot resolve behavior for deliverable collision fixture.
 * Usage: node scripts/deliverable-path-baseline.mjs [--write-doc]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utimesSync } from 'node:fs';
import { resolveProjectDeliverableFile } from '../ui/server/utils/pathInProject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests/fixtures/deliverable-collision');

function touchMtimes() {
  const taskA = path.join(FIXTURE_ROOT, 'artifacts/task-a/index.html');
  const taskB = path.join(FIXTURE_ROOT, 'artifacts/task-b/index.html');
  const base = Date.now() / 1000;
  utimesSync(taskA, base, base);
  utimesSync(taskB, base, base + 30);
}

const QUERIES = [
  { label: 'bare index.html (no hint)', filePath: 'index.html' },
  { label: 'bare index.html + hintDir task-a', filePath: 'index.html', hintDir: 'artifacts/task-a' },
  { label: 'bare index.html + hintDir task-b', filePath: 'index.html', hintDir: 'artifacts/task-b' },
  { label: 'full task-a path', filePath: 'artifacts/task-a/index.html' },
  { label: 'full task-b path', filePath: 'artifacts/task-b/index.html' },
  { label: 'bare slide-01.png (no hint)', filePath: 'slide-01.png' },
  { label: 'slide-01.png + hint deck-a', filePath: 'slide-01.png', hintDir: 'artifacts/slides-deck-a' },
  { label: 'slide-01.png + hint deck-b', filePath: 'slide-01.png', hintDir: 'artifacts/slides-deck-b' },
  { label: 'full deck-a slide', filePath: 'artifacts/slides-deck-a/slide-01.png' },
  { label: 'full deck-b slide', filePath: 'artifacts/slides-deck-b/slide-01.png' },
  { label: 'bare slide-manifest.json', filePath: 'slide-manifest.json' },
  { label: 'slide-manifest + hint deck-b', filePath: 'slide-manifest.json', hintDir: 'artifacts/slides-deck-b' },
];

function runMatrix() {
  touchMtimes();
  return QUERIES.map((q) => {
    const options = q.hintDir ? { hintDir: q.hintDir } : {};
    const result = resolveProjectDeliverableFile(FIXTURE_ROOT, q.filePath, [FIXTURE_ROOT], options);
    return { ...q, result };
  });
}

function formatReport(rows) {
  const lines = [
    '# Deliverable path resolve baseline',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Fixture: \`tests/fixtures/deliverable-collision\``,
    '',
    '| Query | Result |',
    '| --- | --- |',
  ];
  for (const row of rows) {
    const hint = row.hintDir ? ` hintDir=${row.hintDir}` : '';
    const key = `\`${row.filePath}\`${hint}`;
    let val;
    if (resultOk(row.result)) {
      val = `\`${row.result.relativePath}\``;
    } else if (row.result.code === 'ambiguous_deliverable') {
      val = `409 ambiguous: ${(row.result.candidates || []).join(', ')}`;
    } else {
      val = row.result.error || 'not found';
    }
    lines.push(`| ${key} | ${val} |`);
  }
  lines.push('');
  lines.push('## Manual repro (general project)');
  lines.push('');
  lines.push('1. Task A: `write_file artifacts/collision-a/index.html`');
  lines.push('2. Task B: `write_file artifacts/collision-b/index.html`');
  lines.push('3. On task B deliverables: panel click, body link, go-folder must open `collision-b`.');
  return lines.join('\n');
}

function resultOk(result) {
  return Boolean(result?.ok);
}

const rows = runMatrix();
console.log(JSON.stringify(rows, null, 2));

if (process.argv.includes('--write-doc')) {
  const docPath = path.join(
    REPO_ROOT,
    'docs',
    `deliverable-path-baseline-${new Date().toISOString().slice(0, 10)}.md`,
  );
  fs.writeFileSync(docPath, formatReport(rows), 'utf8');
  console.log(`Wrote ${docPath}`);
}
