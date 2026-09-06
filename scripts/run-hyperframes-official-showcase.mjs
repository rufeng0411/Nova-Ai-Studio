#!/usr/bin/env node
// PD-SAAS-FORK: Official HeyGen HyperFrames launch showcase acceptance (upstream LFS projects)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHyperframesProject } from "./render-hyperframes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const VENDOR_ROOT = path.join(REPO_ROOT, "artifacts", "vendor", "hyperframes-launches");
const OUT_ROOT = path.join(REPO_ROOT, "artifacts", "hyperframes-official-showcase-3case");

/** Official HeyGen launch videos — most complex public showcase set. */
const CASES = [
  {
    id: "hyperframes-launch",
    title: "HyperFrames 官方发布片（glass-frame · GSAP/Lottie/Shader/Three.js · ~50s）",
    sourceDir: "hyperframes-launch",
    viewerUrl: "https://hyperframes.dev/viewer/9ab8d480-7507-4905-9222-ae6ea4b2fb5a",
    outputName: "official-hyperframes-launch-draft.mp4",
    minDurationSec: 40,
    minBytes: 5 * 1024 * 1024,
    skipLint: true,
  },
  {
    id: "website-to-hyperframes",
    title: "Website → HyperFrames 官网一键成片（VO/SFX/字幕 · ~42s）",
    sourceDir: "website-to-hyperframes",
    viewerUrl: "https://hyperframes.dev/viewer/85d2d8d5-bf5b-4d04-901d-7c3ae157a30a",
    outputName: "official-website-to-hyperframes-draft.mp4",
    minDurationSec: 30,
    minBytes: 3 * 1024 * 1024,
    skipLint: true,
  },
  {
    id: "vfx-heygen-combined",
    title: "VFX HeyGen Combined（Three.js · iPhone GLB · shader 转场 · ~26s）",
    sourceDir: "vfx-heygen-combined",
    viewerUrl: "https://hyperframes.dev/viewer/3c3669b8-65d0-4f1f-8cdb-e608c1a58ff9",
    outputName: "official-vfx-heygen-combined-draft.mp4",
    minDurationSec: 20,
    minBytes: 5 * 1024 * 1024,
    skipLint: true,
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

function gitHeadShort(cwd) {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

async function runCase(def, options) {
  const projectDir = path.join(VENDOR_ROOT, def.sourceDir);
  if (!existsSync(path.join(projectDir, "index.html"))) {
    throw new Error(`missing_vendor: clone artifacts/vendor/hyperframes-launches (${def.sourceDir})`);
  }

  const started = Date.now();
  const outputPath = path.join(OUT_ROOT, def.id, def.outputName);
  await mkdir(path.dirname(outputPath), { recursive: true });

  if (!options.verifyOnly || !existsSync(outputPath)) {
    await renderHyperframesProject({
      projectDir,
      outputPath,
      quality: options.quality,
      skipLint: def.skipLint === true,
    });
  }

  const probe = ffprobeJson(outputPath);
  const duration = Number(probe?.format?.duration ?? 0);
  const bytes = Number(probe?.format?.size ?? 0);
  const stream = probe?.streams?.[0] ?? {};
  const width = Number(stream.width ?? 0);
  const height = Number(stream.height ?? 0);
  const elapsedMs = Date.now() - started;
  const pass =
    bytes >= def.minBytes
    && duration >= def.minDurationSec
    && width >= 1280
    && height >= 720;

  return {
    ...def,
    projectDir: path.relative(REPO_ROOT, projectDir).replace(/\\/g, "/"),
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
    console.error("[official-showcase] SKIP: ffprobe not found");
    process.exit(2);
  }

  const args = process.argv.slice(2);
  const parallel = !args.includes("--serial");
  const verifyOnly = args.includes("--verify-only");
  const quality = args.includes("--quality") ? args[args.indexOf("--quality") + 1] : "draft";
  const vendorCommit = gitHeadShort(VENDOR_ROOT);

  await mkdir(OUT_ROOT, { recursive: true });
  console.log(`[official-showcase] ${parallel ? "并发" : "串行"}渲染 ${CASES.length} 路官方 HeyGen 案例（quality=${quality}）…`);

  const t0 = Date.now();
  const settled = parallel
    ? await Promise.allSettled(CASES.map((c) => runCase(c, { quality, verifyOnly })))
    : [];
  if (!parallel) {
    for (const c of CASES) {
      try {
        settled.push({ status: "fulfilled", value: await runCase(c, { quality, verifyOnly }) });
      } catch (reason) {
        settled.push({ status: "rejected", reason });
      }
    }
  }
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
    sourceRepo: "https://github.com/heygen-com/hyperframes-launches",
    vendorCommit,
    quality,
    parallel,
    totalWallMs: totalMs,
    passCount: results.filter((r) => r.pass).length,
    failCount: results.filter((r) => !r.pass).length,
    note: "Official upstream projects skip strict lint; render uses HyperFrames --best-effort (default).",
    results,
  };

  const reportPath = path.join(OUT_ROOT, "acceptance-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const mdLines = [
    "# HyperFrames 官方 Showcase 三案实机验收",
    "",
    "来源：[heygen-com/hyperframes-launches](https://github.com/heygen-com/hyperframes-launches)（Git LFS 官方发布片）",
    "",
    `生成时间：${report.generatedAt}`,
    `Vendor commit：\`${vendorCommit}\``,
    `渲染质量：\`${quality}\`（draft 为验收加速；正式交付可用 \`--quality high\`）`,
    `并发总耗时：${(totalMs / 1000).toFixed(1)}s`,
    `通过：${report.passCount}/${CASES.length}`,
    "",
    "| # | 官方案例 | 公开预览 | 成片 | 时长 | 分辨率 | 大小 | 耗时 | 结果 |",
    "|---|----------|----------|------|------|--------|------|------|------|",
  ];

  results.forEach((r, idx) => {
    const status = r.pass ? "✅ PASS" : "❌ FAIL";
    const dur = r.durationSec != null ? `${r.durationSec.toFixed(2)}s` : "-";
    const res = r.width && r.height ? `${r.width}×${r.height}` : "-";
    const size = r.bytes != null ? `${(r.bytes / (1024 * 1024)).toFixed(1)} MB` : "-";
    const wall = r.elapsedMs != null ? `${(r.elapsedMs / 1000).toFixed(1)}s` : "-";
    const link = r.relativePath ?? r.error ?? "-";
    const preview = r.viewerUrl ? `[在线预览](${r.viewerUrl})` : "-";
    mdLines.push(`| ${idx + 1} | ${r.title} | ${preview} | \`${link}\` | ${dur} | ${res} | ${size} | ${wall} | ${status} |`);
  });

  mdLines.push(
    "",
    "## 与自造三案对比",
    "",
    "- 自造 fixture（`artifacts/hyperframes-acceptance-3case/`）仅 5–6s 淡入卡片，用于 L0 冒烟。",
    "- 本批为 HeyGen 官方最复杂 launch 片：多 sub-composition、Three.js/shader、官网 capture、VO/SFX。",
    "",
    "## 验收路径",
    "",
    "```",
    OUT_ROOT.replace(/\\/g, "/"),
    "```",
  );

  if (report.failCount > 0) {
    mdLines.push("", "## 失败详情");
    for (const r of results.filter((x) => !x.pass)) {
      mdLines.push(`- **${r.id}**: ${r.error ?? "时长/分辨率/大小未达标"}`);
    }
  }

  const mdPath = path.join(OUT_ROOT, "acceptance-report.zh-CN.md");
  await writeFile(mdPath, `${mdLines.join("\n")}\n`, "utf8");

  console.log(JSON.stringify({ ok: report.failCount === 0, reportPath, mdPath, passCount: report.passCount }, null, 2));
  for (const r of results) {
    const tag = r.pass ? "PASS" : "FAIL";
    console.log(`[official-showcase] ${tag} ${r.id} → ${r.relativePath ?? r.error}`);
  }

  process.exit(report.failCount === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`[official-showcase] FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
