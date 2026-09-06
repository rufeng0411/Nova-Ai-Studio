#!/usr/bin/env node
/**
 * Validates PD-SAAS-FORK discipline: manifest entries must exist on disk and
 * carry the marker comment in the listed file (or a same-dir sibling for .js bridges).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(REPO_ROOT, 'config', 'pilotdeck-core-fork.manifest.json');
const MARKER = 'PD-SAAS-FORK';

function loadManifest() {
  const raw = readFileSync(MANIFEST, 'utf8');
  return JSON.parse(raw);
}

function hasMarker(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return content.includes(MARKER);
}

function main() {
  const manifest = loadManifest();
  const entries = manifest.entries ?? [];
  let failed = 0;

  for (const entry of entries) {
    const rel = entry.path;
    const abs = join(REPO_ROOT, rel);
    if (!existsSync(abs)) {
      console.error(`[fork-check] missing file: ${rel}`);
      failed += 1;
      continue;
    }
    if (!hasMarker(abs)) {
      console.error(`[fork-check] missing ${MARKER} in ${rel} (${entry.module})`);
      failed += 1;
      continue;
    }
    console.log(`[fork-check] ok ${rel}`);
  }

  if (failed > 0) {
    console.error(`[fork-check] ${failed} issue(s)`);
    process.exit(1);
  }
  console.log(`[fork-check] all ${entries.length} manifest entries verified`);
}

main();
