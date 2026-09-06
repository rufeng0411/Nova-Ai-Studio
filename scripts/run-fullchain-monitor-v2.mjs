#!/usr/bin/env node
/**
 * PD-SAAS-FORK: fullchain monitor v2 — offline quick by default (SKIP_LIVE=1).
 * LIVE_TIER=p0|es9|all enables Gateway phases.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', `fullchain-monitor-${stamp}`);
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:7990';
const SKIP_LIVE = process.env.SKIP_LIVE !== '0';
const LIVE_TIER = process.env.LIVE_TIER || '';

fs.mkdirSync(OUT_DIR, { recursive: true });

const stages = [];

function runStage(id, name, cmd, args, extraEnv = {}) {
  const logPath = path.join(OUT_DIR, `${id}.log`);
  const started = Date.now();
  console.log(`\n[monitor-v2] ▶ ${id}: ${name}`);
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, SERVER_URL, ...extraEnv },
    timeout: extraEnv.MONITOR_TIMEOUT_MS ? Number(extraEnv.MONITOR_TIMEOUT_MS) : 1_800_000,
  });
  const elapsedMs = Date.now() - started;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  fs.writeFileSync(
    logPath,
    `[exit=${result.status ?? 1}] elapsed=${elapsedMs}ms\n\n--- stdout ---\n${stdout}\n\n--- stderr ---\n${stderr}`,
    'utf8',
  );
  const ok = result.status === 0;
  stages.push({ id, name, ok, exitCode: result.status ?? 1, elapsedMs, logPath: path.relative(REPO_ROOT, logPath) });
  console.log(`[monitor-v2] ${ok ? 'PASS' : 'FAIL'} ${id} (${(elapsedMs / 1000).toFixed(1)}s)`);
  return ok;
}

async function probeHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/api/saas/health/ready`, { signal: AbortSignal.timeout(8000) });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const health = await probeHealth();
fs.writeFileSync(
  path.join(OUT_DIR, 'health.json'),
  JSON.stringify({ serverUrl: SERVER_URL, skipLive: SKIP_LIVE, liveTier: LIVE_TIER, ...health, at: new Date().toISOString() }, null, 2),
);

// Phase A: offline
runStage('A1-es9-five-replay', 'ES9 五案 SDM replay', 'npm', ['run', 'test:es9:five-case-replay']);
runStage('A2-four-line-audit', '四线 audit 门禁', 'npm', ['run', 'test:four-line-audit']);
runStage('A3-export-parity', 'HTML 导出四线 parity', 'npm', ['run', 'test:export-four-line-parity']);
runStage('A4-resolve-timeout', 'resolveLiveTimeout 单测', 'npm', ['run', 'test:resolve-live-timeout']);
runStage('A5-fix-unit', 'ES9/澄清/四线单测簇', 'npx', [
  'vitest', 'run',
  'src/context/budget/ToolResultBudget.test.ts',
  'src/saas/deliverables/filterVerifiedForContractBinding.test.ts',
  'tests/saas/clarification-gate.test.ts',
]);

// Phase B: dialogue stability (offline)
runStage('B1-dialogue-process-templates', '对话稳定性·流程模板', 'npm', ['run', 'test:dialogue-stability:process-templates']);
runStage('B2-dialogue-historical', '对话稳定性·历史失败案', 'npm', ['run', 'test:dialogue-stability:historical']);

const runLive = !SKIP_LIVE || LIVE_TIER;
if (runLive && health.ok) {
  runStage('C1-four-line-structure', '0717 structure-only', 'npm', ['run', 'test:0717-four-line-live', '--', '--structure-only', '--gate']);

  if (LIVE_TIER === 'p0' || LIVE_TIER === 'all') {
    runStage('C2-four-line-live-p0', '0717 P0 Gateway', 'npm', ['run', 'test:0717-four-line-live', '--', '--tier', 'p0', '--workers=1', '--gate'], {
      MONITOR_TIMEOUT_MS: '7200000',
    });
  }
  if (LIVE_TIER === 'es9' || LIVE_TIER === 'all') {
    runStage('C3-es9-four-format-live', 'ES9 四格式 Gateway', 'npm', ['run', 'test:es9:four-format-live:gate'], {
      MONITOR_TIMEOUT_MS: '3600000',
    });
  }
} else if (runLive && !health.ok) {
  stages.push({ id: 'C-skip', name: 'Gateway 实机跳过（Bridge 未就绪）', ok: false, skipped: true });
} else {
  stages.push({ id: 'C-skipped-offline', name: 'Gateway 实机跳过（SKIP_LIVE=1 默认）', ok: true, skipped: true });
}

const summary = {
  generatedAt: new Date().toISOString(),
  serverUrl: SERVER_URL,
  skipLive: SKIP_LIVE,
  liveTier: LIVE_TIER || null,
  health,
  stages,
  passCount: stages.filter((s) => s.ok).length,
  failCount: stages.filter((s) => !s.ok && !s.skipped).length,
  totalElapsedMs: stages.reduce((a, s) => a + (s.elapsedMs ?? 0), 0),
};
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`\n[monitor-v2] ${summary.passCount} PASS / ${summary.failCount} FAIL → ${path.relative(REPO_ROOT, OUT_DIR)}/summary.json`);
process.exit(summary.failCount > 0 ? 1 : 0);
