#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Three-case speed RCA — offline unit gate + optional Gateway live (--live --gate).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runThreeCaseSpeedRcaLiveGateway } from './lib/runThreeCaseSpeedRcaLiveGateway.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const gate = args.includes('--gate');
const live = args.includes('--live');

function runOfflineUnit() {
  const vitestArgs = [
    'vitest',
    'run',
    'tests/saas/three-case-speed-rca.replay.test.ts',
    'tests/saas/content-flywheel-phantom-guard.test.ts',
    'tests/saas/cross-task-scope-guard.test.ts',
    'tests/router/should-bypass-orchestration.test.ts',
    'tests/router/orchestration-prompt-taskdir.test.ts',
  ];
  const result = spawnSync('npx', vitestArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PILOTDECK_ORCH_BYPASS_MATRIX_GEO: '1',
      PILOTDECK_MATRIX_CORE_GT_PASS: '1',
      PILOTDECK_SESSION_DELIVERABLE_MANIFEST: '1',
    },
  });
  return result.status === 0 ? 0 : result.status ?? 1;
}

async function runLiveGate() {
  const serverUrl = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL;
  if (!serverUrl) {
    console.log('[three-case-rca] SKIP live: set SERVER_URL (Bridge, e.g. http://127.0.0.1:7990)');
    return gate ? 1 : 0;
  }
  const outDir = path.join(REPO_ROOT, 'artifacts', 'three-case-speed-rca-20260726');
  const result = await runThreeCaseSpeedRcaLiveGateway({ outDir });
  fs.writeFileSync(
    path.join(outDir, 'run-manifest.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  if (result.skipped) {
    console.log(`[three-case-rca] SKIP: ${result.reason}`);
    return gate ? 1 : 0;
  }
  console.log(`[three-case-rca] ${result.passCount}/${result.total} PASS → ${path.relative(REPO_ROOT, outDir)}`);
  return result.ok ? 0 : 1;
}

if (live && gate) {
  process.exit(await runLiveGate());
}

const offlineCode = runOfflineUnit();
if (offlineCode !== 0) process.exit(offlineCode);

if (gate && !live) {
  console.log('[three-case-rca] offline unit gate PASS; use --live --gate for Gateway harness');
}
process.exit(0);
