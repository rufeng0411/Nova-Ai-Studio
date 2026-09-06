#!/usr/bin/env node
// PD-SAAS-FORK: Slice B smoke — ppt-master 4.8.0 disk + catalog + overlay invariants
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills/vendor/ppt-master/SKILL.md');
const ATTR = path.join(ROOT, 'skills/vendor/ppt-master/ATTRIBUTION.md');
const PIN = 'a160e776b7faff5d2227d180d0f31c6253056fae';

function fail(msg) {
  console.error(`[ppt-master-smoke] FAIL ${msg}`);
  process.exit(1);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

if (!existsSync(SKILL)) fail('missing SKILL.md');
const text = readFileSync(SKILL, 'utf8');
if (!text.startsWith('---')) fail('SKILL.md must start with YAML ---');
if (!text.includes('4.8.0')) fail('missing version 4.8.0');
if (count(text, '<!-- NOVA-EXEC-BEGIN -->') !== 1) fail('NOVA-EXEC-BEGIN count');
if (text.includes('promo.mp4') || text.includes('render_hyperframes')) {
  fail('HyperFrames pollution');
}
if (count(text, 'python3 "${SKILL_DIR}/scripts/attribution_guard.py"') !== 1) {
  fail('attribution_guard marker count');
}
if (!existsSync(path.join(ROOT, 'skills/vendor/ppt-master/launch.profile.json'))) {
  fail('missing launch.profile.json');
}
if (!existsSync(path.join(ROOT, 'skills/vendor/ppt-master/workflows/routing.md'))) {
  fail('missing workflows/routing.md');
}
if (!existsSync(path.join(ROOT, 'skills/vendor/ppt-master/scripts/confirm_ui/static/catalogs.json'))) {
  fail('missing catalogs.json');
}
if (!existsSync(path.join(ROOT, 'skills/vendor/ppt-master/LICENSE'))) fail('missing LICENSE');
if (!existsSync(ATTR)) fail('missing ATTRIBUTION.md');
const attr = readFileSync(ATTR, 'utf8');
if (!attr.includes(PIN)) fail('ATTRIBUTION missing pin SHA');
if (/- Commit:\s*main\b|zip\/refs\/heads\/main/.test(attr)) fail('ATTRIBUTION must not pin floating main');

const catalog = JSON.parse(readFileSync(path.join(ROOT, 'config/capabilities.catalog.json'), 'utf8'));
const row = (catalog.skills || []).find((s) => s.slug === 'ppt-master');
if (!row) fail('catalog missing ppt-master');

console.log('[ppt-master-smoke] ok version=4.8.0');
