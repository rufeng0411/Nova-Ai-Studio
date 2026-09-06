#!/usr/bin/env node
/**
 * Nova slide-manifest.json smoke: acceptance fixtures + aspect_ratio guard.
 * Run: npm run smoke:nova-ppt-manifest
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSlideManifest } from './lib/novaSlideManifestValidate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ACCEPTANCE_ROOT = path.join(
  REPO_ROOT,
  'skills/vendor/nova-1/nova-ppt-aesthetic-slides/acceptance',
);

const FIXTURES = [
  'enterprise-ai-training-2026',
  'new-consumer-brand-pitch',
];

let failed = 0;

for (const fixture of FIXTURES) {
  const deckDir = path.join(ACCEPTANCE_ROOT, fixture);
  const manifestPath = path.join(deckDir, 'slide-manifest.json');
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  const result = validateSlideManifest(manifest, {
    deckDir,
    requireCompletedImages: true,
  });
  if (!result.ok) {
    failed += 1;
    console.error(`[FAIL] ${fixture}`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
  } else {
    console.log(`[OK] ${fixture}`);
  }
}

const badRatio = validateSlideManifest({ ...JSON.parse(readFileSync(path.join(ACCEPTANCE_ROOT, FIXTURES[0], 'slide-manifest.json'), 'utf8')), aspect_ratio: '9.md' });
if (badRatio.ok) {
  failed += 1;
  console.error('[FAIL] aspect_ratio guard should reject 9.md');
} else {
  console.log('[OK] aspect_ratio guard rejects 9.md');
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log('\nNova slide-manifest smoke passed.');
