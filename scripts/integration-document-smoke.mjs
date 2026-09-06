#!/usr/bin/env node
/**
 * Smoke: compose_images_to_document PDF path + resolveDocumentToolConfig unit tests.
 * Optional OCR when MINERU_API_TOKEN or tools.documentOcr is configured locally.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { parse as parseYaml } from "yaml";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const OUT_DIR = path.join(REPO_ROOT, "artifacts", "document-smoke");
const PDF_OUT = path.join(OUT_DIR, "compose-smoke.pdf");

function fail(message) {
  console.error(`[document-smoke] FAIL: ${message}`);
  process.exit(1);
}

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    fail(`${label} exited with code ${result.status ?? "unknown"}`);
  }
  return result;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const pngPaths = [];
for (let i = 1; i <= 3; i += 1) {
  const file = path.join(OUT_DIR, `page-${i}.png`);
  await sharp({
    create: {
      width: 320,
      height: 180,
      channels: 3,
      background: { r: 30 + i * 20, g: 60, b: 120 },
    },
  })
    .png()
    .toFile(file);
  pngPaths.push(file);
}

run(
  "compose-images-document",
  process.execPath,
  [path.join(REPO_ROOT, "scripts", "compose-images-document.mjs"), "--output", PDF_OUT, "--images", ...pngPaths],
);

const pdfStats = fs.statSync(PDF_OUT);
if (pdfStats.size < 500) {
  fail(`PDF too small (${pdfStats.size} bytes): ${PDF_OUT}`);
}
console.log(`[document-smoke] OK pdf=${PDF_OUT} (${pdfStats.size} bytes, ${pngPaths.length} pages)`);

const python = spawnSync("python", ["--version"], { encoding: "utf8" });
if (python.status === 0) {
  const pptxOut = path.join(OUT_DIR, "compose-smoke.pptx");
  const pptx = spawnSync(
    "python",
    [
      path.join(REPO_ROOT, "scripts", "compose-images-pptx.py"),
      "--output",
      pptxOut,
      "--aspect-ratio",
      "16:9",
      "--images",
      ...pngPaths,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (pptx.status === 0 && fs.existsSync(pptxOut) && fs.statSync(pptxOut).size > 1000) {
    console.log(`[document-smoke] OK pptx=${pptxOut} (${fs.statSync(pptxOut).size} bytes)`);
  } else {
    console.log("[document-smoke] SKIP pptx (python-pptx missing or script failed)");
  }
} else {
  console.log("[document-smoke] SKIP pptx (python not in PATH)");
}

run("resolveDocumentToolConfig tests", process.execPath, ["--test", "dist/tests/pilot/resolveDocumentToolConfig.test.js"]);

function readMineruToken() {
  const fromEnv = String(process.env.MINERU_API_TOKEN ?? "").trim();
  if (fromEnv) return fromEnv;
  const yamlPath = path.join(os.homedir(), ".pilotdeck", "pilotdeck.yaml");
  if (!fs.existsSync(yamlPath)) return "";
  try {
    const doc = parseYaml(fs.readFileSync(yamlPath, "utf8"));
    return String(doc?.tools?.documentOcr?.apiKey ?? "").trim();
  } catch {
    return "";
  }
}

function readDashScopeKey() {
  const fromEnv = String(process.env.DASHSCOPE_API_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  const yamlPath = path.join(os.homedir(), ".pilotdeck", "pilotdeck.yaml");
  if (!fs.existsSync(yamlPath)) return "";
  try {
    const doc = parseYaml(fs.readFileSync(yamlPath, "utf8"));
    return String(doc?.model?.providers?.qwen?.apiKey ?? "").trim();
  } catch {
    return "";
  }
}

const mineruToken = readMineruToken();
const dashscopeKey = readDashScopeKey();
if ((mineruToken && /^eyJ/i.test(mineruToken)) || dashscopeKey) {
  const ocrOut = path.join(OUT_DIR, "ocr-smoke.pptx");
  const ocr = spawnSync(
    "python",
    [
      path.join(REPO_ROOT, "scripts", "ocr-to-editable-pptx.py"),
      "--inputs",
      pngPaths[0],
      "--output",
      ocrOut,
      "--provider",
      "mineru",
      "--mode",
      "cloud",
    ],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        ...(mineruToken ? { MINERU_API_TOKEN: mineruToken } : {}),
        ...(dashscopeKey ? { DASHSCOPE_API_KEY: dashscopeKey } : {}),
      },
      timeout: 300_000,
    },
  );
  if (ocr.status === 0 && fs.existsSync(ocrOut) && fs.statSync(ocrOut).size > 2000) {
    console.log(`[document-smoke] OK ocr=${ocrOut} (${fs.statSync(ocrOut).size} bytes)`);
  } else {
    console.log("[document-smoke] WARN MinerU OCR optional step failed (check token/network/Python deps)");
  }
} else {
  console.log("[document-smoke] SKIP ocr (configure MinerU Token or DashScope in ~/.pilotdeck/pilotdeck.yaml)");
}

const yamlPath = path.join(os.homedir(), ".pilotdeck", "pilotdeck.yaml");
if (fs.existsSync(yamlPath)) {
  const text = fs.readFileSync(yamlPath, "utf8");
  if (text.includes("documentCompose:") || text.includes("documentOcr:")) {
    console.log(`[document-smoke] OK local config has document tools section (${yamlPath})`);
  } else {
    console.log(`[document-smoke] NOTE add tools.documentCompose/documentOcr in ${yamlPath} for OCR in UI`);
  }
}

console.log("[document-smoke] ALL REQUIRED CHECKS PASSED");
