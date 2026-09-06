#!/usr/bin/env node
/**
 * Tier 2 Launch smoke orchestrator (L1–L8 subset runnable offline).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts', 'launch-smoke', 'smoke-launch-report.json');

const STEPS = [
  { id: 'L1', cmd: 'node', args: ['scripts/ui-launch-hub-isolation-check.mjs'] },
  { id: 'L2-L8', cmd: 'node', args: ['scripts/ui-launch-html-ppt-check.mjs'] },
];

async function run() {
  const report = { startedAt: new Date().toISOString(), steps: [], ok: true };

  for (const step of STEPS) {
    const started = Date.now();
    const result = spawnSync(step.cmd, step.args, { cwd: ROOT, encoding: 'utf8', shell: true });
    const ok = result.status === 0;
    report.steps.push({
      id: step.id,
      ok,
      exitCode: result.status,
      durationMs: Date.now() - started,
      stderr: (result.stderr || '').slice(-500),
    });
    if (!ok) report.ok = false;
  }

  report.finishedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[smoke:launch] ok=${report.ok}`);
  if (!report.ok) process.exitCode = 1;
}

run().catch((error) => {
  console.error('[smoke:launch] error:', error);
  process.exitCode = 1;
});
