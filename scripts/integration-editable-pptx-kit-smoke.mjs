#!/usr/bin/env node
/**
 * PD-SAAS-FORK: smoke editable PPTX (Kit pipeline) with MinerU + optional Baidu hybrid.
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
const OUT_DIR = path.join(REPO_ROOT, 'artifacts/document-export-smoke');
const OUT_PPTX = path.join(OUT_DIR, 'editable-pptx-kit-smoke.pptx');

function fail(msg) {
  console.error(`[editable-pptx-kit-smoke] FAIL: ${msg}`);
  process.exit(1);
}

function applyYamlDocumentEnv(env, doc) {
  const tools = doc?.tools;
  if (!tools || typeof tools !== 'object') return;
  const ocr = tools.documentOcr ?? tools.document?.ocr;
  if (ocr && typeof ocr === 'object') {
    const apiKey = String(ocr.apiKey ?? '').trim();
    if (apiKey && /^eyJ/i.test(apiKey)) {
      env.MINERU_API_TOKEN = apiKey;
      env.PILOTDECK_DOCUMENT_OCR_API_KEY = apiKey;
    }
    if (ocr.apiUrl) env.PILOTDECK_DOCUMENT_OCR_API_URL = String(ocr.apiUrl).replace(/\/+$/, '');
    if (ocr.mode) env.PILOTDECK_DOCUMENT_OCR_MODE = String(ocr.mode);
    if (ocr.extractorMethod) env.PILOTDECK_DOCUMENT_EXTRACTOR_METHOD = String(ocr.extractorMethod);
    if (ocr.inpaintMethod) env.PILOTDECK_INPAINT_METHOD = String(ocr.inpaintMethod);
  }
  const baidu = tools.baiduAi;
  if (baidu && typeof baidu === 'object') {
    if (baidu.apiKey) env.BAIDU_API_KEY = String(baidu.apiKey).trim();
    if (baidu.secretKey) env.BAIDU_SECRET_KEY = String(baidu.secretKey).trim();
  }
  env.PPT_EXPORT_MINERU_CACHE = env.PPT_EXPORT_MINERU_CACHE || '1';
  env.PILOTDECK_DOCUMENT_EXTRACTOR_METHOD = env.PILOTDECK_DOCUMENT_EXTRACTOR_METHOD || 'hybrid';
  env.PILOTDECK_INPAINT_METHOD = env.PILOTDECK_INPAINT_METHOD || 'baidu';
}

function loadRuntimeEnv() {
  const env = { ...process.env };
  const yamlPath = path.join(os.homedir(), '.pilotdeck', 'pilotdeck.yaml');
  if (fs.existsSync(yamlPath)) {
    try {
      applyYamlDocumentEnv(env, parseYaml(fs.readFileSync(yamlPath, 'utf8')));
    } catch (err) {
      console.warn('[editable-pptx-kit-smoke] yaml warn:', err?.message || err);
    }
  }
  env.PPT_EXPORT_MAX_WORKERS = env.PPT_EXPORT_MAX_WORKERS || '1';
  return env;
}

const slidePaths = fs
  .readdirSync(DECK_DIR)
  .filter((n) => /^slide-0[1-3]\.png$/i.test(n))
  .sort()
  .map((n) => path.join(DECK_DIR, n));

if (slidePaths.length < 3) fail(`need 3 slides under ${DECK_DIR}`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const env = loadRuntimeEnv();
if (!env.MINERU_API_TOKEN?.trim()) {
  fail('MINERU_API_TOKEN missing (~/.pilotdeck/pilotdeck.yaml tools.documentOcr.apiKey)');
}

console.log('[editable-pptx-kit-smoke] exporting 3 slides via export-editable-pptx-pd.py …');
const started = Date.now();
const proc = spawnSync(
  'python',
  [
    path.join(REPO_ROOT, 'scripts/export-editable-pptx-pd.py'),
    '--output',
    OUT_PPTX,
    '--images',
    ...slidePaths,
    '--workers',
    '1',
  ],
  { cwd: REPO_ROOT, encoding: 'utf8', env, timeout: 600_000 },
);

if (proc.status !== 0) {
  console.error(proc.stderr || proc.stdout);
  fail('export-editable-pptx-pd.py failed');
}
if (!fs.existsSync(OUT_PPTX)) fail(`missing ${OUT_PPTX}`);
const size = fs.statSync(OUT_PPTX).size;
if (size < 5000) fail(`pptx too small (${size} bytes)`);

const verify = spawnSync(
  'python',
  [
    '-c',
    `from pptx import Presentation
p = Presentation(${JSON.stringify(OUT_PPTX.replace(/\\/g, '\\\\'))})
slides = len(p.slides)
boxes = sum(1 for slide in p.slides for shape in slide.shapes if getattr(shape, 'has_text_frame', False) and shape.text_frame.text.strip())
assert slides >= 3, slides
assert boxes >= 3, boxes
print('OK', slides, 'slides', boxes, 'text_boxes')`,
  ],
  { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60_000 },
);
if (verify.status !== 0) {
  console.error(verify.stderr || verify.stdout);
  fail('pptx text-box verification failed');
}
console.log(verify.stdout.trim());

console.log(
  `[editable-pptx-kit-smoke] OK ${OUT_PPTX} (${size} bytes, ${Math.round((Date.now() - started) / 1000)}s)`,
);
