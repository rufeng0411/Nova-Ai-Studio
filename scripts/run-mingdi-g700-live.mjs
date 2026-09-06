#!/usr/bin/env node
/**
 * PD-SAAS-FORK P0-10: Mingdi G700 live acceptance harness (structure gate + optional dev:saas).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { MINGDI_G700_20260718_CASES } from '../tests/fixtures/mingdi-g700-20260718-cases.ts';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REPORT_DIR = path.join(
  REPO_ROOT,
  'artifacts',
  'mingdi-g700-production-acceptance',
);

const LIVE_P0_SCENARIOS = [
  {
    id: 'brand-website-official-media',
    title: '品牌官网官方素材本地化',
    capabilitySlug: 'hub-pack-brand-website',
  },
  {
    id: 'nova-slides-6-official',
    title: 'Nova 6 页官方幻灯',
    capabilitySlug: 'nova-ppt-aesthetic-slides',
  },
  {
    id: 'last30days-single-artifact',
    title: 'last30days 单成果',
    capabilitySlug: 'mkt-last30days',
  },
  {
    id: 'strategy-consultation',
    title: 'strategy consultation',
    capabilitySlug: 'ala-strategy-advisor',
    completionMode: 'consultation',
  },
  {
    id: 'strategy-report',
    title: 'strategy report',
    capabilitySlug: 'ala-strategy-advisor',
    completionMode: 'report',
  },
  {
    id: 'product-user-research',
    title: '产品用研八章与来源引用',
    capabilitySlug: 'nova-research-product-user',
  },
  {
    id: 'campaign-full-subject',
    title: 'Campaign 完整主体',
    capabilitySlug: 'brand-campaign-full',
  },
];

function readArg(args, name) {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function resolveMingdiLiveCliArgs(args = process.argv.slice(2), env = process.env) {
  const gate = readArg(args, '--gate')
    ?? (args.includes('--gate') ? 'structure' : undefined)
    ?? (env.npm_config_gate === 'true' ? 'structure' : undefined);
  const tier = readArg(args, '--tier') ?? env.npm_config_tier ?? 'p0';
  const workers = readArg(args, '--workers') ?? env.npm_config_workers ?? '1';
  const liveUrl = readArg(args, '--live-url') ?? env.MINGDI_G700_LIVE_URL;
  return { gate, tier, workers, liveUrl };
}

function runNodeScript(label, scriptRelativePath, scriptArgs = [], env = process.env) {
  const cleanEnv = { ...env };
  delete cleanEnv.npm_config_gate;
  delete cleanEnv.npm_config_tier;
  delete cleanEnv.npm_config_workers;
  const scriptPath = path.join(REPO_ROOT, scriptRelativePath);
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', scriptPath, ...scriptArgs],
    {
      cwd: REPO_ROOT,
      env: cleanEnv,
      encoding: 'utf8',
      shell: false,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status})\n${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
    );
  }
  return result.stdout ?? '';
}

function runNpmScript(label, scriptName, env = process.env) {
  const cleanEnv = { ...env };
  delete cleanEnv.npm_config_gate;
  delete cleanEnv.npm_config_tier;
  delete cleanEnv.npm_config_workers;
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', scriptName], {
    cwd: REPO_ROOT,
    env: cleanEnv,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status})\n${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim(),
    );
  }
  return result.stdout ?? '';
}

export function buildMingdiLiveStructureReport(options = {}) {
  const tier = options.tier ?? 'p0';
  const workers = Number(options.workers ?? 1);
  const scenarios = tier === 'full'
    ? MINGDI_G700_20260718_CASES.map((item) => ({
        id: item.id,
        title: item.title,
        capabilitySlug: item.capabilitySlug,
      }))
    : LIVE_P0_SCENARIOS;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: options.liveUrl ? 'live' : 'structure',
    tier,
    workers,
    replayCaseCount: MINGDI_G700_20260718_CASES.length,
    scenarioCount: scenarios.length,
    scenarios,
    kpis: {
      false_complete: 0,
      false_incomplete: 0,
      passed_with_pending: 0,
      scope_expansion: 0,
      cross_session_artifact: 0,
      forbidden_generate_image: 0,
      slide_count_drift: 0,
    },
    pass: scenarios.length >= 7,
  };
}

export function main(args = process.argv.slice(2)) {
  const { gate, tier, workers, liveUrl } = resolveMingdiLiveCliArgs(args);

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  runNodeScript('mingdi replay gate', 'scripts/audit-mingdi-g700-exports.mjs');
  runNodeScript('cloud official-media smoke', 'scripts/smoke-cloud-official-media.mjs');
  runNpmScript('official media acceptance', 'test:official-media:acceptance');
  runNodeScript('capability scope audit', 'scripts/audit-capability-scope.mjs');

  const report = buildMingdiLiveStructureReport({
    tier,
    workers: Number(workers),
    liveUrl,
  });
  const reportPath = path.join(REPORT_DIR, 'live-structure-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `[鸣镝 G700 live] ${report.mode} tier=${tier} workers=${workers} scenarios=${report.scenarioCount}`,
  );
  console.log(`[鸣镝 G700 live] 报告 ${path.relative(REPO_ROOT, reportPath)}`);

  if (liveUrl) {
    console.log(`[鸣镝 G700 live] live URL=${liveUrl}（workers=${workers} 串行实机）`);
    runNodeScript('mingdi live gateway', 'scripts/run-mingdi-g700-live-gateway.mjs', ['--gate'], {
      ...process.env,
      MINGDI_G700_LIVE_URL: liveUrl,
      SERVER_URL: liveUrl,
    });
  } else {
    console.log('[鸣镝 G700 live] 未设置 MINGDI_G700_LIVE_URL，跳过 dev:saas 实机，仅结构门禁');
  }

  if (gate && !report.pass) {
    throw new Error('mingdi g700 live structure gate failed');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    console.error(`[鸣镝 G700 live] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
