#!/usr/bin/env node
// PD-SAAS-FORK: list largest ui/dist assets for bundle triage (no rollup-plugin-visualizer dep).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

if (!fs.existsSync(distDir)) {
  console.error('[analyze-ui-bundle] ui/dist missing — run: npm --workspace ui run build');
  process.exit(1);
}

const rows = walkFiles(distDir)
  .filter((filePath) => !filePath.endsWith('.gz') && !filePath.endsWith('.br'))
  .map((filePath) => ({
    rel: path.relative(distDir, filePath).replace(/\\/g, '/'),
    bytes: fs.statSync(filePath).size,
    br: fs.existsSync(`${filePath}.br`) ? fs.statSync(`${filePath}.br`).size : null,
    gz: fs.existsSync(`${filePath}.gz`) ? fs.statSync(`${filePath}.gz`).size : null,
  }))
  .sort((a, b) => b.bytes - a.bytes);

const totalRaw = rows.reduce((sum, row) => sum + row.bytes, 0);
console.log(`[analyze-ui-bundle] ${rows.length} files, raw total ${formatKb(totalRaw)}\n`);
console.log('rank | raw      | br       | gzip     | path');
console.log('-----+----------+----------+----------+-----');

for (const [index, row] of rows.slice(0, 40).entries()) {
  const rank = String(index + 1).padStart(4, ' ');
  const raw = formatKb(row.bytes).padStart(8, ' ');
  const br = row.br == null ? '     —   ' : formatKb(row.br).padStart(8, ' ');
  const gz = row.gz == null ? '     —   ' : formatKb(row.gz).padStart(8, ' ');
  console.log(`${rank} | ${raw} | ${br} | ${gz} | ${row.rel}`);
}

const appShell = rows.find((row) => /AppShellV2-.*\.js$/i.test(row.rel));
if (appShell) {
  console.log('\nAppShell chunk:');
  console.log(`  raw ${formatKb(appShell.bytes)} | br ${appShell.br ? formatKb(appShell.br) : '—'} | gzip ${appShell.gz ? formatKb(appShell.gz) : '—'}`);
}
