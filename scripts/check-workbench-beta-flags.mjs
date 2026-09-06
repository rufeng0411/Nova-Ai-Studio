#!/usr/bin/env node
/**
 * PD-SAAS-FORK: ensure workbench beta 1.1 flags exist in three sync points.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = [
  'VITE_WORKBENCH_BETA_11',
  'VITE_WORKBENCH_TOUR',
  'VITE_TURN_USAGE_FOOTER',
  'VITE_POST_DELIVERABLE_NEXT',
];

const files = [
  join(root, 'scripts/lib/devLauncherCore.mjs'),
  join(root, 'scripts/release/pack.mjs'),
  join(root, 'scripts/release/apply-cloud-perf-env.sh'),
];

let failed = false;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const key of KEYS) {
    if (!text.includes(key)) {
      console.error(`[workbench-beta-flags] MISSING ${key} in ${file}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('[workbench-beta-flags] OK — keys present in pack / apply-cloud / devLauncherCore');
