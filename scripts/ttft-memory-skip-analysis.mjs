#!/usr/bin/env node
/**
 * PD-SAAS-FORK: P2-2 — quantify first-turn memory skip from turn-timing.jsonl
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logPath = process.env.PILOTDECK_TTFT_LOG?.trim()
  || path.join(process.env.DATA_ROOT || path.join(root, '.saas-dev-data'), 'telemetry', 'turn-timing.jsonl');

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function parseJsonl(file) {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  return rows;
}

function stageMs(trace, stage) {
  const entry = (trace.stages || []).find((s) => s.name === stage || s.stage === stage);
  if (!entry) return null;
  if (typeof entry.durationMs === 'number') return entry.durationMs;
  if (typeof entry.ms === 'number') return entry.ms;
  if (typeof entry.endMs === 'number' && typeof entry.startMs === 'number') {
    return entry.endMs - entry.startMs;
  }
  return null;
}

function hasStage(trace, stage) {
  return (trace.stages || []).some((s) => s.name === stage || s.stage === stage);
}

function main() {
  spawnSync('npx', ['tsx', path.join(root, 'scripts', 'ttft-baseline.mjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const traces = parseJsonl(logPath);
  const bySession = new Map();
  for (const trace of traces) {
    const sessionId = trace.sessionId || trace.sessionKey || 'unknown';
    if (!bySession.has(sessionId)) bySession.set(sessionId, []);
    bySession.get(sessionId).push(trace);
  }

  const firstTurns = [];
  const laterTurns = [];
  for (const sessionTraces of bySession.values()) {
    sessionTraces.sort((a, b) => String(a.startedAt || a.turnId).localeCompare(String(b.startedAt || b.turnId)));
    sessionTraces.forEach((trace, index) => {
      if (index === 0) firstTurns.push(trace);
      else laterTurns.push(trace);
    });
  }

  const firstWithMemory = firstTurns.filter((t) => hasStage(t, 'turn.memory_retrieve')).length;
  const laterWithMemory = laterTurns.filter((t) => hasStage(t, 'turn.memory_retrieve')).length;

  const firstMemoryMs = firstTurns.map((t) => stageMs(t, 'turn.memory_retrieve')).filter((v) => v != null);
  const laterMemoryMs = laterTurns.map((t) => stageMs(t, 'turn.memory_retrieve')).filter((v) => v != null);
  const firstTotalMs = firstTurns.map((t) => t.totalMs).filter((v) => typeof v === 'number');
  const laterTotalMs = laterTurns.map((t) => t.totalMs).filter((v) => typeof v === 'number');

  const stamp = new Date().toISOString().slice(0, 10);
  const report = {
    generatedAt: new Date().toISOString(),
    logPath,
    sampleCount: traces.length,
    firstTurnCount: firstTurns.length,
    laterTurnCount: laterTurns.length,
    memoryRetrievePresence: {
      firstTurnWithStage: firstWithMemory,
      firstTurnTotal: firstTurns.length,
      laterTurnWithStage: laterWithMemory,
      laterTurnTotal: laterTurns.length,
      firstTurnSkipRate: firstTurns.length
        ? `${Math.round((1 - firstWithMemory / firstTurns.length) * 100)}%`
        : 'n/a',
    },
    memoryRetrieveMs: {
      firstTurn: { p50: percentile(firstMemoryMs, 50), p95: percentile(firstMemoryMs, 95), count: firstMemoryMs.length },
      laterTurn: { p50: percentile(laterMemoryMs, 50), p95: percentile(laterMemoryMs, 95), count: laterMemoryMs.length },
    },
    totalTurnMs: {
      firstTurn: { p50: percentile(firstTotalMs, 50), p95: percentile(firstTotalMs, 95) },
      laterTurn: { p50: percentile(laterTotalMs, 50), p95: percentile(laterTotalMs, 95) },
    },
    p2Implementation: {
      shouldSkipMemoryRetrievalForTurn: true,
      defaultTimeoutMs: 5000,
      note: '首 turn 应无 turn.memory_retrieve 阶段；若样本为 0 请先 dev:saas 跑若干对话再重跑',
    },
  };

  if (firstTotalMs.length && laterTotalMs.length) {
    const firstP95 = percentile(firstTotalMs, 95);
    const laterP95 = percentile(laterTotalMs, 95);
    if (firstP95 != null && laterP95 != null && laterP95 > 0) {
      const delta = ((laterP95 - firstP95) / laterP95) * 100;
      report.estimatedFirstTurnTtftBenefitPct = Math.round(delta * 10) / 10;
    }
  }

  const outJson = path.join(root, 'docs', `ttft-memory-skip-${stamp}.json`);
  const outMd = path.join(root, 'docs', `ttft-memory-skip-report-${stamp}.md`);
  mkdirSync(path.dirname(outJson), { recursive: true });
  writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = [
    `# TTFT 首 turn 跳过 memory 分析（${stamp}）`,
    '',
    `样本：**${report.sampleCount}** 条 turn-timing（${logPath}）`,
    '',
    '## 首 turn vs 后续 turn',
    '',
    '| 指标 | 首 turn | 后续 turn |',
    '|------|---------|-----------|',
    `| 样本数 | ${report.firstTurnCount} | ${report.laterTurnCount} |`,
    `| 含 memory_retrieve | ${firstWithMemory} | ${laterWithMemory} |`,
    `| memory p50 (ms) | ${report.memoryRetrieveMs.firstTurn.p50 ?? '—'} | ${report.memoryRetrieveMs.laterTurn.p50 ?? '—'} |`,
    `| turn 总时长 p95 (ms) | ${report.totalTurnMs.firstTurn.p95 ?? '—'} | ${report.totalTurnMs.laterTurn.p95 ?? '—'} |`,
    '',
    `**首 turn 跳过 memory 比例**：${report.memoryRetrievePresence.firstTurnSkipRate}`,
    '',
    report.estimatedFirstTurnTtftBenefitPct != null
      ? `估算首 turn p95 相对后续 turn 改善约 **${report.estimatedFirstTurnTtftBenefitPct}%**（受样本量影响，仅供参考）。`
      : '样本不足，无法估算 p95 改善比例。请启动 `npm run dev:saas` 后发送 3+ 轮对话再跑 `npm run ttft:memory-skip`。',
    '',
    `JSON：[ttft-memory-skip-${stamp}.json](./ttft-memory-skip-${stamp}.json)`,
  ].join('\n');
  writeFileSync(outMd, `${md}\n`, 'utf8');

  console.log(`Wrote ${outMd}`);
  console.log(`Wrote ${outJson}`);
  if (firstTurns.length && firstWithMemory === firstTurns.length) {
    report.p2Implementation.historicalNote =
      '当前 JSONL 样本可能采集于首 turn 跳过 memory 上线之前；请重启 dev:saas 后新建会话再跑 npm run ttft:memory-skip 验证';
    writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.warn(`[ttft-memory-skip] ${report.p2Implementation.historicalNote}`);
  }
  if (traces.length === 0) {
    console.warn('[ttft-memory-skip] 无 telemetry 样本 — 请 dev:saas 实跑后重试');
  }
}

main();
