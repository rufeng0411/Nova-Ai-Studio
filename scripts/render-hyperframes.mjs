#!/usr/bin/env node
// PD-SAAS-FORK: HyperFrames CLI render wrapper for render_hyperframes tool + smoke tests
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${cmd} exited ${code}`));
    });
  });
}

function parseDoctorJson(stdout) {
  const text = String(stdout ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function resolveHyperframesCli() {
  const envBin = String(process.env.HYPERFRAMES_CLI_BIN ?? "").trim();
  if (envBin && existsSync(envBin) && envBin.endsWith(".mjs")) {
    return { cmd: process.execPath, args: (extra) => [envBin, ...extra] };
  }
  const globalMjs = path.join(
    process.env.APPDATA ?? "",
    "npm",
    "node_modules",
    "hyperframes",
    "bin",
    "hyperframes.mjs",
  );
  if (existsSync(globalMjs)) {
    return { cmd: process.execPath, args: (extra) => [globalMjs, ...extra] };
  }
  if (process.platform === "win32") {
    return { cmd: "npx.cmd", args: (extra) => ["hyperframes", ...extra] };
  }
  return { cmd: "npx", args: (extra) => ["hyperframes", ...extra] };
}

const hyperframesCli = resolveHyperframesCli();

async function runHyperframes(args, cwd) {
  return run(hyperframesCli.cmd, hyperframesCli.args(args), { cwd });
}

async function doctorOk(projectDir) {
  try {
    const { stdout } = await runHyperframes(["doctor", "--json"], projectDir);
    const payload = parseDoctorJson(stdout);
    if (!payload) return false;
    if (payload?.ok === true) return true;
    const checks = Array.isArray(payload?.checks) ? payload.checks : [];
    const ffmpegOk = checks.some((c) => c?.name === "FFmpeg" && c.ok === true);
    const chromeOk = checks.some((c) => c?.name === "Chrome" && c.ok === true);
    return ffmpegOk && chromeOk;
  } catch {
    return false;
  }
}

export async function renderHyperframesProject(options) {
  const projectDir = path.resolve(options.projectDir);
  const outputPath = path.resolve(options.outputPath);
  const quality = options.quality === "high" ? "high" : options.quality === "standard" ? "standard" : "draft";
  const skipDoctor = options.skipDoctor === true;
  const skipLint = options.skipLint === true;

  if (!existsSync(path.join(projectDir, "index.html"))) {
    throw new Error(`path_not_found: missing index.html in ${projectDir}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  if (!skipDoctor) {
    const ok = await doctorOk(projectDir);
    if (!ok) {
      const err = new Error("doctor_failed: HyperFrames environment not ready (ffmpeg/Chrome).");
      err.code = "doctor_failed";
      throw err;
    }
  }

  if (!skipLint) {
    await runHyperframes(["lint"], projectDir);
    try {
      await runHyperframes(["validate"], projectDir);
    } catch {
      // validate deprecated; check is advisory for upstream showcase projects
      await runHyperframes(["check"], projectDir).catch(() => {});
    }
  }

  const renderArgs = [
    "render",
    "--quality",
    quality,
    "--output",
    outputPath,
  ];
  if (options.width) renderArgs.push("--width", String(options.width));
  if (options.height) renderArgs.push("--height", String(options.height));

  await runHyperframes(renderArgs, projectDir);

  const info = await stat(outputPath);
  if (!info.isFile() || info.size <= 0) {
    throw new Error("render_empty: HyperFrames produced no output file.");
  }

  return { outputPath, bytes: info.size, quality };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = args["project-dir"];
  const output = args.output;
  if (!projectDir || !output) {
    console.error("Usage: render-hyperframes.mjs --project-dir <dir> --output <mp4> [--quality draft|high]");
    process.exit(1);
  }
  try {
    const result = await renderHyperframesProject({
      projectDir,
      outputPath: output,
      quality: args.quality,
      width: args.width ? Number(args.width) : undefined,
      height: args.height ? Number(args.height) : undefined,
      skipDoctor: args["skip-doctor"] === "true",
      skipLint: args["skip-lint"] === "true",
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (error) {
    const code = error?.code ?? "render_failed";
    console.error(JSON.stringify({ ok: false, code, message: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`
  || process.argv[1]?.endsWith("render-hyperframes.mjs")) {
  main();
}
