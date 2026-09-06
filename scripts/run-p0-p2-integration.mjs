#!/usr/bin/env node
/** PD-SAAS-FORK: P0-P2 integration test orchestrator */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;

function run(label, args) {
  const r = spawnSync(node, args, { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`[p0-p2-integration] FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
  console.log(`[p0-p2-integration] PASS: ${label}`);
}

run('deliverable integrity', ['scripts/integration-deliverable-integrity.mjs']);
run('task resilience acceptance', ['scripts/run-task-resilience-acceptance.mjs']);
run('capability session binding', ['scripts/integration-capability-session-binding.mjs']);
run('deliverable repair bridge', ['scripts/integration-deliverable-repair-bridge.mjs']);
run('resume context API', ['scripts/integration-resume-context.mjs']);
run('prelaunch skill live gate', ['scripts/integration-prelaunch-skill-live.mjs']);
console.log('[p0-p2-integration] complete');
