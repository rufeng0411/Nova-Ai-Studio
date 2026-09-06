#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Replay GEO full-case fixture and compare intervention KPI vs baseline.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'dialogue-stability-final-review');
const BASELINE_PATH = path.join(ROOT, 'docs', 'recovery-baseline-wuyutai.json');

async function loadJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  // integration-geo-full-case-run.mjs imports a .ts module, so it must run under the
  // tsx loader (matching `test:geo-full-case:run`). Spawning plain `node` here crashed
  // with ERR_UNKNOWN_FILE_EXTENSION before the live run even started, leaving the KPI to
  // read a STALE geo-full-case-smoke-last.json. Use `--import tsx` so the child loads.
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/integration-geo-full-case-run.mjs'],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GEO_REPLAY_KPI: '1' } },
  );

  const lastReport = await loadJson(path.join(ROOT, 'artifacts', 'geo-full-case-smoke-last.json'), {});
  const baseline = await loadJson(BASELINE_PATH, {});

  const report = {
    at: new Date().toISOString(),
    geoRunExitCode: run.status ?? 1,
    geoRunStdoutTail: (run.stdout || '').slice(-2000),
    geoRunStderrTail: (run.stderr || '').slice(-2000),
    deliverables: lastReport.deliverables || null,
    recoveryAttempts: lastReport.run?.recoveryAttempts ?? null,
    durationMs: lastReport.run?.durationMs ?? null,
    baselineRecoveryEvents: baseline.recoveryEventCount ?? null,
    kpi: {
      requiredPass: lastReport.deliverables?.passCount ?? 0,
      requiredTotal: (lastReport.deliverables?.required || []).length,
      recoveryDelta: lastReport.run?.recoveryAttempts != null && baseline.recoveryEventCount != null
        ? lastReport.run.recoveryAttempts - baseline.recoveryEventCount
        : null,
    },
    passed:
      run.status === 0
      && (lastReport.deliverables?.missingCount ?? 1) === 0
      && (lastReport.run?.recoveryAttempts ?? 99) <= Number(process.env.GEO_REPLAY_MAX_RECOVERY || 12),
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'geo-replay-kpi-report.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

main().catch((error) => {
  console.error('[geo-replay-kpi]', error instanceof Error ? error.message : error);
  process.exit(1);
});
