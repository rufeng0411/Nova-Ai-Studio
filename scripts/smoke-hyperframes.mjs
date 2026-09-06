#!/usr/bin/env node
// PD-SAAS-FORK: L0 HyperFrames golden smoke (no Gateway/LLM)
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHyperframesProject } from "./render-hyperframes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GOLDEN_DIR = path.join(REPO_ROOT, "tests", "fixtures", "hyperframes-golden");
const OUT_DIR = path.join(REPO_ROOT, "artifacts", "hyperframes-smoke");

function hasFfprobe() {
  const cmd = process.platform === "win32" ? "where" : "which";
  const probe = spawnSync(cmd, ["ffprobe"], { encoding: "utf8", windowsHide: true });
  return probe.status === 0;
}

function ffprobeJson(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", filePath],
    { encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "ffprobe failed");
  }
  return JSON.parse(result.stdout || "{}");
}

async function main() {
  if (!hasFfprobe()) {
    console.error("[smoke:hyperframes] SKIP: ffprobe not found (exit 2)");
    process.exit(2);
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const outputPath = path.join(OUT_DIR, "golden.mp4");

  console.log("[smoke:hyperframes] rendering golden fixture...");
  const result = await renderHyperframesProject({
    projectDir: GOLDEN_DIR,
    outputPath,
    quality: "draft",
  });

  if (result.bytes <= 10 * 1024) {
    throw new Error(`output too small: ${result.bytes} bytes`);
  }

  const probe = ffprobeJson(outputPath);
  const duration = Number(probe?.format?.duration ?? 0);
  const stream = probe?.streams?.[0] ?? {};
  const width = Number(stream.width ?? 0);
  const height = Number(stream.height ?? 0);

  if (duration < 3) throw new Error(`duration too short: ${duration}s`);
  if (width < 640 || height < 360) throw new Error(`resolution too low: ${width}x${height}`);

  console.log(`[smoke:hyperframes] PASS bytes=${result.bytes} duration=${duration.toFixed(2)}s ${width}x${height}`);
}

main().catch((error) => {
  console.error(`[smoke:hyperframes] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
