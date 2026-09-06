#!/usr/bin/env node
/**
 * Summarize in-process TTFT stage traces captured during local turns.
 * Run after exercising the gateway (dev:saas) with complex prompts.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveDefaultLogPath() {
  const fromEnv = process.env.PILOTDECK_TTFT_LOG?.trim();
  if (fromEnv) return fromEnv;
  const dataRoot = process.env.PILOTDECK_DATA_ROOT?.trim() || process.env.DATA_ROOT?.trim();
  if (dataRoot) return resolve(dataRoot, "telemetry", "turn-timing.jsonl");
  return resolve(root, ".saas-dev-data", "telemetry", "turn-timing.jsonl");
}

async function main() {
  const mod = await import(pathToFileURL(resolve(root, "src/telemetry/turnTiming.ts")).href);
  const logPath = resolveDefaultLogPath();
  let traces = mod.listCompletedTurnTraces();
  if (traces.length === 0) {
    traces = await mod.loadTurnTracesFromLog(logPath);
  }
  const summary = mod.summarizeStageDurations(traces);
  const firstVisible = traces
    .map((trace) => trace.firstVisibleMs)
    .filter((value) => typeof value === "number");
  const totalMs = traces.map((trace) => trace.totalMs);

  const report = {
    generatedAt: new Date().toISOString(),
    logPath,
    sampleCount: traces.length,
    totalMs: {
      p50: mod.percentile(totalMs, 50),
      p95: mod.percentile(totalMs, 95),
    },
    firstVisibleMs: {
      p50: mod.percentile(firstVisible, 50),
      p95: mod.percentile(firstVisible, 95),
    },
    stages: summary,
  };

  const outDir = resolve(root, "docs");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = resolve(outDir, `ttft-baseline-${stamp}.json`);
  const mdPath = resolve(outDir, `ttft-analysis-report-${stamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const mdLines = [
    `# TTFT 基线报告（${stamp}）`,
    "",
    `样本数：**${report.sampleCount}**`,
    "",
    "## 总耗时（ms）",
    "",
    `| 指标 | p50 | p95 |`,
    `|------|-----|-----|`,
    `| turn 总时长 | ${report.totalMs.p50 ?? "—"} | ${report.totalMs.p95 ?? "—"} |`,
    `| 首可见反馈 | ${report.firstVisibleMs.p50 ?? "—"} | ${report.firstVisibleMs.p95 ?? "—"} |`,
    "",
    "## 分阶段（ms）",
    "",
    "| 阶段 | 样本 | p50 | p95 |",
    "|------|------|-----|-----|",
  ];
  for (const [stage, stats] of Object.entries(summary).sort(([a], [b]) => a.localeCompare(b))) {
    mdLines.push(`| ${stage} | ${stats.count} | ${stats.p50 ?? "—"} | ${stats.p95 ?? "—"} |`);
  }
  mdLines.push("", `原始 JSON：[ttft-baseline-${stamp}.json](./ttft-baseline-${stamp}.json)`);
  await writeFile(mdPath, `${mdLines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  if (traces.length === 0) {
    console.log(`No traces found (checked in-memory and ${logPath}). Run complex turns in dev:saas first.`);
    process.exitCode = 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
