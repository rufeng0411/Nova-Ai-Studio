#!/usr/bin/env node
/**
 * Nova Dev Launcher — consolidated test suite.
 *
 * Env:
 *   LAUNCHER_SKIP_SMOKE_BOOT=1  — skip full stack boot (~3–5 min)
 *   LAUNCHER_SKIP_ELECTRON=1    — skip Electron preload/UI probes
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const launcherRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(launcherRoot, '../..');

const shell = process.platform === 'win32';
const env = {
  ...process.env,
  NOVA_REPO_ROOT: repoRoot,
  NODE_ENV: 'production',
};

const results = [];

function runStep(name, command, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(command, args, {
    cwd: opts.cwd ?? launcherRoot,
    env: { ...env, ...opts.env },
    encoding: 'utf8',
    shell,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: opts.timeoutMs ?? 600_000,
  });
  const ms = Date.now() - started;
  const ok = r.status === 0;
  results.push({ name, ok, ms, stdout: tail(r.stdout), stderr: tail(r.stderr) });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[launcher-test] ${mark} ${name} (${(ms / 1000).toFixed(1)}s)`);
  if (!ok) {
    if (r.stdout?.trim()) console.log(r.stdout.trim());
    if (r.stderr?.trim()) console.error(r.stderr.trim());
  }
  return ok;
}

function tail(s, max = 2400) {
  if (!s) return '';
  return s.length <= max ? s : s.slice(-max);
}

function npm(args, opts) {
  return runStep(opts?.name ?? args.join(' '), 'npm', args, opts);
}

console.log('[launcher-test] Nova Dev Launcher consolidated suite');
console.log('[launcher-test] repo:', repoRoot);

let allOk = true;

allOk = npm(['run', 'build'], { name: 'build (main + renderer)', timeoutMs: 180_000 }) && allOk;
allOk = runStep('check-artifacts', 'node', ['scripts/check-artifacts.mjs']) && allOk;
allOk = runStep('test-supervisor', 'node', ['scripts/test-supervisor.mjs'], { timeoutMs: 120_000 }) && allOk;

if (process.env.LAUNCHER_SKIP_ELECTRON !== '1') {
  allOk =
    runStep('verify-preload', 'npx', ['electron', 'scripts/verify-preload.mjs'], {
      timeoutMs: 60_000,
    }) && allOk;
  allOk = runStep('verify-ui', 'npx', ['electron', 'scripts/verify-ui.mjs'], { timeoutMs: 60_000 }) && allOk;
} else {
  console.log('[launcher-test] SKIP verify-preload / verify-ui (LAUNCHER_SKIP_ELECTRON=1)');
}

if (process.env.LAUNCHER_SKIP_SMOKE_BOOT !== '1') {
  allOk =
    runStep('smoke-boot (full stack)', 'node', ['scripts/smoke-boot.mjs'], {
      timeoutMs: 420_000,
    }) && allOk;
} else {
  console.log('[launcher-test] SKIP smoke-boot (LAUNCHER_SKIP_SMOKE_BOOT=1)');
}

console.log('\n[launcher-test] ── summary ──');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.name} (${(r.ms / 1000).toFixed(1)}s)`);
}

if (!allOk) {
  console.error('\n[launcher-test] FAILED');
  process.exit(1);
}
console.log('\n[launcher-test] ALL PASSED');
