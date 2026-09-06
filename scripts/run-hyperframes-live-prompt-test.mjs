#!/usr/bin/env node
// PD-SAAS-FORK: Live prompt acceptance — Nova 15s + Slam Dunk 30th 15s
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHyperframesProject } from "./render-hyperframes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(REPO_ROOT, "artifacts", "hyperframes-live-test-20260725");

const CASES = [
  {
    id: "task-nova-15s",
    title: "Nova Ai Studio 2.0 · 15s 产品发布（用户 prompt 复现）",
    projectDir: path.join(OUT_ROOT, "task-nova-15s", "hf-project"),
    outputName: "promo.mp4",
    minDurationSec: 14,
    minBytes: 200 * 1024,
  },
  {
    id: "task-slamdunk-30th",
    title: "灌篮高手 30 周年 · 15s 复杂动效",
    projectDir: path.join(OUT_ROOT, "task-slamdunk-30th", "hf-project"),
    outputName: "promo.mp4",
    minDurationSec: 14,
    minBytes: 300 * 1024,
  },
];

function ffprobeJson(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration,size:stream=width,height,codec_name", "-of", "json", filePath],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) throw new Error(result.stderr || "ffprobe failed");
  return JSON.parse(result.stdout || "{}");
}

async function runCase(def) {
  const started = Date.now();
  const outputPath = path.join(OUT_ROOT, def.id, def.outputName);
  await mkdir(path.dirname(outputPath), { recursive: true });

  await renderHyperframesProject({
    projectDir: def.projectDir,
    outputPath,
    quality: "draft",
    skipLint: false,
  });

  const probe = ffprobeJson(outputPath);
  const duration = Number(probe?.format?.duration ?? 0);
  const bytes = Number(probe?.format?.size ?? 0);
  const stream = probe?.streams?.[0] ?? {};
  const elapsedMs = Date.now() - started;
  const pass = bytes >= def.minBytes && duration >= def.minDurationSec
    && Number(stream.width) >= 1920 && Number(stream.height) >= 1080;

  return {
    ...def,
    outputPath,
    relativePath: path.relative(REPO_ROOT, outputPath).replace(/\\/g, "/"),
    bytes,
    durationSec: duration,
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
    elapsedMs,
    pass,
  };
}

async function main() {
  const parallel = !process.argv.includes("--serial");
  console.log(`[live-prompt-test] ${parallel ? "并发" : "串行"}渲染 ${CASES.length} 案…`);
  const t0 = Date.now();
  const settled = parallel
    ? await Promise.allSettled(CASES.map((c) => runCase(c)))
    : [];
  if (!parallel) {
    for (const c of CASES) {
      try {
        settled.push({ status: "fulfilled", value: await runCase(c) });
      } catch (reason) {
        settled.push({ status: "rejected", reason });
      }
    }
  }
  const totalMs = Date.now() - t0;

  const results = settled.map((entry, i) => {
    if (entry.status === "fulfilled") return entry.value;
    return { ...CASES[i], pass: false, error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason) };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    note: "Simulates Agent path: task-*/hf-project/ + render_hyperframes → promo.mp4",
    totalWallMs: totalMs,
    passCount: results.filter((r) => r.pass).length,
    results,
  };

  const reportPath = path.join(OUT_ROOT, "acceptance-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const md = [
    "# HyperFrames 实机 Prompt 测试",
    "",
    `时间：${report.generatedAt}`,
    `通过：${report.passCount}/${CASES.length} · 墙钟 ${(totalMs / 1000).toFixed(1)}s`,
    "",
    "| 案例 | 成片 | 时长 | 分辨率 | 大小 | 耗时 | 结果 |",
    "|------|------|------|--------|------|------|------|",
    ...results.map((r) => {
      const st = r.pass ? "✅ PASS" : "❌ FAIL";
      return `| ${r.title} | \`${r.relativePath ?? r.error}\` | ${r.durationSec?.toFixed(2) ?? "-"}s | ${r.width}×${r.height} | ${r.bytes ? `${Math.round(r.bytes / 1024)} KB` : "-"} | ${r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : "-"} | ${st} |`;
    }),
  ].join("\n");
  await writeFile(path.join(OUT_ROOT, "acceptance-report.zh-CN.md"), `${md}\n`, "utf8");

  console.log(JSON.stringify({ ok: report.passCount === CASES.length, reportPath, results }, null, 2));
  process.exit(report.passCount === CASES.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
