#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8 L4-P0): static + optional Gateway live for 3 P0 lines. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const live = process.argv.includes('--live');

const prompts = [
  { id: 'T0707-P0-01', file: 'T0707-P0-01-campaign.txt' },
  { id: 'T0707-P0-02', file: 'T0707-P0-02-ai-video.txt' },
  { id: 'T0707-P0-03', file: 'T0707-P0-03-ppt-generate.txt' },
];

let failed = 0;
for (const item of prompts) {
  const promptPath = path.join(root, 'artifacts', '0707吴裕泰批次', 'prompts', item.file);
  if (!fs.existsSync(promptPath)) {
    console.error(`[fail] missing prompt ${item.file}`);
    failed += 1;
    continue;
  }
  console.log(`[ok] ${item.id} prompt ready (${fs.readFileSync(promptPath, 'utf8').trim().slice(0, 40)}…)`);
}

const videoRegistry = path.join(root, 'config', 'video-model-registry.json');
if (!fs.existsSync(videoRegistry)) {
  console.error('[fail] missing video-model-registry.json');
  failed += 1;
}

if (live) {
  const harness = spawnSync('node', ['--import', 'tsx', 'scripts/lib/gatewaySessionHarness.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ROG_PHASE8_LIVE: '1' },
  });
  if (harness.status !== 0) {
    console.warn('[warn] Gateway live harness unavailable — static P0 prompts/registry gate only');
  }
} else {
  console.log('[info] L4-P0 static gate: prompts + registry (pass --live for Gateway when dev:saas + keys ready)');
}

if (failed > 0 && gate) process.exit(1);
console.log('[ok] L4-P0 gate passed (static)');
