#!/usr/bin/env node
/**
 * Download anthropics/skills/docx into skills/vendor/anthropics-skills/anth-docx
 * Uses raw.githubusercontent.com (works when git clone is blocked).
 * Run: node scripts/vendor-anthropics-docx.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySkillOverlays } from './lib/skillVendorOverlays/applySkillOverlays.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'anthropics-skills');
const TARGET_DIR = path.join(VENDOR_ROOT, 'anth-docx');
const REF = 'main';
const BASE = `https://raw.githubusercontent.com/anthropics/skills/${REF}`;

const TREE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'data',
  'anthropics-docx-tree.json',
);

function loadPaths() {
  const data = JSON.parse(readFileSync(TREE_PATH, 'utf8'));
  return data.filter((p) => p.startsWith('skills/docx/'));
}

async function downloadText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} → ${response.status}`);
  }
  return response.text();
}

async function main() {
  const paths = loadPaths();

  rmSync(TARGET_DIR, { recursive: true, force: true });
  mkdirSync(TARGET_DIR, { recursive: true });

  for (const repoPath of paths) {
    const relative = repoPath.replace(/^skills\/docx\//, '');
    const dest = path.join(TARGET_DIR, relative);
    mkdirSync(path.dirname(dest), { recursive: true });
    const url = `${BASE}/${repoPath.replace(/\\/g, '/')}`;
    const content = await downloadText(url);
    writeFileSync(dest, content, 'utf8');
    console.log(`[vendor-anthropics-docx] ${relative}`);
  }

  writeFileSync(
    path.join(VENDOR_ROOT, 'ATTRIBUTION.md'),
    [
      '# anthropics-skills attribution',
      '',
      '- Source repository: https://github.com/anthropics/skills',
      `- Source ref: ${REF}`,
      '- Vendored skill: docx → anth-docx',
      `- Vendored at: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
    'utf8',
  );

  const overlay = applySkillOverlays(['anth-docx']);
  if (overlay.missing.length) {
    console.warn(`[vendor-anthropics-docx] overlay missing: ${overlay.missing.join(', ')}`);
  }

  console.log(`[vendor-anthropics-docx] done → ${TARGET_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
