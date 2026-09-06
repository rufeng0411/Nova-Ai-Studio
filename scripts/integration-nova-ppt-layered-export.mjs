#!/usr/bin/env node
/**
 * 深度验收：Nova 美学幻灯 acceptance 套图 → MinerU 分层可编辑 PPT
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DECK_DIR = path.join(
  REPO_ROOT,
  'skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance/enterprise-ai-training-2026',
);
const MANIFEST = path.join(DECK_DIR, 'slide-manifest.json');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts/document-smoke');
const OUT_PPTX = path.join(OUT_DIR, 'nova-layered-deep-test-16x9.pptx');
const REPORT = path.join(OUT_DIR, 'nova-layered-deep-test-report.json');

function fail(msg) {
  console.error(`[nova-ppt-deep] FAIL: ${msg}`);
  process.exit(1);
}

function readMineruConfig() {
  const fromEnv = String(process.env.MINERU_API_TOKEN ?? '').trim();
  const yamlPath = path.join(os.homedir(), '.pilotdeck', 'pilotdeck.yaml');
  let apiKey = fromEnv;
  let apiUrl = String(process.env.PILOTDECK_DOCUMENT_OCR_API_URL ?? 'https://mineru.net/api/v4').trim();
  let mode = String(process.env.PILOTDECK_DOCUMENT_OCR_MODE ?? 'cloud').trim();
  if (!apiKey && fs.existsSync(yamlPath)) {
    try {
      const doc = parseYaml(fs.readFileSync(yamlPath, 'utf8'));
      const ocr = doc?.tools?.documentOcr ?? {};
      apiKey = String(ocr.apiKey ?? '').trim();
      if (ocr.apiUrl) apiUrl = String(ocr.apiUrl).trim();
      if (ocr.mode) mode = String(ocr.mode).trim();
    } catch {
      /* ignore */
    }
  }
  return { apiKey, apiUrl, mode };
}

function listSlideImages() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const pages = manifest.pages ?? [];
  const paths = pages
    .map((p) => path.join(DECK_DIR, String(p.image_path || '')))
    .filter((p) => fs.existsSync(p));
  if (paths.length === 0) {
    const fallback = fs
      .readdirSync(DECK_DIR)
      .filter((n) => /^slide-\d+\.png$/i.test(n))
      .sort()
      .map((n) => path.join(DECK_DIR, n));
    return { paths: fallback, manifest };
  }
  return { paths, manifest };
}

const { apiKey, apiUrl, mode } = readMineruConfig();
if (!apiKey || !/^eyJ/i.test(apiKey)) {
  fail('MinerU Token 未配置（~/.pilotdeck/pilotdeck.yaml tools.documentOcr.apiKey）');
}

const { paths: slidePaths, manifest } = listSlideImages();
if (slidePaths.length < 2) {
  fail(`验收套图不足：${DECK_DIR}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const aspect = manifest.aspect_ratio || '16:9';

console.log(`[nova-ppt-deep] deck: enterprise-ai-training-2026 (${slidePaths.length} slides, ${aspect})`);
console.log(`[nova-ppt-deep] exporting layered PPT via MinerU…`);

const started = Date.now();
const exportProc = spawnSync(
  'python',
  [
    path.join(REPO_ROOT, 'scripts/ocr-to-editable-pptx.py'),
    '--inputs',
    ...slidePaths,
    '--output',
    OUT_PPTX,
    '--provider',
    'mineru',
    '--mode',
    mode,
    '--api-url',
    apiUrl.replace(/\/+$/, ''),
    '--api-key',
    apiKey,
    '--aspect-ratio',
    aspect,
    '--backgrounds',
    ...slidePaths,
  ],
  {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, MINERU_API_TOKEN: apiKey },
    timeout: 600_000,
  },
);

if (exportProc.status !== 0) {
  console.error(exportProc.stderr || exportProc.stdout);
  fail('ocr-to-editable-pptx export failed');
}
if (!fs.existsSync(OUT_PPTX)) {
  fail(`missing output ${OUT_PPTX}`);
}

const exportMs = Date.now() - started;
const size = fs.statSync(OUT_PPTX).size;
console.log(`[nova-ppt-deep] export OK ${OUT_PPTX} (${size} bytes, ${Math.round(exportMs / 1000)}s)`);

const verifyProc = spawnSync(
  'python',
  [
    path.join(REPO_ROOT, 'scripts/verify-nova-layered-pptx.py'),
    '--pptx',
    OUT_PPTX,
    '--manifest',
    MANIFEST,
    '--slides-dir',
    DECK_DIR,
    '--report',
    REPORT,
  ],
  { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000 },
);

if (verifyProc.status !== 0) {
  console.error(verifyProc.stderr || verifyProc.stdout);
  fail('verification failed');
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
console.log('[nova-ppt-deep] verification OK');
console.log(JSON.stringify({ ...report, export_seconds: Math.round(exportMs / 1000) }, null, 2));
console.log(`[nova-ppt-deep] report → ${path.relative(REPO_ROOT, REPORT)}`);
