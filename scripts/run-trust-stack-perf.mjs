#!/usr/bin/env node
/**
 * PD-SAAS-FORK: M-alpha trust-stack perf orchestration.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'trust-stack-perf');

function run(label, cmd, args, env = {}) {
  console.log(`\n[trust-stack:perf] ▶ ${label}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed exit=${result.status}`);
  }
}

function main() {
  run('history-messages:quick', 'npm', ['run', 'test:history-messages:quick']);
  run('bridge-stability:unit', 'npm', ['run', 'test:bridge-stability:unit']);
  run('bridge-stability:browse', 'npm', ['run', 'test:bridge-stability:browse'], {
    SERVER_URL: 'http://127.0.0.1:7990',
  });
  run('bridge-stability:smoke', 'npm', ['run', 'test:bridge-stability:smoke'], {
    SERVER_URL: 'http://127.0.0.1:7990',
  });
  run('projects-coalesce', 'npm', ['run', 'test:projects-coalesce'], {
    SERVER_URL: 'http://127.0.0.1:7990',
  });
  run('task-pattern:replay', 'npm', ['run', 'test:task-pattern:replay', '--', '--gate']);
  run('trust-stack:replay', 'npm', ['run', 'test:trust-stack:replay', '--', '--gate']);
  run('visual-binding:eight-cases', 'npm', ['run', 'test:visual-binding:eight-cases']);
  run('visual-asset-binding:acceptance', 'npm', ['run', 'test:visual-asset-binding:acceptance', '--', '--gate']);

  const skipE2e = process.env.TRUST_STACK_SKIP_E2E === '1';
  if (!skipE2e) {
    run('trust-stack-perf e2e', 'npx', [
      'playwright', 'test', 'ui/e2e/saas/trust-stack-perf.spec.ts',
      '-c', 'ui/playwright.config.ts',
    ], { VITE_URL: process.env.VITE_URL || 'http://127.0.0.1:8081' });
  } else {
    console.log('[trust-stack:perf] skip e2e (TRUST_STACK_SKIP_E2E=1)');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = {
    generatedAt: new Date().toISOString(),
    pass: true,
    steps: ['history', 'bridge-unit', 'browse', 'smoke', 'projects-coalesce', 'task-pattern', 'binding-acceptance', skipE2e ? 'e2e-skipped' : 'e2e'],
  };
  const out = path.join(OUT_DIR, `summary-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\n[trust-stack:perf] PASS → ${out}`);
}

try {
  main();
} catch (error) {
  console.error(`[trust-stack:perf] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
