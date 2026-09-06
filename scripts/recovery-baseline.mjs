#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Summarize recovery-events.jsonl into analysis report.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const mod = await import(pathToFileURL(resolve(root, "src/telemetry/recoveryTiming.ts")).href);
  const logPath = mod.getRecoveryLogPath();
  const events = await mod.loadRecoveryEventsFromLog(logPath);
  const byReason = mod.summarizeRecoveryByReason(events);
  const stamp = new Date().toISOString().slice(0, 10);
  const report = {
    generatedAt: new Date().toISOString(),
    logPath,
    sampleCount: events.length,
    byReason,
  };

  const outDir = resolve(root, "docs");
  await mkdir(outDir, { recursive: true });
  const jsonPath = resolve(outDir, `recovery-baseline-${stamp}.json`);
  const mdPath = resolve(outDir, `recovery-analysis-report-${stamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const mdLines = [
    `# Recovery 基线报告（${stamp}）`,
    "",
    `样本数：**${report.sampleCount}**`,
    "",
    "## 按 reason 统计",
    "",
    "| reason | 次数 | 平均剩余 budget |",
    "|--------|------|-----------------|",
    ...Object.entries(byReason)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([reason, stats]) => `| ${reason} | ${stats.count} | ${stats.avgBudgetRemaining} |`),
    "",
    `原始 JSON：[recovery-baseline-${stamp}.json](./recovery-baseline-${stamp}.json)`,
  ];
  await writeFile(mdPath, `${mdLines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
