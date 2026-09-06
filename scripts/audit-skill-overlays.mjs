#!/usr/bin/env node
/**
 * PD-SAAS-FORK: verify skill vendor overlays — exit 1 if any check fails.
 * Run: npm run audit:skill-overlays
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OVERLAY_ENTRIES } from './lib/skillVendorOverlays/manifest.mjs';
import { buildNovaExecBlock } from './lib/skillVendorOverlays/novaExecOverlay.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {string[]} */
const failures = [];

function readText(absPath) {
  try {
    return readFileSync(absPath, 'utf8');
  } catch {
    return '';
  }
}

function runCheck(entry, check) {
  const skillDir = path.join(REPO_ROOT, entry.skillDir);
  if (!existsSync(skillDir)) {
    failures.push(`${entry.slug}: skill dir missing (${entry.skillDir})`);
    return;
  }
  if (check.type === 'file_exists') {
    const target = path.join(skillDir, check.path);
    if (!existsSync(target)) failures.push(`${entry.slug}: missing file ${check.path}`);
    return;
  }
  if (check.type === 'contains') {
    const target = path.join(skillDir, check.path || 'SKILL.md');
    const text = readText(target);
    if (!text.includes(check.text)) {
      failures.push(`${entry.slug}: ${check.path || 'SKILL.md'} missing "${check.text.slice(0, 40)}…"`);
    }
    return;
  }
  if (check.type === 'nova_exec') {
    const slug = check.slug || entry.slug;
    const skillPath = path.join(skillDir, 'SKILL.md');
    const novaPath = path.join(skillDir, 'NOVA-EXEC.md');
    const skillText = readText(skillPath);
    const novaText = readText(novaPath);
    if (!skillText.includes('NOVA-EXEC-BEGIN') || !skillText.includes('NOVA-EXEC-END')) {
      failures.push(`${entry.slug}: SKILL.md missing NOVA-EXEC markers`);
    }
    if (!novaText.includes('NOVA-EXEC-BEGIN')) {
      failures.push(`${entry.slug}: NOVA-EXEC.md missing`);
    }
    const isSlideshow = slug === 'hf-slideshow';
    if (!isSlideshow && !skillText.includes('render_hyperframes')) {
      failures.push(`${entry.slug}: SKILL.md missing render_hyperframes`);
    }
    const expected = buildNovaExecBlock(slug, isSlideshow);
    if (novaText.trim() !== expected.trim()) {
      failures.push(`${entry.slug}: NOVA-EXEC.md out of sync with overlay template`);
    }
  }
}

function main() {
  for (const entry of OVERLAY_ENTRIES) {
    for (const check of entry.checks) {
      runCheck(entry, check);
    }
  }

  const missingDirs = OVERLAY_ENTRIES.filter(
    (e) => !existsSync(path.join(REPO_ROOT, e.skillDir)),
  ).map((e) => e.slug);

  console.log(`[audit:skill-overlays] entries=${OVERLAY_ENTRIES.length} failures=${failures.length}`);
  if (missingDirs.length) {
    console.log(`[audit:skill-overlays] note: ${missingDirs.length} skill dirs absent (checks skipped where dir missing)`);
  }
  if (failures.length) {
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('[audit:skill-overlays] PASS — 0 missing');
}

main();
