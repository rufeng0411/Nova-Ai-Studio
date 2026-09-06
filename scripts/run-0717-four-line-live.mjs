#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 0717 四线实机回放编排（workers=1，保留 artifacts/0717-four-line-acceptance/）
 *
 * Usage:
 *   npm run test:0717-four-line-live -- --tier p0 --workers=1 --gate
 *   npm run test:0717-four-line-live -- --tier sample --gate
 *   npm run test:0717-four-line-live -- --tier full --gate
 *   npm run test:0717-four-line-live -- --structure-only --gate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { run0717FourLineLiveGateway, probe0717LiveStack } from './lib/run0717FourLineLiveGateway.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', '0717-four-line-acceptance');

const STRUCTURE_CASES = [
  'campaign-worldcup-razer-6slot',
  'image-generation-poster-916',
  'geo-audit-html-pdf-add',
  'nova-market-report-md-only',
  'argentina-spain-prediction-report',
  'spain-squad-html-report',
  'argentina-squad-html-report',
  'video-3-step',
  'market-add-html',
  'acquisition-research-video',
  '10-page-slides',
  'ipo-campaign',
  'geo-competitor-4-slot',
  'campaign-6-slot',
  'brainstorm-chat-first',
];

const P0_LIVE_CASES = ['video-3-step', '10-page-slides', 'campaign-6-slot'];
const SAMPLE_LIVE_CASES = ['market-add-html', 'geo-competitor-4-slot'];
const FULL_LIVE_CASES = [
  'video-3-step',
  'market-add-html',
  'acquisition-research-video',
  '10-page-slides',
  'ipo-campaign',
  'geo-competitor-4-slot',
  'campaign-6-slot',
  'brainstorm-chat-first',
];

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const tier = argValue('--tier', 'p0');
const gate = process.argv.includes('--gate');
const workers = Number.parseInt(argValue('--workers', '1'), 10);
const full = process.argv.includes('--full') || tier === 'full';
const structureOnly = process.argv.includes('--structure-only');

function runVitest(pattern) {
  const result = spawnSync('npx', ['vitest', 'run', pattern], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
  });
  return {
    exitCode: result.status ?? 1,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-8).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-8).join('\n'),
  };
}

async function main() {
  if (workers !== 1) {
    console.warn('[0717-four-line-live] forcing workers=1 for live replay safety');
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const structureVitest = runVitest(
    'tests/fixtures/four-line-0717-cursor-invariants.test.ts tests/fixtures/four-line-0717-invariants.test.ts',
  );

  const liveCases = full
    ? FULL_LIVE_CASES
    : tier === 'sample'
      ? SAMPLE_LIVE_CASES
      : tier === 'structure'
        ? []
        : P0_LIVE_CASES;

  const stackProbe = await probe0717LiveStack();
  let liveResult = {
    ok: true,
    skipped: true,
    reason: structureOnly ? 'structure-only mode' : 'not attempted',
    cases: [],
    passCount: 0,
    total: 0,
  };

  if (!structureOnly && liveCases.length > 0) {
    liveResult = await run0717FourLineLiveGateway({
      caseIds: liveCases,
      outDir: OUT_DIR,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    tier,
    workers: 1,
    gate,
    structureOnly,
    structureCases: STRUCTURE_CASES,
    liveCases,
    structureVitest,
    stackProbe,
    liveResult: {
      ok: liveResult.ok,
      skipped: liveResult.skipped,
      reason: liveResult.reason ?? null,
      passCount: liveResult.passCount ?? 0,
      total: liveResult.total ?? liveCases.length,
      cases: liveResult.cases ?? [],
      kpiPath: liveResult.kpiPath ? path.relative(REPO_ROOT, liveResult.kpiPath) : null,
    },
  };

  const manifestPath = path.join(OUT_DIR, 'run-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`[0717-four-line-live] manifest → ${path.relative(REPO_ROOT, manifestPath)}`);
  console.log(`[0717-four-line-live] structure vitest exit=${structureVitest.exitCode}`);

  let exitCode = 0;
  if (gate && structureVitest.exitCode !== 0) {
    console.error('[0717-four-line-live] FAIL structure fixture gate');
    exitCode = 1;
  }

  if (gate && !structureOnly && liveCases.length > 0) {
    if (liveResult.skipped) {
      console.error(`[0717-four-line-live] FAIL live gate: ${liveResult.reason ?? 'live stack unavailable'}`);
      exitCode = 1;
    } else if (!liveResult.ok) {
      console.error(
        `[0717-four-line-live] FAIL live gate: ${liveResult.passCount}/${liveResult.total} cases passed`,
      );
      exitCode = 1;
    } else {
      console.log(`[0717-four-line-live] live gate PASS ${liveResult.passCount}/${liveResult.total}`);
    }
  } else if (liveResult.skipped && liveCases.length > 0) {
    console.warn(`[0717-four-line-live] live skipped: ${liveResult.reason ?? 'unavailable'}`);
  }

  if (exitCode === 0) {
    console.log('[0717-four-line-live] PASS');
  }
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('[0717-four-line-live] fatal', error);
  process.exit(1);
});
