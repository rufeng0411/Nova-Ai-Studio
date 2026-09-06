#!/usr/bin/env node
/**
 * UI bundle regression: pd-geo in catalog overrides path + 15 process templates.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesPath = path.join(REPO_ROOT, 'config', 'process-templates.json');
const overridesPath = path.join(REPO_ROOT, 'config', 'capabilities.overrides.json');

function fail(msg) {
  console.error(`[ui-aigeo-regression] FAIL: ${msg}`);
  process.exit(1);
}

const templates = JSON.parse(readFileSync(templatesPath, 'utf8'));
const ids = templates.templates.map((t) => t.id);
const geoIds = ['geo-visibility-quick', 'geo-visibility-standard', 'geo-brand-full'];
for (const id of geoIds) {
  if (!ids.includes(id)) fail(`missing process template ${id}`);
}
if (templates.templates.length < 15) {
  fail(`expected >= 15 templates, got ${templates.templates.length}`);
}

const overrides = JSON.parse(readFileSync(overridesPath, 'utf8'));
if (!overrides.skills?.['pd-geo']) fail('pd-geo missing in capabilities.overrides');
if (overrides.skills['mkt-ai-seo']?.stage !== 'measure') {
  fail('mkt-ai-seo should be stage measure');
}

const generated = path.join(REPO_ROOT, 'ui', 'src', 'generated', 'process-templates.json');
if (existsSync(generated)) {
  const gen = JSON.parse(readFileSync(generated, 'utf8'));
  if (gen.templates?.length < 15) {
    fail('generated process-templates.json stale — run templates:gen');
  }
}

console.log('[ui-aigeo-regression] OK templates and overrides');
