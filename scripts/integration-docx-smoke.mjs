#!/usr/bin/env node
/**
 * Smoke: anth-docx skill present + docx npm package can write a .docx file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const SKILL_MD = path.join(REPO_ROOT, 'skills', 'vendor', 'anthropics-skills', 'anth-docx', 'SKILL.md');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'docx-smoke');
const OUT_FILE = path.join(OUT_DIR, 'sample-brief.docx');

function fail(message) {
  console.error(`[docx-smoke] FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(SKILL_MD)) {
  fail(`missing skill: ${SKILL_MD} — run node scripts/vendor-anthropics-docx.mjs`);
}

const render = spawnSync(
  process.execPath,
  [path.join(REPO_ROOT, 'scripts', 'render-docx-brief.mjs'), '--out', OUT_FILE, '--title', 'Docx Smoke Brief'],
  { cwd: REPO_ROOT, encoding: 'utf8' },
);

if (render.status !== 0) {
  console.error(render.stderr || render.stdout);
  fail('render-docx-brief failed — run npm install at repo root');
}

const stats = fs.statSync(OUT_FILE);
if (stats.size < 3000) {
  fail(`output too small (${stats.size} bytes): ${OUT_FILE}`);
}

console.log(`[docx-smoke] OK skill=${SKILL_MD}`);
console.log(`[docx-smoke] OK docx=${OUT_FILE} (${stats.size} bytes)`);
