#!/usr/bin/env node
/** PD-SAAS-FORK: verify platform feature flags + config defaults */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployFiles = ['scripts/release/pack.mjs', 'scripts/release/apply-cloud-perf-env.sh'];
const keys = [
  'PILOTDECK_PREFLIGHT_STUDIO',
  'PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM',
  'PILOTDECK_BENTO_DECK_EDITOR',
  'VITE_BENTO_DECK_PREVIEW',
];
let ok = true;

for (const f of deployFiles) {
  const text = readFileSync(path.join(ROOT, f), 'utf8');
  for (const k of keys) {
    if (!text.includes(k)) {
      console.error(`[platform:features] missing ${k} in ${f}`);
      ok = false;
    }
  }
}

const platformFeaturesPath = path.join(ROOT, 'config/platform-features.json');
if (!existsSync(platformFeaturesPath)) {
  console.error('[platform:features] missing config/platform-features.json');
  ok = false;
} else {
  const doc = JSON.parse(readFileSync(platformFeaturesPath, 'utf8'));
  if (doc.preflightStudio !== 'off') {
    console.error('[platform:features] preflightStudio must default to off');
    ok = false;
  }
  if (doc.bentoDeckEditor !== false) {
    console.error('[platform:features] bentoDeckEditor must default to false');
    ok = false;
  }
}

const platformFeaturesLib = path.join(ROOT, 'scripts/lib/platformFeatures.mjs');
if (!existsSync(platformFeaturesLib)) {
  console.error('[platform:features] missing scripts/lib/platformFeatures.mjs');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[platform:features] OK');
