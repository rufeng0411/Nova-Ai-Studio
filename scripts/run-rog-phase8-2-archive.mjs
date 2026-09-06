#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8-2): 0707-2 小罐茶批次归档结构门禁 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const batchRoot = path.join(root, 'artifacts', '0707-2小罐茶批次');
const requiredDirs = ['exports', 'prompts', 'logs'];
const kpiPath = path.join(batchRoot, 'logs', 'kpi-baseline-0707-2.jsonl');
const readmePath = path.join(batchRoot, 'prompts', 'README.zh-CN.md');

const expectedSessions = [
  '9baafd8f',
  'b565c213',
  '9b20948b',
  'b680504d',
  'c5ce7d65',
  '188fa4a3',
  'c2ff6893',
  'c4a8d2d1',
  'b1eb98e8',
];

let failed = 0;

if (!fs.existsSync(batchRoot)) {
  console.error('[fail] missing batch root', batchRoot);
  process.exit(gate ? 1 : 0);
}

for (const dir of requiredDirs) {
  const abs = path.join(batchRoot, dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    console.error('[fail] missing directory', abs);
    failed += 1;
  }
}

if (!fs.existsSync(kpiPath)) {
  console.error('[fail] missing kpi baseline', kpiPath);
  failed += 1;
} else {
  const rows = fs.readFileSync(kpiPath, 'utf8').split(/\r?\n/).filter(Boolean);
  if (rows.length !== 9) {
    console.error(`[fail] kpi baseline expected 9 rows, got ${rows.length}`);
    failed += 1;
  }
  const prefixes = rows.map((line) => {
    try {
      return JSON.parse(line).sessionPrefix;
    } catch {
      return null;
    }
  });
  for (const session of expectedSessions) {
    if (!prefixes.includes(session)) {
      console.error('[fail] kpi missing sessionPrefix', session);
      failed += 1;
    }
  }
  const requiredFields = ['sessionPrefix', 'task', 'userTurns', 'lastAcceptanceStatus', 'repairCount', 'hasMp4', 'cluster'];
  for (const line of rows) {
    const row = JSON.parse(line);
    for (const field of requiredFields) {
      if (!(field in row)) {
        console.error('[fail] kpi row missing field', field, row.sessionPrefix);
        failed += 1;
        break;
      }
    }
  }
}

if (!fs.existsSync(readmePath)) {
  console.error('[fail] missing prompts readme', readmePath);
  failed += 1;
}

const exportDir = path.join(batchRoot, 'exports');
if (fs.existsSync(exportDir)) {
  const htmlCount = fs.readdirSync(exportDir).filter((f) => f.endsWith('.html')).length;
  console.log(`[info] exports html files: ${htmlCount}`);
}

fs.mkdirSync(path.join(batchRoot, 'logs'), { recursive: true });
fs.writeFileSync(
  path.join(batchRoot, 'logs', 'archive-check-summary.json'),
  JSON.stringify({ ok: failed === 0, failed, at: new Date().toISOString() }, null, 2),
);

if (failed > 0 && gate) process.exit(1);
console.log(`[ok] Phase 8-2 archive check (${failed} failures)`);
