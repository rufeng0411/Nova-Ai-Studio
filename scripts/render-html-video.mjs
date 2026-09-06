#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      result[key] = "true";
      continue;
    }
    result[key] = value;
    i += 1;
  }
  return result;
}

async function ensureFile(filePath, label) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error(`${label} is not a file: ${filePath}`);
  } catch (error) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed (${command} ${args.join(" ")}): ${stderr || stdout}`));
      }
    });
    child.once("error", reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input ? path.resolve(args.input) : "";
  const output = args.output ? path.resolve(args.output) : "";
  const duration = Math.max(1, Number(args.duration || 6));
  const fps = Math.max(1, Number(args.fps || 24));
  const width = Math.max(320, Number(args.width || 1280));
  const height = Math.max(180, Number(args.height || 720));
  if (!input || !output) {
    throw new Error("Usage: node scripts/render-html-video.mjs --input <html> --output <mp4> [--duration 6] [--fps 24]");
  }
  if (path.extname(output).toLowerCase() !== ".mp4") {
    throw new Error("Output file must end with .mp4");
  }
  await ensureFile(input, "Input HTML");
  await fs.mkdir(path.dirname(output), { recursive: true });
  const tempDir = path.join(path.dirname(output), `.render-html-video-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`file://${input.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const totalFrames = Math.max(1, Math.floor(duration * fps));
    for (let i = 0; i < totalFrames; i += 1) {
      const filename = path.join(tempDir, `${String(i).padStart(6, "0")}.png`);
      await page.screenshot({ path: filename, fullPage: false });
      await page.evaluate(({ frameIndex, frameRate }) => {
        const evt = new CustomEvent("pilotdeck-render-frame", {
          detail: { frameIndex, frameRate, timeMs: Math.round((frameIndex * 1000) / frameRate) },
        });
        window.dispatchEvent(evt);
      }, { frameIndex: i, frameRate: fps });
      await page.waitForTimeout(Math.round(1000 / fps));
    }
  } finally {
    await browser.close();
  }

  const framePattern = path.join(tempDir, "%06d.png");
  await run("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    framePattern,
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    "-movflags",
    "+faststart",
    output,
  ]);

  await fs.rm(tempDir, { recursive: true, force: true });
  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
