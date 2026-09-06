#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 5): live batch gate — requires dev:saas + JSONL exports */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const jsonlPath = process.argv.find((arg) => arg.startsWith('--jsonl='))?.slice('--jsonl='.length);

if (!jsonlPath) {
  console.log('[rog-phase5:live] Pass --jsonl=path/to/session.jsonl after Gateway rerun.');
  console.log('[rog-phase5:live] Optional: --gate for hard KPI exit codes.');
  process.exit(gate ? 1 : 0);
}

const analyze = spawnSync(
  'node',
  ['scripts/analyze-rog-batch-exports.mjs', jsonlPath, ...(gate ? ['--gate'] : [])],
  { cwd: root, stdio: 'inherit', shell: true },
);
process.exit(analyze.status ?? 1);
