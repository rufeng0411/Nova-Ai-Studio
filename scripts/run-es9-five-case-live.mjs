#!/usr/bin/env node
/**
 * PD-SAAS-FORK ES9: offline vitest replay OR Gateway live harness (--gate --live).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ES9_CASE_IDS } from './lib/es9FiveCaseLiveCases.mjs';
import { runEs9FiveCaseLiveGateway } from './lib/runEs9FiveCaseLiveGateway.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const gate = args.includes('--gate');
const live = args.includes('--live');
const casesIdx = args.indexOf('--cases');
const caseFilter = casesIdx >= 0 ? args[casesIdx + 1]?.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

function runOfflineReplay() {
  const filterIdx = args.indexOf('--filter');
  const filter = filterIdx >= 0 ? args[filterIdx + 1] : undefined;
  const vitestArgs = [
    'vitest',
    'run',
    'tests/es9-three-case-replay.test.ts',
    'tests/saas/assistantCompletionGate.test.ts',
    'tests/saas/validateDeliverablesEngine.progress-alone.test.ts',
    'src/saas/deliverables/deliverableChecklistAuthority.test.ts',
  ];
  if (filter) vitestArgs.push('-t', filter);

  const result = spawnSync('npx', vitestArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PILOTDECK_SESSION_DELIVERABLE_MANIFEST: '1',
      PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES: '1',
      PILOTDECK_SDM_HTML_REPORT_ALIAS: '1',
      PILOTDECK_RESEARCH_PASSED_GT_STRICT_HTML: '1',
    },
  });
  return result.status === 0 ? 0 : result.status ?? 1;
}

async function runLiveGate() {
  const serverUrl = process.env.SERVER_URL || process.env.PILOTDECK_GATEWAY_URL;
  if (!serverUrl) {
    console.log('[es9-live] SKIP: set SERVER_URL (Bridge, e.g. http://127.0.0.1:7990)');
    return 0;
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outDir = path.join(REPO_ROOT, 'artifacts', `es9-live-${stamp}`);
  const caseIds = caseFilter?.length ? caseFilter : ES9_CASE_IDS;

  const result = await runEs9FiveCaseLiveGateway({ caseIds, outDir });
  fs.writeFileSync(
    path.join(outDir, 'run-manifest.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );

  if (result.skipped) {
    console.log(`[es9-live] SKIP: ${result.reason}`);
    return gate ? 1 : 0;
  }

  console.log(`[es9-live] ${result.passCount}/${result.total} PASS → ${path.relative(REPO_ROOT, outDir)}`);
  return result.ok ? 0 : 1;
}

if (live && gate) {
  const code = await runLiveGate();
  process.exit(code);
}

const offlineCode = runOfflineReplay();
if (offlineCode !== 0) process.exit(offlineCode);

if (gate && !live) {
  console.log('[es9-live] offline gate PASS; use --live for Gateway harness');
}
process.exit(0);
