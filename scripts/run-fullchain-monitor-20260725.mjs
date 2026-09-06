#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 全链路深度监控编排 — ES9 失败案 + 流程模板 + 四线门禁
 * 输出: artifacts/fullchain-monitor-20260725/summary.json + 各阶段日志
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'fullchain-monitor-20260725');
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:7990';

fs.mkdirSync(OUT_DIR, { recursive: true });

const stages = [];

function runStage(id, name, cmd, args, extraEnv = {}) {
  const logPath = path.join(OUT_DIR, `${id}.log`);
  const started = Date.now();
  console.log(`\n[monitor] ▶ ${id}: ${name}`);
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
  const combined = `[exit=${result.status ?? 1}] elapsed=${elapsedMs}ms\n\n--- stdout ---\n${stdout}\n\n--- stderr ---\n${stderr}`;
  fs.writeFileSync(logPath, combined, 'utf8');
  const ok = result.status === 0;
  const entry = { id, name, ok, exitCode: result.status ?? 1, elapsedMs, logPath: path.relative(REPO_ROOT, logPath) };
  stages.push(entry);
  console.log(`[monitor] ${ok ? 'PASS' : 'FAIL'} ${id} (${(elapsedMs / 1000).toFixed(1)}s)`);
  return entry;
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
fs.writeFileSync(path.join(OUT_DIR, 'health.json'), JSON.stringify({ serverUrl: SERVER_URL, ...health, at: new Date().toISOString() }, null, 2));

// ── Phase A: 离线修复校验（ES9 + 四线 + 澄清门控） ──
runStage('A1-es9-five-replay', 'ES9 五案 SDM/清单 replay', 'npm', ['run', 'test:es9:five-case-replay']);
runStage('A2-es9-repair-loop', 'ES9 repair-loop 四案', 'npx', ['vitest', 'run', 'tests/es9-repair-loop-four-case.test.ts']);
runStage('A3-four-line-audit', '四线 audit 门禁', 'npm', ['run', 'test:four-line-audit']);
runStage('A4-export-parity', 'HTML 导出四线 parity', 'npm', ['run', 'test:export-four-line-parity']);
runStage('A5-fix-unit', '本次修复单测簇', 'npx', [
  'vitest', 'run',
  'src/context/budget/ToolResultBudget.test.ts',
  'src/saas/deliverables/filterVerifiedForContractBinding.test.ts',
  'src/saas/deliverables/sdmSlotMatching.test.ts',
  'tests/saas/clarification-gate.test.ts',
  'src/saas/deliverables/buildDeliverableSummaryRows.test.ts',
]);

// ── Phase B: 流程模板 / 历史失败案 CLI 场景 ──
runStage('B1-dialogue-process-templates', '对话稳定性·流程模板套件', 'npm', ['run', 'test:dialogue-stability:process-templates']);
runStage('B2-dialogue-historical', '对话稳定性·历史失败案', 'npm', ['run', 'test:dialogue-stability:historical']);
runStage('B3-wuyutai-replay', '吴裕泰五案 SDM replay', 'npx', ['vitest', 'run', 'src/saas/taskState/sessionDeliverableManifest.test.ts', '-t', 'wuyutai']);

// ── Phase C: Gateway 结构门禁 + 抽样实机（需 dev:saas） ──
if (health.ok) {
  runStage('C1-four-line-structure', '0717 四线 structure-only', 'npm', ['run', 'test:0717-four-line-live', '--', '--structure-only', '--gate']);
  runStage('C2-four-line-live-p0', '0717 四线 P0 Gateway 实机', 'npm', ['run', 'test:0717-four-line-live', '--', '--tier', 'p0', '--workers=1', '--gate'], {
    MONITOR_TIMEOUT_MS: '3600000',
  });
} else {
  stages.push({ id: 'C-skip', name: 'Gateway 实机跳过（Bridge 未就绪）', ok: false, skipped: true });
}

const summary = {
  generatedAt: new Date().toISOString(),
  serverUrl: SERVER_URL,
  health,
  stages,
  passCount: stages.filter((s) => s.ok).length,
  failCount: stages.filter((s) => !s.ok && !s.skipped).length,
  totalElapsedMs: stages.reduce((a, s) => a + (s.elapsedMs ?? 0), 0),
};
fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`\n[monitor] 完成: ${summary.passCount} PASS / ${summary.failCount} FAIL → ${path.relative(REPO_ROOT, OUT_DIR)}/summary.json`);
process.exit(summary.failCount > 0 ? 1 : 0);
