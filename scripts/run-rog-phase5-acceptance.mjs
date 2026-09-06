#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 5): offline acceptance orchestrator */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'artifacts', 'rog-phase5-acceptance');
const reportPath = path.join(reportDir, 'suite-log.jsonl');

const steps = [
  ['rog-phase5:unit', 'npm', ['run', 'test:rog-phase5:unit']],
  ['rog-phase5:integration', 'npm', ['run', 'test:rog-phase5:integration']],
  ['goal-loop-acceptance', 'npm', ['run', 'test:goal-loop:acceptance']],
];

function runStep(name, cmd, args) {
  console.log(`\n[rog-phase5:acceptance] ${name}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  const ok = (result.status ?? 1) === 0;
  fs.mkdirSync(reportDir, { recursive: true });
  fs.appendFileSync(reportPath, `${JSON.stringify({ name, ok, at: new Date().toISOString() })}\n`);
  return ok;
}

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, '', 'utf8');

const failed = [];
for (const [name, cmd, args] of steps) {
  if (!runStep(name, cmd, args)) failed.push(name);
}

if (failed.length > 0) {
  console.error('[rog-phase5:acceptance] failed:', failed.join(', '));
  process.exit(1);
}
console.log('[rog-phase5:acceptance] passed');
