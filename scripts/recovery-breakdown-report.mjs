#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Recovery event breakdown by reason + failed tools (Top-N report).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LOG = path.join(ROOT, '.saas-dev-data', 'telemetry', 'recovery-events.jsonl');
const OUT_DIR = path.join(ROOT, 'artifacts', 'dialogue-stability-final-review');

function summarize(events) {
  const byReason = {};
  const byTool = {};
  for (const event of events) {
    const reason = String(event.reason || 'unknown');
    byReason[reason] = (byReason[reason] || 0) + 1;
    for (const tool of event.failedTools || []) {
      byTool[tool] = (byTool[tool] || 0) + 1;
    }
  }
  const topReasons = Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
  const topTools = Object.entries(byTool)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tool, count]) => ({ tool, count }));
  return { total: events.length, topReasons, topTools };
}

async function main() {
  const logPath = process.env.PILOTDECK_RECOVERY_LOG || DEFAULT_LOG;
  let events = [];
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    events = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    events = [];
  }

  const report = {
    at: new Date().toISOString(),
    logPath,
    ...summarize(events),
    recommendations: [],
  };

  const toolRecovery = report.topReasons.find((r) => r.reason === 'tool_recovery');
  if (toolRecovery && toolRecovery.count > 0) {
    report.recommendations.push(
      'tool_recovery 仍为主要来源：优先检查重复 bash/read_file 硬失败与 outbound 并发限流。',
    );
  }
  const topTool = report.topTools[0];
  if (topTool) {
    report.recommendations.push(`Top 失败工具 ${topTool.tool}（${topTool.count} 次）应纳入 alternate 路径或 skip 搜盘。`);
  }
  if (report.total === 0) {
    report.recommendations.push('暂无 recovery-events.jsonl 样本；跑 recovery 实机后重跑本脚本。');
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'recovery-breakdown-report.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[recovery-breakdown]', error instanceof Error ? error.message : error);
  process.exit(1);
});
