#!/usr/bin/env node
// PD-SAAS-FORK: 3-case HyperFrames acceptance (parallel render, ffprobe gate)
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHyperframesProject } from "./render-hyperframes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(REPO_ROOT, "artifacts", "hyperframes-acceptance-3case");
const FIXTURES = path.join(REPO_ROOT, "tests", "fixtures", "hyperframes-cases");

const CASES = [
  {
    id: "case1-brand-intro",
    title: "品牌片头（10s 风格 · 5s 成片）",
    hub: "hf-hyperframes",
    projectDir: path.join(FIXTURES, "case1-brand-intro"),
    outputName: "promo-case1-brand.mp4",
  },
  {
    id: "case2-product-launch",
    title: "产品发布宣传片",
    hub: "hf-product-launch-video",
    projectDir: path.join(FIXTURES, "case2-product-launch"),
    outputName: "promo-case2-launch.mp4",
  },
  {
    id: "case3-motion-stats",
    title: "动效数据卡片",
    hub: "hf-motion-graphics",
    projectDir: path.join(FIXTURES, "case3-motion-stats"),
    outputName: "promo-case3-motion.mp4",
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
  const render = await renderHyperframesProject({
    projectDir: def.projectDir,
    outputPath,
    quality: "draft",
  });
  const probe = ffprobeJson(outputPath);
  const duration = Number(probe?.format?.duration ?? 0);
  const bytes = Number(probe?.format?.size ?? render.bytes);
  const stream = probe?.streams?.[0] ?? {};
  const width = Number(stream.width ?? 0);
  const height = Number(stream.height ?? 0);
  const elapsedMs = Date.now() - started;
  const pass = bytes > 10 * 1024 && duration >= 3 && width >= 640 && height >= 360;
  return {
    ...def,
    outputPath,
    relativePath: path.relative(REPO_ROOT, outputPath).replace(/\\/g, "/"),
    bytes,
    durationSec: duration,
    width,
    height,
    codec: stream.codec_name ?? "unknown",
    elapsedMs,
    pass,
  };
}

async function main() {
  if (spawnSync("where", ["ffprobe"], { encoding: "utf8", windowsHide: true }).status !== 0) {
    console.error("[3case] SKIP: ffprobe not found");
    process.exit(2);
  }

  await mkdir(OUT_ROOT, { recursive: true });
  console.log(`[3case] 并发启动 ${CASES.length} 路 HyperFrames 渲染…`);
  const t0 = Date.now();
  const settled = await Promise.allSettled(CASES.map((c) => runCase(c)));
  const totalMs = Date.now() - t0;

  const results = settled.map((entry, i) => {
    if (entry.status === "fulfilled") return entry.value;
    return {
      ...CASES[i],
      pass: false,
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    parallel: true,
    totalWallMs: totalMs,
    passCount: results.filter((r) => r.pass).length,
    failCount: results.filter((r) => !r.pass).length,
    results,
  };

  const reportPath = path.join(OUT_ROOT, "acceptance-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const mdLines = [
    "# HyperFrames 三案实机验收",
    "",
    `生成时间：${report.generatedAt}`,
    `并发总耗时：${(totalMs / 1000).toFixed(1)}s`,
    `通过：${report.passCount}/${CASES.length}`,
    "",
    "| # | 场景 | Hub | 成片 | 时长 | 分辨率 | 大小 | 耗时 | 结果 |",
    "|---|------|-----|------|------|--------|------|------|------|",
  ];

  results.forEach((r, idx) => {
    const status = r.pass ? "✅ PASS" : "❌ FAIL";
    const dur = r.durationSec != null ? `${r.durationSec.toFixed(2)}s` : "-";
    const res = r.width && r.height ? `${r.width}×${r.height}` : "-";
    const size = r.bytes != null ? `${Math.round(r.bytes / 1024)} KB` : "-";
    const wall = r.elapsedMs != null ? `${(r.elapsedMs / 1000).toFixed(1)}s` : "-";
    const link = r.relativePath ?? r.error ?? "-";
    mdLines.push(`| ${idx + 1} | ${r.title} | ${r.hub} | \`${link}\` | ${dur} | ${res} | ${size} | ${wall} | ${status} |`);
  });

  mdLines.push("", "## 验收路径", "", "```", OUT_ROOT.replace(/\\/g, "/"), "```");
  if (report.failCount > 0) {
    mdLines.push("", "## 失败详情");
    for (const r of results.filter((x) => !x.pass)) {
      mdLines.push(`- **${r.id}**: ${r.error ?? "ffprobe/大小/时长未达标"}`);
    }
  }

  const mdPath = path.join(OUT_ROOT, "acceptance-report.zh-CN.md");
  await writeFile(mdPath, `${mdLines.join("\n")}\n`, "utf8");

  console.log(JSON.stringify({ ok: report.failCount === 0, reportPath, mdPath, passCount: report.passCount }, null, 2));
  for (const r of results) {
    const tag = r.pass ? "PASS" : "FAIL";
    console.log(`[3case] ${tag} ${r.id} → ${r.relativePath ?? r.error}`);
  }

  process.exit(report.failCount === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`[3case] FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
