#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: 鸣镝 G700 全量验收编排 — 不中途退出，跑完出报告。
 * 覆盖：离线门禁 / VAP / Playwright 问题案例复测 / Gateway 多场景配图实机。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  probeServer,
  resolveLiveServerUrl,
  runMingdiG700LiveGateway,
} from './run-mingdi-g700-live-gateway.mjs';
import { MINGDI_G700_LIVE_SCENARIOS } from './lib/mingdiG700LiveScenarios.mjs';

const VAP_VISUAL_SCENARIO_IDS = [
  'nova-slides-official-20260719',
  'html-demo-official-20260719',
  'campaign-official-20260719',
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'mingdi-g700-production-acceptance');
const REPORT_JSON = path.join(OUT_DIR, 'vap-g700-full-verification-report.json');
const REPORT_MD = path.join(
  REPO_ROOT,
  'docs',
  'mingdi-g700-vap-full-verification-report-20260719.zh-CN.md',
);

function npmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function npxCmd() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function runNpm(script, extraEnv = {}, logName = script) {
  const logPath = path.join(OUT_DIR, `verify-${logName.replace(/[^a-z0-9]+/gi, '-')}.log`);
  const result = spawnSync(npmCmd(), ['run', script], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
  });
  const body = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  fs.writeFileSync(logPath, body, 'utf8');
  return {
    id: script,
    command: `npm run ${script}`,
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    log: path.relative(REPO_ROOT, logPath),
    tail: body.split('\n').slice(-8).join('\n').trim(),
  };
}

function runNode(relativePath, args = [], extraEnv = {}, label = relativePath) {
  const logPath = path.join(OUT_DIR, `verify-${label.replace(/[^a-z0-9]+/gi, '-')}.log`);
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(REPO_ROOT, relativePath), ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
      shell: false,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  const body = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  fs.writeFileSync(logPath, body, 'utf8');
  return {
    id: label,
    command: `node --import tsx ${relativePath} ${args.join(' ')}`.trim(),
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    log: path.relative(REPO_ROOT, logPath),
    tail: body.split('\n').slice(-8).join('\n').trim(),
  };
}

function runPlaywright(specs, extraEnv = {}, label = 'playwright') {
  const logPath = path.join(OUT_DIR, `verify-${label}.log`);
  const args = [
    'playwright',
    'test',
    ...specs,
    '--config',
    'ui/playwright.config.ts',
    '--reporter=line',
  ];
  const result = spawnSync(npxCmd(), args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 20 * 1024 * 1024,
  });
  const body = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  fs.writeFileSync(logPath, body, 'utf8');
  return {
    id: label,
    command: `npx ${args.join(' ')}`,
    ok: result.status === 0,
    exitCode: result.status ?? 1,
    log: path.relative(REPO_ROOT, logPath),
    tail: body.split('\n').slice(-12).join('\n').trim(),
  };
}

