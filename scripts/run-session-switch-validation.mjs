#!/usr/bin/env node
/**
 * PD-SAAS-FORK: orchestrate session-switch validation tiers (L1–L7 subset).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'session-switch-validation');

const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith('--tier='))?.split('=')[1] ?? 'all';
const skipSoak = args.includes('--skip-soak');

const tiers = {
  1: [
    ['npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/sessionDeliverablePipeline.test.ts', 'src/shared/sdmProgressDockParity.test.ts']],
    ['node', ['--test', 'tests/server/turnConcurrencyGate.test.mjs', 'tests/server/loginRateLimit.test.mjs']],
  ],
  2: [
    ['npm', ['run', 'test:deliverable-triple-unify']],
    ['npm', ['run', 'test:display-engine-alignment']],
  ],
  3: [
    ['npm', ['run', 'test:bridge-stability:browse']],
    ...(skipSoak ? [] : [['npm', ['run', 'test:bridge-stability:load']]]),
  ],
  4: [
    ['node', ['scripts/check-white-screen.mjs', process.env.VITE_URL ? `${process.env.VITE_URL}/p/general` : 'http://127.0.0.1:8081/p/general']],
    ['npx', ['playwright', 'test', '-c', 'ui/playwright.config.ts', 'ui/e2e/saas/session-switch-perf.spec.ts', 'ui/e2e/saas/session-switch-clickthrough.spec.ts', '--workers=1']],
  ],
  5: [
    ['npm', ['run', 'test:memory-leak:audit']],
    ['node', ['scripts/diag/session-switch-profile.mjs']],
  ],
  7: [
    ['npm', ['run', 'test:pre-production:offline']],
  ],
};

function runStep(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  return result.status === 0;
}

const selected = tierArg === 'all' ? Object.keys(tiers) : [tierArg];
const results = [];

for (const tier of selected) {
  const steps = tiers[tier];
  if (!steps) continue;
  for (const [cmd, cmdArgs] of steps) {
    const ok = runStep(cmd, cmdArgs);
    results.push({ tier, cmd: `${cmd} ${cmdArgs.join(' ')}`, ok });
    if (!ok) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(OUT_DIR, 'load-summary.json'),
        JSON.stringify({ failedAt: results[results.length - 1], results }, null, 2),
      );
      process.exit(1);
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'load-summary.json'), JSON.stringify({ ok: true, results }, null, 2));
console.log('[session-switch-validation] all selected tiers passed');
