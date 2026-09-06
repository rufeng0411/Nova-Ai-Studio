#!/usr/bin/env node
/**
 * PD-SAAS-FORK: M1-deep trust-stack orchestration (perf + load + stress + soak + memory).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'trust-stack-perf');

function run(label, cmd, args, env = {}) {
  console.log(`\n[trust-stack:deep] ▶ ${label}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) throw new Error(`${label} failed exit=${result.status}`);
}

function main() {
  run('trust-stack:perf', 'node', ['scripts/run-trust-stack-perf.mjs'], {
    TRUST_STACK_SKIP_E2E: process.env.TRUST_STACK_SKIP_E2E || '1',
  });
  run('bridge-stability:load', 'npm', ['run', 'test:bridge-stability:load'], {
    SERVER_URL: 'http://127.0.0.1:7990',
  });
  run('bridge-stability:stress', 'npm', ['run', 'test:bridge-stability:stress'], {
    SERVER_URL: 'http://127.0.0.1:7990',
  });
  run('bridge-stability:soak', 'npm', ['run', 'test:bridge-stability:soak'], {
    SERVER_URL: 'http://127.0.0.1:7990',
    BRIDGE_SOAK_DURATION_MS: process.env.BRIDGE_SOAK_DURATION_MS || '180000',
  });
  run('memory-leak:audit', 'npm', ['run', 'test:memory-leak:audit'], {
    SERVER_URL: 'http://127.0.0.1:7990',
    VITE_URL: process.env.VITE_URL || 'http://127.0.0.1:8081',
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const baseline = {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    note: 'M1-deep baseline placeholder — fill metrics from load/memory reports',
  };
  const out = path.join(OUT_DIR, `deep-baseline-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(out, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(`\n[trust-stack:deep] PASS → ${out}`);
}

try {
  main();
} catch (error) {
  console.error(`[trust-stack:deep] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