async function ensureDev(serverUrl) {
  if (await probeServer(serverUrl)) return { started: false, url: serverUrl };
  console.log('[vap-verify] 启动 dev:saas…');
  const child = spawn(npmCmd(), ['run', 'dev:saas'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: true,
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  child.unref();
  const deadline = Date.now() + 420_000;
  while (Date.now() < deadline) {
    const url = await resolveLiveServerUrl();
    if (url && await probeServer(url)) {
      return { started: true, url };
    }
    // eslint-disable-next-line no-await-in-loop
    await delay(5_000);
  }
  return { started: true, url: null };
}

function statusOf(row) {
  if (row.skipped) return 'SKIP';
  return row.ok ? 'PASS' : 'FAIL';
}

function renderMarkdown(report) {
  const lines = [
    '# 鸣镝 G700 + VAP 全量验收报告（2026-07-19）',
    '',
    `**生成时间**：${report.generatedAt}`,
    '',
    `## 总判定：**${report.overallVerdict}**`,
    '',
    report.summary,
    '',
    '## 1. 离线结构门禁',
    '',
    '| 项 | 状态 | 说明 | 日志 |',
    '|----|------|------|------|',
  ];
  for (const row of report.phases.offline) {
    lines.push(`| ${row.id} | ${statusOf(row)} | ${row.detail ?? '—'} | \`${row.log ?? '—'}\` |`);
  }
  lines.push('', '## 2. VAP / 通用配图发现', '', '| 项 | 状态 | 说明 | 日志 |', '|----|------|------|------|');
  for (const row of report.phases.vap) {
    lines.push(`| ${row.id} | ${statusOf(row)} | ${row.detail ?? '—'} | \`${row.log ?? '—'}\` |`);
  }
  lines.push('', '## 3. Playwright 问题案例复测', '', '| 项 | 状态 | 说明 | 日志 |', '|----|------|------|------|');
  for (const row of report.phases.playwright) {
    lines.push(`| ${row.id} | ${statusOf(row)} | ${row.detail ?? '—'} | \`${row.log ?? '—'}\` |`);
  }
  lines.push('', '## 4. Gateway 多场景自动配图/生图实机', '', '| 场景 | 状态 | KPI | 耗时 |', '|------|------|-----|------|');
  if (report.phases.live.skipped) {
    lines.push(`| — | SKIP | ${report.phases.live.reason} | — |`);
  } else {
    for (const row of report.phases.live.scenarios ?? []) {
      const kpiKeys = Object.entries(row.kpis ?? {})
        .filter(([, v]) => Number(v) > 0)
        .map(([k]) => k)
        .join(', ') || '无违规';
      lines.push(
        `| ${row.id} | ${row.ok && !row.hasKpiFail ? 'PASS' : 'FAIL'} | ${kpiKeys} | ${row.durationMs ?? '—'}ms |`,
      );
    }
  }
  lines.push('', '## 5. Bridge 稳定性（抽样）', '', '| 项 | 状态 | 说明 |', '|----|------|------|');
  for (const row of report.phases.bridge) {
    lines.push(`| ${row.id} | ${statusOf(row)} | ${row.detail ?? row.tail ?? '—'} |`);
  }
  lines.push('', '## 6. 结论与阻塞项', '');
  for (const item of report.blockingItems) {
    lines.push(`- ${item}`);
  }
  lines.push('', '## 7. 产物路径', '');
  lines.push(`- JSON：\`${path.relative(REPO_ROOT, REPORT_JSON)}\``);
  lines.push(`- 本报告：\`${path.relative(REPO_ROOT, REPORT_MD)}\``);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const matrix = { offline: [], vap: [], playwright: [], bridge: [], live: { skipped: false } };

  console.log('\n[vap-verify] === Phase A: 离线门禁 ===');
  matrix.offline.push(runNpm('test:mingdi-g700:unit'));
  matrix.offline.push(runNpm('test:mingdi-g700:replay'));
  matrix.offline.push(runNpm('test:export-four-line-parity'));
  matrix.offline.push(runNpm('check:saas-fork'));
  matrix.offline.push(runNode('scripts/audit-capability-scope.mjs', [], {}, 'scope-audit'));

  console.log('\n[vap-verify] === Phase B: VAP / 官方素材 / 五案 replay ===');
  matrix.vap.push(runNpm('test:visual-asset-platform:acceptance'));
  matrix.vap.push(runNpm('test:official-media:acceptance'));
  matrix.vap.push(runNode('scripts/replay-mingdi-g700-20260719-five-cases.mjs', ['--gate'], {}, 'vap-five-case-replay'));

  console.log('\n[vap-verify] === Phase C: Playwright 成果/四线/质量复测 ===');
  const pwEnv = {
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081',
    PLAYWRIGHT_SERVER_URL: process.env.PLAYWRIGHT_SERVER_URL || process.env.SERVER_URL || 'http://127.0.0.1:7990',
  };
  matrix.playwright.push(
    runPlaywright(
      [
        'ui/e2e/prelaunch/deliverable-five-entry.spec.ts',
        'ui/e2e/saas/deliverable-preview-click.spec.ts',
        'ui/e2e/saas/deliverable-summary-sdm-regression.spec.ts',
      ],
      pwEnv,
      'playwright-deliverable-regression',
    ),
  );

  console.log('\n[vap-verify] === Phase D: dev 探测 + Bridge browse ===');
  const seedUrl = process.env.SERVER_URL || process.env.MINGDI_G700_LIVE_URL || 'http://127.0.0.1:7990';
  const dev = await ensureDev(seedUrl);
  const serverUrl = dev.url ?? seedUrl;
  const bridgeEnv = { SERVER_URL: serverUrl, PLAYWRIGHT_SERVER_URL: serverUrl };

  if (!dev.url) {
    matrix.bridge.push({
      id: 'bridge-browse',
      ok: false,
      skipped: true,
      detail: 'dev:saas 420s 内未就绪，跳过 browse/live',
    });
    matrix.live = { skipped: true, reason: 'Bridge 未就绪' };
  } else {
    console.log(`[vap-verify] Bridge 就绪 ${serverUrl}`);
    matrix.bridge.push(runNpm('test:bridge-stability:browse', bridgeEnv, 'bridge-browse'));

    console.log('\n[vap-verify] === Phase E: Gateway VAP 视觉三场景（0719）===');
    let liveReport = null;
    try {
      liveReport = await runMingdiG700LiveGateway({
        serverUrl,
        scenarios: MINGDI_G700_LIVE_SCENARIOS.filter((item) =>
          VAP_VISUAL_SCENARIO_IDS.includes(item.id),
        ),
      });
      const visualIds = new Set(VAP_VISUAL_SCENARIO_IDS);
      const scenarios = (liveReport?.scenarios ?? []).filter((row) => visualIds.has(row.id));
      matrix.live = {
        skipped: false,
        serverUrl,
        scenarios: scenarios.map((row) => {
          const kpiFail = Object.entries(row.kpis ?? {}).some(([, v]) => Number(v) > 0);
          return { ...row, hasKpiFail: kpiFail, ok: row.ok && !kpiFail };
        }),
        pass: scenarios.every((row) => {
          const kpiFail = Object.entries(row.kpis ?? {}).some(([, v]) => Number(v) > 0);
          return row.ok && !kpiFail && (row.durationMs ?? 0) > 10_000;
        }),
        fullReport: path.relative(REPO_ROOT, path.join(OUT_DIR, 'live-p0-report.json')),
      };
    } catch (error) {
      matrix.live = {
        skipped: false,
        error: error instanceof Error ? error.message : String(error),
        pass: false,
      };
    }
  }

  const offlinePass = matrix.offline.every((r) => r.ok);
  const vapPass = matrix.vap.every((r) => r.ok);
  const pwPass = matrix.playwright.every((r) => r.ok);
  const bridgePass = matrix.bridge.every((r) => r.ok || r.skipped);
  const livePass = matrix.live.skipped ? false : Boolean(matrix.live.pass);

  const blockingItems = [];
  if (!offlinePass) blockingItems.push('离线结构门禁存在 FAIL');
  if (!vapPass) blockingItems.push('VAP/官方素材/五案 replay 存在 FAIL');
  if (!pwPass) blockingItems.push('Playwright 成果四线复测存在 FAIL（可能 dev UI 未起或端口不对）');
  if (matrix.live.skipped) {
    blockingItems.push('Gateway 视觉实机 SKIP — dev:saas 未就绪');
  } else if (!livePass) {
    blockingItems.push('Gateway VAP 三场景实机未达标（子秒空转 / 无配图工具 / KPI 违规）');
  }
  if (!bridgePass) blockingItems.push('Bridge browse 未通过');

  let overallVerdict = 'NO_PRODUCTION_GO';
  if (offlinePass && vapPass && pwPass && livePass && bridgePass) {
    overallVerdict = 'STRUCTURAL_AND_LIVE_PASS';
  } else if (offlinePass && vapPass) {
    overallVerdict = 'STRUCTURAL_PASS_LIVE_PENDING';
  }

  const report = {
    schemaVersion: 1,
    reportTitle: '鸣镝 G700 + VAP 全量验收',
    generatedAt: new Date().toISOString(),
    startedAt,
    overallVerdict,
    productionGo: overallVerdict === 'STRUCTURAL_AND_LIVE_PASS',
    summary:
      `离线门禁 ${offlinePass ? '全绿' : '有失败'}；VAP ${vapPass ? '全绿' : '有失败'}；`
      + `Playwright ${pwPass ? '全绿' : '有失败'}；Gateway 视觉实机 ${livePass ? '达标' : '未达标/跳过'}。`,
    phases: matrix,
    blockingItems,
    env: {
      serverUrl: dev.url ?? null,
      playwrightBase: pwEnv.PLAYWRIGHT_BASE_URL,
      officialSourceRootsPath:
        process.env.PILOTDECK_OFFICIAL_SOURCE_ROOTS_PATH
        ?? 'config/official-source-roots.json (CI 空 roots；dev 用 g700-canary fixture)',
    },
  };

  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(REPORT_MD, renderMarkdown(report), 'utf8');

  console.log(`\n[vap-verify] JSON → ${path.relative(REPO_ROOT, REPORT_JSON)}`);
  console.log(`[vap-verify] MD   → ${path.relative(REPO_ROOT, REPORT_MD)}`);
  console.log(`[vap-verify] verdict=${overallVerdict}`);
}

main().catch((error) => {
  console.error(`[vap-verify] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
