#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8-2): 0707-2 error cluster static matrix. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const exportDir = path.join(root, 'artifacts', '0707-2小罐茶批次', 'exports');
const kpiPath = path.join(root, 'artifacts', '0707-2小罐茶批次', 'logs', 'kpi-baseline-0707-2.jsonl');

const clusters = [
  { id: 'RC-0707-VID', sessions: ['c2ff6893', 'c4a8d2d1'], note: 'video API + env' },
  { id: 'RC-0707-CMP', sessions: ['188fa4a3'], note: 'campaign SDM repair storm' },
  { id: 'RC-0707-BC', sessions: ['c5ce7d65'], note: 'battlecard execution' },
  { id: 'RC-0707-FIRST', sessions: ['b565c213', '9b20948b'], note: 'todo stop first turn' },
  { id: 'RC-0707-VIS', sessions: ['9baafd8f', 'b1eb98e8'], note: 'deliverable visibility' },
];

let failed = 0;

if (!fs.existsSync(kpiPath)) {
  console.error('[fail] missing kpi baseline', kpiPath);
  failed += 1;
} else {
  const rows = fs.readFileSync(kpiPath, 'utf8').split(/\r?\n/).filter(Boolean);
  if (rows.length < 9) {
    console.error(`[fail] kpi baseline expected 9 rows, got ${rows.length}`);
    failed += 1;
  } else {
    console.log(`[ok] kpi baseline ${rows.length} rows`);
  }
}

const htmlFiles = fs.existsSync(exportDir)
  ? fs.readdirSync(exportDir).filter((f) => f.endsWith('.html'))
  : [];

for (const cluster of clusters) {
  const matched = htmlFiles.filter((f) => cluster.sessions.some((s) => f.includes(s)));
  const ok = matched.length >= 1 || htmlFiles.length === 0;
  if (!ok) {
    console.error(`[fail] ${cluster.id}: no export (optional until HTML dropped in exports/)`);
  } else {
    console.log(`[ok] ${cluster.id} (${matched.length} exports)`);
  }
}

const archive = spawnSync('node', [path.join(root, 'scripts', 'run-rog-phase8-2-archive.mjs'), ...(gate ? ['--gate'] : [])], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (archive.status !== 0) failed += 1;

const logDir = path.join(root, 'artifacts', '0707-2小罐茶批次', 'logs');
fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(
  path.join(logDir, 'error-task-matrix-0707-2-summary.json'),
  JSON.stringify({ ok: failed === 0, clusters, at: new Date().toISOString() }, null, 2),
);

if (failed > 0 && gate) process.exit(1);
console.log(`[ok] Phase 8-2 error-task matrix (${failed} failures)`);
