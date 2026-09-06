#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8): 0707 error-task matrix static gate. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const exportDir = path.join(root, 'artifacts', '0707吴裕泰批次', 'exports');

const clusters = [
  { id: 'RC-LT-1', sessions: ['f8795d13', '433ce25a'], note: 'template execution contract' },
  { id: 'RC-LT-2', sessions: ['f8795d13'], note: 'campaign phase pass' },
  { id: 'RC-VID-1', sessions: ['3f1fe8e2', 'a53d03e1'], note: 'video model registry' },
  { id: 'RC-DONE-1', sessions: ['706c4514'], note: 'user ack stop' },
  { id: 'RC-DONE-2', sessions: ['433ce25a', '4a9605af'], note: 'malformed + ppt intermediate' },
  { id: 'RC-DONE-3', sessions: ['1dfeb5fd'], note: 'quality vs path (fixture only)' },
];

let failed = 0;
const results = [];

if (!fs.existsSync(exportDir)) {
  console.error('[fail] missing exports dir', exportDir);
  process.exit(1);
}

const htmlFiles = fs.readdirSync(exportDir).filter((f) => f.endsWith('.html'));

for (const cluster of clusters) {
  const matched = htmlFiles.filter((f) => cluster.sessions.some((s) => f.includes(s)));
  const ok = matched.length >= 1;
  results.push({ ...cluster, exportCount: matched.length, ok });
  if (!ok) {
    console.error(`[fail] ${cluster.id}: no export for ${cluster.sessions.join(',')}`);
    failed += 1;
  }
}

const analyze = spawnSync('node', [path.join(root, 'scripts', 'analyze-rog-batch-exports.mjs'), exportDir, '--jsonl'], {
  cwd: root,
  encoding: 'utf8',
});
if (analyze.status !== 0) {
  console.error('[fail] analyze-rog-batch-exports failed');
  failed += 1;
} else {
  const kpiPath = path.join(root, 'artifacts', '0707吴裕泰批次', 'kpi-baseline-0707.jsonl');
  if (fs.existsSync(kpiPath)) {
    const rowCount = fs.readFileSync(kpiPath, 'utf8').split(/\r?\n/).filter(Boolean).length;
    console.log(`[ok] kpi baseline ${kpiPath} (${rowCount} rows)`);
  } else {
    console.error('[fail] kpi-baseline-0707.jsonl not written');
    failed += 1;
  }
}

const logDir = path.join(root, 'artifacts', '0707吴裕泰批次', 'logs');
fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(
  path.join(logDir, 'error-task-matrix-summary.json'),
  JSON.stringify({ ok: failed === 0, results, at: new Date().toISOString() }, null, 2),
);

if (failed > 0 && gate) process.exit(1);
console.log(`[ok] Phase 8 error-task matrix (${failed} failures)`);
