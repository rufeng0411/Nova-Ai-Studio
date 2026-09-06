#!/usr/bin/env node
// PD-SAAS-FORK: Slice A2 — anth-pptx overlay idempotency + no HyperFrames pollution
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySkillOverlays } from './lib/skillVendorOverlays/applySkillOverlays.mjs';
import { getOverlayEntry } from './lib/skillVendorOverlays/manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills/vendor/anthropics-skills/anth-pptx/SKILL.md');

function fail(msg) {
  console.error(`[anth-pptx-overlay-smoke] FAIL ${msg}`);
  process.exit(1);
}

if (!getOverlayEntry('anth-pptx')) fail('getOverlayEntry(anth-pptx) is empty');

const first = applySkillOverlays(['anth-pptx']);
const second = applySkillOverlays(['anth-pptx']);
if (first.missing.length || second.missing.length) {
  fail(`overlay missing=${[...first.missing, ...second.missing].join(',')}`);
}
if (!second.applied.includes('anth-pptx')) fail('second apply did not list anth-pptx');

if (!existsSync(SKILL_PATH)) fail(`missing ${SKILL_PATH}`);
const text = readFileSync(SKILL_PATH, 'utf8');
if (!text.startsWith('---')) fail('SKILL.md must start with YAML ---');
if (!/^name:\s*pptx\s*$/m.test(text.slice(0, text.indexOf('\n---\n', 4) + 8))) {
  if (!text.includes('\nname: pptx\n') && !text.startsWith('---\nname: pptx\n')) {
    fail('frontmatter must still contain name: pptx');
  }
}
const beginCount = text.split('<!-- NOVA-EXEC-BEGIN -->').length - 1;
const endCount = text.split('<!-- NOVA-EXEC-END -->').length - 1;
if (beginCount !== 1 || endCount !== 1) fail(`NOVA-EXEC markers begin=${beginCount} end=${endCount}`);
if (!text.includes('read_skill anth-pptx')) fail('missing read_skill anth-pptx');
if (!text.includes('presentation.pptx')) fail('missing presentation.pptx');
for (const banned of ['render_hyperframes', 'promo.mp4', 'hf-project']) {
  if (text.includes(banned)) fail(`HyperFrames leak: ${banned}`);
}
const beginIdx = text.indexOf('<!-- NOVA-EXEC-BEGIN -->');
const headingIdx = text.indexOf('# PPTX');
if (headingIdx < 0 || headingIdx < beginIdx) fail('# PPTX heading must follow NOVA-EXEC');

console.log('[anth-pptx-overlay-smoke] ok');
