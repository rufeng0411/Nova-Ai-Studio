#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Goal Loop Phase 5 strict load (L1–L6).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'artifacts', 'goal-loop-acceptance');
const serverUrl = process.env.SERVER_URL || 'http://127.0.0.1:7990';

const steps = [
  ['L1-smoke', 'node', ['scripts/load/http-load.mjs', '--scenario', 'smoke'], { SERVER_URL: serverUrl }],
  ['L2-stress', 'node', ['scripts/load/http-load.mjs', '--scenario', 'stress'], { SERVER_URL: serverUrl }],
  ['L3-spike', 'node', ['scripts/load/http-load.mjs', '--scenario', 'spike'], { SERVER_URL: serverUrl }],
  ['L4-multi-user', 'npm', ['run', 'test:multi-user:sim']],
  ['L5-saas-deep', 'npm', ['run', 'test:saas:deep']],
];

function run(name, cmd, args, extraEnv = {}) {
  console.log(`\n[goal-loop:final-load] ${name}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  return (result.status ?? 1) === 0;
}

fs.mkdirSync(reportDir, { recursive: true });
const results = [];
for (const [name, cmd, args, env] of steps) {
  const ok = run(name, cmd, args, env ?? {});
  results.push({ name, ok, at: new Date().toISOString() });
  if (!ok) break;
}

const outPath = path.join(reportDir, `final-load-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outPath, `${JSON.stringify({ results, serverUrl }, null, 2)}\n`, 'utf8');

if (results.some((r) => !r.ok)) {
  console.error('[goal-loop:final-load] failed');
  process.exit(1);
}
console.log(`[goal-loop:final-load] passed → ${outPath}`);
