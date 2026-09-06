#!/usr/bin/env node
/**
 * Smoke: process-templates config + generated bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'config', 'process-templates.json');
const BUNDLE_PATH = path.join(REPO_ROOT, 'ui', 'src', 'generated', 'process-templates.json');
const VALID = new Set(['light', 'standard', 'full']);
const VALID_CATEGORY = new Set(['marketing', 'enterprise', 'geo', 'office', 'creation']);

function fail(msg) {
  console.error(`[process-templates-smoke] FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(CONFIG_PATH)) fail(`missing ${CONFIG_PATH}`);

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const templates = config.templates || [];
if (templates.length < 12) fail(`expected at least 12 templates, got ${templates.length}`);

if (!Array.isArray(config.categoryLevels) || config.categoryLevels.length !== 5) {
  fail(`expected 5 categoryLevels, got ${config.categoryLevels?.length}`);
}
for (const level of config.categoryLevels) {
  if (!VALID_CATEGORY.has(level.id)) fail(`bad categoryLevels id ${level.id}`);
  if (level.id === 'education' || level.id === 'brainstorming') {
    fail('categoryLevels must not include education/brainstorming');
  }
}

const ids = new Set();
const counts = { light: 0, standard: 0, full: 0 };
const categoryCounts = Object.fromEntries([...VALID_CATEGORY].map((c) => [c, 0]));

for (const t of templates) {
  if (ids.has(t.id)) fail(`duplicate id ${t.id}`);
  ids.add(t.id);
  if (!VALID.has(t.complexity)) fail(`${t.id}: bad complexity`);
  counts[t.complexity] += 1;
  if (!VALID_CATEGORY.has(t.category)) fail(`${t.id}: bad or missing category`);
  if (t.category === 'education' || t.category === 'brainstorming') {
    fail(`${t.id}: forbidden category`);
  }
  categoryCounts[t.category] += 1;
  for (const loc of ['zh-CN', 'en']) {
    if (!t.prompt?.[loc]?.trim()) fail(`${t.id}: missing prompt.${loc}`);
    if (!t.title?.[loc]?.trim()) fail(`${t.id}: missing title.${loc}`);
  }
  if (!Array.isArray(t.flow) || t.flow.length < 2) fail(`${t.id}: flow too short`);
  if (!/\d+\./.test(t.prompt['zh-CN'])) fail(`${t.id}: prompt should list numbered steps`);
}

for (const level of VALID) {
  if (counts[level] === 0) fail(`no templates for ${level}`);
}
if ((categoryCounts.enterprise || 0) < 6) {
  fail(`expected >=6 enterprise templates, got ${categoryCounts.enterprise}`);
}

if (!fs.existsSync(BUNDLE_PATH)) {
  fail(`missing bundle — run node scripts/generate-process-templates.mjs`);
}
const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'));
if (!Array.isArray(bundle.categoryLevels) || bundle.categoryLevels.length !== 5) {
  fail('bundle missing categoryLevels');
}
if (!bundle.templates?.every((t) => VALID_CATEGORY.has(t.category))) {
  fail('bundle templates missing category');
}

console.log('[process-templates-smoke] OK config');
console.log(
  `[process-templates-smoke] OK templates=${templates.length} light=${counts.light} standard=${counts.standard} full=${counts.full} enterprise=${categoryCounts.enterprise}`,
);
