#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Count recovery events from jsonl for Wuyutai-style PPT runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(root, 'docs', 'recovery-baseline-wuyutai.json');

async function main() {
  const mod = await import(pathToFileURL(path.join(root, 'src/telemetry/recoveryTiming.ts')).href);
  const sinceIdx = process.argv.indexOf('--since-ms');
  const sinceMs = sinceIdx >= 0 ? Number(process.argv[sinceIdx + 1]) : 0;
  const allEvents = await mod.loadRecoveryEventsFromLog();
  const events =
    sinceMs > 0 ? allEvents.filter((e) => (e.recordedAtMs ?? 0) >= sinceMs) : allEvents;
  const byReason = mod.summarizeRecoveryByReason(events);
  const total = events.length;
  let baselineTotal = total;
  if (fs.existsSync(baselinePath)) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    baselineTotal = baseline.sampleCount ?? total;
  } else {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(
      baselinePath,
      `${JSON.stringify({ sampleCount: total, capturedAt: new Date().toISOString() }, null, 2)}\n`,
    );
    console.log(`Wrote baseline ${baselinePath} (first run)`);
  }

  const reduction =
    baselineTotal > 0 ? Math.round(((baselineTotal - total) / baselineTotal) * 100) : 0;
  const stamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(root, 'docs', `recovery-stability-report-${stamp}.md`);
  const lines = [
    `# Recovery 稳定性报告（${stamp}）`,
    '',
    sinceMs > 0
      ? `本回合 recovery 事件：**${total}**（基线 ${baselineTotal}，变化 ${reduction}%）`
      : `总 recovery 事件：**${total}**（基线 ${baselineTotal}，变化 ${reduction}%）`,
    '',
    '| reason | 次数 |',
    '|--------|------|',
    ...Object.entries(byReason)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([reason, stats]) => `| ${reason} | ${stats.count} |`),
    '',
    reduction >= 50 ? '**达标**：recovery 较基线下降 ≥50%' : '**待优化**：recovery 未达 50% 降幅目标',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${reportPath}`);
  console.log(`recovery events: ${total} (baseline ${baselineTotal})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
