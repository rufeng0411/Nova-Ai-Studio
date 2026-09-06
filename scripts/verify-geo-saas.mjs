#!/usr/bin/env node
/**
 * PD-SAAS-FORK: GEO Tab 全链路验收
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: true });
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr };
}

function main() {
  const steps = [
    ['npm', ['run', 'capabilities:gen']],
    ['node', ['scripts/integration-geo-hub-check.mjs']],
    ['npm', ['run', 'smoke:aigeo']],
    ['node', ['scripts/smoke-geo-monitor-report.mjs']],
    ['node', ['scripts/smoke-geo-dual-report.mjs']],
    ['node', ['scripts/smoke-geo-llm-coverage-required.mjs']],
    ['node', ['scripts/smoke-geo-report-design.mjs']],
    ['node', ['scripts/integration-admin-skills-tree-geo.mjs']],
    ['node', ['scripts/smoke-canonical-derived-deliverables.mjs']],
    ['npm', ['run', 'smoke:capability-hub']],
  ];
  let ok = true;
  for (const [cmd, args] of steps) {
    const label = `${cmd} ${args.join(' ')}`;
    const r = run(cmd, args);
    console.log(`[verify:geo-saas] ${label} → ${r.ok ? 'OK' : 'FAIL'}`);
    if (!r.ok) {
      ok = false;
      if (r.stderr) console.error(r.stderr.slice(0, 2000));
    }
  }
  if (!ok) process.exitCode = 1;
  console.log(`[verify:geo-saas] overall=${ok}`);
}

main();
