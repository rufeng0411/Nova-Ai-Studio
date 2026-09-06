#!/usr/bin/env node
/**
 * Resilience smoke — budget, outbound gate, config resolver (no live dev server).
 * Run via: npx tsx scripts/integration-resilience-smoke.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

async function runRecoveryBudgetTest() {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(npxCmd, ['tsx', '--test', 'tests/saas/resilience/recoveryBudget.test.ts'], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`recoveryBudget test exited ${code ?? 'null'}`));
    });
  });
}

async function main() {
  await runRecoveryBudgetTest();

  const { RecoveryBudget } = await import(
    pathToFileURL(resolve(repoRoot, 'src/saas/resilience/recoveryBudget.ts')).href
  );
  const { OutboundGate, resetSharedOutboundGateForTests } = await import(
    pathToFileURL(resolve(repoRoot, 'src/saas/resilience/outboundGate.ts')).href
  );
  const { resolveResilienceConfig } = await import(
    pathToFileURL(resolve(repoRoot, 'src/pilot/config/resolveResilienceConfig.ts')).href
  );

  const budget = new RecoveryBudget(12, 3);
  assert.equal(budget.tryConsume('tool_recovery')?.budgetRemaining, 11);

  resetSharedOutboundGateForTests();
  const gate = new OutboundGate(2);
  let active = 0;
  let maxActive = 0;
  const tasks = Array.from({ length: 5 }, () =>
    gate.run(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 30));
      active -= 1;
    }),
  );
  await Promise.all(tasks);
  assert.ok(maxActive <= 2, `expected gate max 2 concurrent, saw ${maxActive}`);

  const cfg = resolveResilienceConfig();
  assert.equal(cfg.maxRecoveryBudgetPerTurn, 8);
  assert.equal(cfg.recoverableMaxPerTurn, 12);
  assert.equal(cfg.hardFailMaxPerTurn, 3);
  assert.equal(cfg.outboundMaxConcurrent, 3);
  assert.equal(cfg.imageMaxConcurrent, 2);
  assert.equal(cfg.outboundFetchRetries, 1);
  assert.equal(cfg.toolFailureRepeatGuard, true);
  assert.equal(cfg.autoContinueStrict, false);

  console.log('[smoke:resilience] OK');
}

main().catch((error) => {
  console.error('[smoke:resilience] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
