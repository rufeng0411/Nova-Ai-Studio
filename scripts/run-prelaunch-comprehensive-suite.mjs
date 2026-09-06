#!/usr/bin/env node
/**
 * PD-SAAS-FORK: ECS 4C8G 代理 — 上线前全面测试编排器（含 UI 卡顿/假死专项）。
 *
 * 维度（12）：
 *   functional · stability · ui-responsiveness · load · stress · memory
 *   security · chaos · db-pressure · dialogue-concurrency · extreme-load · extreme-concurrency
 *
 * Usage:
 *   node scripts/run-prelaunch-comprehensive-suite.mjs
 *   node scripts/run-prelaunch-comprehensive-suite.mjs --skip-extreme
 *   node scripts/run-prelaunch-comprehensive-suite.mjs --skip-offline --skip-extreme
 *   node scripts/run-prelaunch-comprehensive-suite.mjs --focus-ui
 *
 * Env:
 *   SERVER_URL=http://127.0.0.1:7990
 *   BASE_URL=http://127.0.0.1:8081
 *   DIAG_USER=admin  DIAG_PASS=SAAS_ADMIN_PASSWORD  (Playwright 会话切换)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGateLock, releaseGateLock } from './lib/gateMutex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'prelaunch-comprehensive');
const LOG_FILE = path.join(OUT_DIR, 'suite-log.jsonl');
const SUMMARY_FILE = path.join(OUT_DIR, 'summary.json');

const skipExtreme = process.argv.includes('--skip-extreme');
const skipLive = process.argv.includes('--skip-live');
const skipOffline = process.argv.includes('--skip-offline');
const focusUi = process.argv.includes('--focus-ui');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeCmd = process.execPath;
const isWindowsShellScript = (cmd) => process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(cmd);

const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const BASE = (process.env.BASE_URL || process.env.VITE_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');
const hasPg = Boolean(process.env.SAAS_DATABASE_URL?.trim());

const prodEnv = {
  SERVER_URL: SERVER,
  VITE_URL: BASE,
  BASE_URL: BASE,
  PLAYWRIGHT_BASE_URL: BASE,
  DIAG_USER: process.env.DIAG_USER || 'admin',
  DIAG_PASS: process.env.DIAG_PASS || 'SAAS_ADMIN_PASSWORD',
  PILOTDECK_HISTORY_SANITIZE: '1',
  PILOTDECK_HISTORY_TAIL_READ: '1',
  PILOTDECK_HISTORY_MESSAGE_CACHE: '1',
  SAAS_CONVERSATION_CATALOG: '1',
  SAAS_LOGIN_RATE_IP_PER_MIN: process.env.SAAS_LOGIN_RATE_IP_PER_MIN || '1000',
  SAAS_LOGIN_RATE_USER_PER_MIN: process.env.SAAS_LOGIN_RATE_USER_PER_MIN || '1000',
};

/** @type {Array<{ dimension: string, phase: string, name: string, ok: boolean, detail: string, durationMs: number, at: string, blocker?: boolean }>} */
const steps = [];
const preflight = { checks: [], at: new Date().toISOString() };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logStep(dimension, phase, name, ok, detail = '', durationMs = 0, blocker = false) {
  const entry = { dimension, phase, name, ok, detail, durationMs, at: new Date().toISOString(), blocker };
  steps.push(entry);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  console.log(
    `\n[${ok ? 'PASS' : 'FAIL'}] [${dimension}] ${name}${detail ? ` — ${detail}` : ''} (${Math.round(durationMs / 1000)}s)`,
  );
}

function run(cmd, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, {
      cwd: options.cwd || REPO_ROOT,
      env: { ...process.env, ...prodEnv, ...(options.env || {}) },
      stdio: 'inherit',
      shell: isWindowsShellScript(cmd),
      windowsHide: true,
    });
    child.on('error', (error) => rejectRun({ error, durationMs: Date.now() - t0 }));
    child.on('exit', (code) => {
      const durationMs = Date.now() - t0;
      if (code === 0) resolveRun({ durationMs });
      else rejectRun({ code, durationMs });
    });
  });
}

async function step(dimension, phase, name, fn, { blocker = false, skip = false } = {}) {
  if (skip) {
    logStep(dimension, phase, name, true, 'SKIP', 0, blocker);
    return true;
  }
  const t0 = Date.now();
  try {
    const detail = await fn();
    logStep(dimension, phase, name, true, typeof detail === 'string' ? detail : '', Date.now() - t0, blocker);
    return true;
  } catch (error) {
    const detail = error?.code != null ? `exit ${error.code}` : String(error?.error || error);
    logStep(dimension, phase, name, false, detail, Date.now() - t0, blocker);
    return false;
  }
}

async function preflightCheck() {
  console.log('\n[comprehensive] Preflight checks…');
  const checks = [];

  async function add(id, label, ok, detail) {
    checks.push({ id, label, ok, detail });
    console.log(`  ${ok ? 'OK' : 'WARN'} ${id}: ${detail}`);
  }

  try {
    const ready = await fetch(`${SERVER}/api/saas/health/ready`, { signal: AbortSignal.timeout(5000) });
    await add('PF-01', 'Bridge ready', ready.ok, `${SERVER} status=${ready.status}`);
  } catch (error) {
    await add('PF-01', 'Bridge ready', false, `${SERVER} unreachable: ${error instanceof Error ? error.message : error}`);
  }

  try {
    const ui = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    await add('PF-02', 'Vite UI', ui.ok, `${BASE} status=${ui.status}`);
  } catch {
    await add('PF-02', 'Vite UI', false, `${BASE} unreachable`);
  }

  await add('PF-03', 'PostgreSQL', hasPg, hasPg ? 'SAAS_DATABASE_URL set' : 'SQLite control (dev ok)');

  let redisOk = false;
  try {
    const memurai = spawnSync('powershell', ['-NoProfile', '-Command', '(Test-NetConnection 127.0.0.1 -Port 6379).TcpTestSucceeded'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    redisOk = /True/i.test(memurai.stdout || '');
  } catch {
    redisOk = false;
  }
  await add('PF-04', 'Redis/Memurai', redisOk, redisOk ? '127.0.0.1:6379 open' : 'not detected');

  preflight.checks = checks;
  preflight.server = SERVER;
  preflight.base = BASE;
  preflight.focusUi = focusUi;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`, 'utf8');
  return checks.every((c) => (c.id === 'PF-04' ? true : c.ok));
}

function latestJsonIn(dir, prefix) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (!files.length) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, files[0].f), 'utf8'));
  } catch {
    return null;
  }
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function dimensionSummary(dimension) {
  const items = steps.filter((s) => s.dimension === dimension);
  const failed = items.filter((s) => !s.ok && !s.detail?.startsWith('SKIP'));
  const skipped = items.filter((s) => s.detail === 'SKIP');
  const passed = items.filter((s) => s.ok && s.detail !== 'SKIP');
  let status = 'PASS';
  if (failed.length) status = 'FAIL';
  else if (skipped.length && passed.length === 0) status = 'SKIP';
  return { dimension, status, passed: passed.length, failed: failed.length, skipped: skipped.length, items };
}

function evaluateOverall(dims, metrics) {
  const p0Fail = steps.some((s) => s.blocker && !s.ok);
  const secFail = dims.security?.status === 'FAIL';
  const uiFail = dims['ui-responsiveness']?.status === 'FAIL';
  const wedged = metrics.wedgedTotal ?? 0;

  if (p0Fail || secFail || uiFail) {
    return { verdict: '不可上线', reason: 'P0/安全/UI 响应 FAIL' };
  }
  if (wedged > 0 || dims.stress?.status === 'FAIL' || dims.load?.status === 'FAIL') {
    return { verdict: '有条件上线', reason: '负载/压力 wedged 或 FAIL，须限流与监控' };
  }
  const yellow =
    (metrics.httpStressP95 ?? 0) > 3500 ||
    (metrics.bridgeRssGrowth ?? 0) > 0.25 ||
    (metrics.sessionSwitchP95 ?? 0) > 3000;
  if (yellow) {
    return { verdict: '有条件上线', reason: '黄线延迟/内存，建议 swap + 滚动重启' };
  }
  return { verdict: '可 controlled 上线', reason: '全面测试无红，4C8G 配额内' };
}

function generateReport() {
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `prelaunch-comprehensive-evaluation-report-${date}.zh-CN.md`);

  const bridgeDir = path.join(REPO_ROOT, 'artifacts', 'bridge-stability-test');
  const browse = latestJsonIn(bridgeDir, 'load-browse') || latestJsonIn(bridgeDir, 'browse');
  const load = latestJsonIn(bridgeDir, 'load-load') || latestJsonIn(bridgeDir, 'load-');
  const stress = latestJsonIn(bridgeDir, 'load-stress') || latestJsonIn(bridgeDir, 'stress');
  const soak = latestJsonIn(bridgeDir, 'load-soak') || latestJsonIn(bridgeDir, 'soak');

  const httpStress = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'pre-production-test', 'http-load-stress.json'));
  const memAudit = latestJsonIn(path.join(REPO_ROOT, 'artifacts', 'memory-audit'), 'memory-audit');
  const security = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'full-test', 'security-checklist.json'));
  const sessionProfile = latestJsonIn(path.join(REPO_ROOT, 'artifacts', 'session-switch-profile'), 'profile');
  const browserMatrix = latestJsonIn(path.join(REPO_ROOT, 'artifacts', 'browser-compat-matrix'), 'report');

  const wedgedTotal =
    (browse?.gate?.wedgedCount ?? 0) +
    (load?.gate?.wedgedCount ?? 0) +
    (stress?.gate?.wedgedCount ?? 0) +
    (soak?.gate?.wedgedCount ?? 0);

  const metrics = {
    wedgedTotal,
    browseReadyP95: browse?.gate?.readyP95Ms,
    loadReadyP95: load?.gate?.readyP95Ms,
    httpStressP95: httpStress?.p95Ms,
    httpStressFail: httpStress?.fail ?? 0,
    bridgeRssGrowth: memAudit?.runtime?.bridge?.growthRatio,
    gatewayRssGrowth: memAudit?.runtime?.gateway?.growthRatio,
    sessionSwitchP95: sessionProfile?.summary?.switchP95Ms ?? sessionProfile?.p95Ms,
  };

  const dimKeys = [
    'functional',
    'stability',
    'ui-responsiveness',
    'load',
    'stress',
    'memory',
    'security',
    'chaos',
    'db-pressure',
    'dialogue-concurrency',
    'extreme-load',
    'extreme-concurrency',
  ];
  const dims = Object.fromEntries(dimKeys.map((k) => [k, dimensionSummary(k)]));
  const overall = evaluateOverall(dims, metrics);
  const blockers = steps.filter((s) => s.blocker && !s.ok);

  const dimLabels = {
    functional: '1. 功能',
    stability: '2. 稳定',
    'ui-responsiveness': '3. UI 响应（卡顿/假死）',
    load: '4. 负载',
    stress: '5. 压力',
    memory: '6. 内存',
    security: '7. 安全',
    chaos: '8. 破坏/混沌',
    'db-pressure': '9. 数据库/catalog',
    'dialogue-concurrency': '10. 对话并发',
    'extreme-load': '11. 极限负载',
    'extreme-concurrency': '12. 极限并发',
  };

  const lines = [
    `# 上线前全面测试评估报告（ECS 4C8G 代理 · ${date}）`,
    '',
    '**环境**：本机 Nova Launcher 单栈（Bridge `7990` / Vite `8081`），**非**阿里云 cgroup 真机。',
    `**Bridge**：\`${SERVER}\` · **UI**：\`${BASE}\``,
    `**JSON 汇总**：\`artifacts/prelaunch-comprehensive/summary.json\``,
    '**关联**：[`prelaunch-ecs-4c8g-evaluation-report-2026-07-12.zh-CN.md`](prelaunch-ecs-4c8g-evaluation-report-2026-07-12.zh-CN.md)',
    '',
    '---',
    '',
    '## 1. 执行摘要',
    '',
    `| 项目 | 结果 |`,
    `|------|------|`,
    `| **总签收** | **${overall.verdict}** — ${overall.reason} |`,
    `| 十二维通过 | ${Object.values(dims).filter((d) => d.status === 'PASS').length}/12 |`,
    `| 套件步骤 | ${steps.filter((s) => s.ok).length}/${steps.length} |`,
    `| Bridge wedged 合计 | ${wedgedTotal} |`,
    `| focus-ui | ${focusUi} · skip-extreme=${skipExtreme} · skip-offline=${skipOffline} |`,
    '',
    '### 十二维总判定',
    '',
    '| 维度 | 判定 | 通过/失败 |',
    '|------|------|-----------|',
    ...dimKeys.map((key) => {
      const d = dims[key];
      return `| ${dimLabels[key]} | ${d.status} | ${d.passed} pass / ${d.failed} fail |`;
    }),
    '',
    '### UI 卡顿/假死专项指标',
    '',
    '| 指标 | 值 | 绿/黄/红 |',
    '|------|-----|---------|',
    `| 侧栏切换 P95 | ${metrics.sessionSwitchP95 ?? '—'} ms | ${!metrics.sessionSwitchP95 ? '—' : metrics.sessionSwitchP95 <= 1500 ? '绿' : metrics.sessionSwitchP95 <= 3000 ? '黄' : '红'} |`,
    `| Bridge wedged | ${wedgedTotal} | ${wedgedTotal === 0 ? '绿' : '红'} |`,
    `| browse ready P95 | ${metrics.browseReadyP95 ?? '—'} ms | ${!metrics.browseReadyP95 ? '—' : metrics.browseReadyP95 <= 2000 ? '绿' : '黄'} |`,
    `| load ready P95 | ${metrics.loadReadyP95 ?? '—'} ms | ${!metrics.loadReadyP95 ? '—' : metrics.loadReadyP95 <= 3500 ? '绿' : '黄'} |`,
    '',
    '---',
    '',
    '## 2. 前置检查',
    '',
    ...preflight.checks.map((c) => `- **${c.id}** ${c.label}: ${c.ok ? '✅' : '⚠️'} ${c.detail}`),
    '',
    '---',
    '',
    '## 3. 各维度明细',
    '',
  ];

  for (const key of dimKeys) {
    const d = dims[key];
    lines.push(`### ${dimLabels[key]}`);
    lines.push('');
    lines.push(`**判定**：${d.status}`);
    lines.push('');
    if (d.items.length === 0) {
      lines.push('_（本 run 未执行）_');
    } else {
      lines.push('| 步骤 | 结果 | 说明 |');
      lines.push('|------|------|------|');
      for (const item of d.items) {
        lines.push(`| ${item.name} | ${item.ok ? '✅' : '❌'} | ${(item.detail || '').replace(/\|/g, '\\|')} |`);
      }
    }
    lines.push('');
  }

  lines.push('---', '', '## 4. 关键指标汇总', '');
  lines.push(`| HTTP stress P95 | ${metrics.httpStressP95 ?? '—'} ms |`);
  lines.push(`| HTTP stress fail | ${metrics.httpStressFail} |`);
  lines.push(`| Gateway RSS 增幅 | ${metrics.gatewayRssGrowth != null ? `${(metrics.gatewayRssGrowth * 100).toFixed(1)}%` : '—'} |`);
  lines.push(`| Bridge RSS 增幅 | ${metrics.bridgeRssGrowth != null ? `${(metrics.bridgeRssGrowth * 100).toFixed(1)}%` : '—'} |`);
  if (browserMatrix?.summary) {
    lines.push(`| 浏览器矩阵 | ${browserMatrix.summary.allChecksPass ? '全绿' : '有 FAIL'} |`);
  }
  if (security?.summary) {
    lines.push(`| SEC 回归 | ${security.summary.failed ?? 0} fail |`);
  }
  lines.push('');

  if (blockers.length) {
    lines.push('---', '', '## 5. 阻塞项', '', ...blockers.map((b) => `- **${b.name}**：${b.detail}`), '');
  }

  lines.push(
    '---',
    '',
    '## 6. 发版建议',
    '',
    '1. **UI 卡顿**：优先看 `session-switch-perf` / `session-switch-profile` 与 Bridge wedged；>0 须查 `docs/rca-task-stall-*.md`',
    '2. 生产跑 `apply-cloud-perf-env.sh` + `verify-cloud-perf.sh`',
    '3. ECS 4C8G 配 **4GB swap**；Bridge/Gateway RSS 告警 >1.2GB',
    '4. 压测后 **65s 冷却**再跑 SEC，避免 login 429 误判',
    '5. 长任务 AI 并发 ≤3；定期滚动重启 nova',
    '',
    '---',
    '',
    '## 7. 产物索引',
    '',
    '| 路径 | 说明 |',
    '|------|------|',
    '| `artifacts/prelaunch-comprehensive/` | 本套件日志 |',
    '| `artifacts/session-switch-validation/` | L1–L7 会话切换 |',
    '| `artifacts/session-switch-profile/` | 侧栏切换剖析 |',
    '| `artifacts/bridge-stability-test/` | Bridge 负载/压力 |',
    '| `artifacts/memory-audit/` | 内存泄漏审计 |',
    '',
    '**声明**：本机 dev:saas 代理测试；真机 OOM/CPU 行为可能与阿里云 4C8G 有偏差。',
    '',
  );

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\n[comprehensive] 评估报告 → ${reportPath}`);

  const summary = {
    capturedAt: new Date().toISOString(),
    server: SERVER,
    base: BASE,
    skipExtreme,
    skipLive,
    skipOffline,
    focusUi,
    dimensions: dims,
    metrics,
    overall,
    preflight: preflight.checks,
    steps,
    reportPath,
  };
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { reportPath, overall, summary };
}

async function runOfflinePhase() {
  if (skipOffline || focusUi) {
    logStep('functional', 'offline', 'offline-phase', true, 'SKIP', 0);
    return;
  }
  const lock = acquireGateLock({ phase: 'offline', holder: 'comprehensive-suite' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('functional', 'offline', 'check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));
  await step('functional', 'offline', 'brand:check', () => run(npmCmd, ['run', 'brand:check']), { blocker: true });
  await step('functional', 'offline', 'test:bridge-stability:unit', () => run(npmCmd, ['run', 'test:bridge-stability:unit']));
  await step('functional', 'offline', 'test:turn-queue:unit', () => run(npmCmd, ['run', 'test:turn-queue:unit']));
  await step('stability', 'offline', 'smoke:resilience', () => run(npmCmd, ['run', 'smoke:resilience']));
  await step('stability', 'offline', 'test:history-messages:quick', () => run(npmCmd, ['run', 'test:history-messages:quick']));
  await step('functional', 'offline', 'test:p0-p2:full', () => run(npmCmd, ['run', 'test:p0-p2:full']));
  releaseGateLock();
}

async function runUiResponsivenessPhase() {
  const lock = acquireGateLock({ phase: 'e2e', holder: 'comprehensive-ui' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('ui-responsiveness', 'ui', 'check-white-screen', () =>
    run(nodeCmd, ['scripts/check-white-screen.mjs', `${BASE}/p/general`], { env: prodEnv }),
  );
  await step('ui-responsiveness', 'ui', 'session-switch-unit-L1', () =>
    run(npmCmd, ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/sessionDeliverablePipeline.test.ts', 'src/shared/sdmProgressDockParity.test.ts']),
  );
  await step('ui-responsiveness', 'ui', 'session-switch-perf+clickthrough', () =>
    run(
      npxCmd,
      [
        'playwright',
        'test',
        '-c',
        'ui/playwright.config.ts',
        'ui/e2e/saas/session-switch-perf.spec.ts',
        'ui/e2e/saas/session-switch-clickthrough.spec.ts',
        '--workers=1',
      ],
      { env: prodEnv },
    ),
  );
  await step('ui-responsiveness', 'ui', 'task-stall-regression', () =>
    run(npxCmd, ['playwright', 'test', '-c', 'ui/playwright.config.ts', 'ui/e2e/saas/task-stall-regression.spec.ts'], {
      env: prodEnv,
    }),
  );
  await step('ui-responsiveness', 'ui', 'turn-queue-lifecycle', () =>
    run(npxCmd, ['playwright', 'test', '-c', 'ui/playwright.config.ts', 'ui/e2e/saas/turn-queue-lifecycle.spec.ts'], {
      env: prodEnv,
    }),
  );
  await step('ui-responsiveness', 'ui', 'session-switch-profile', () =>
    run(nodeCmd, ['scripts/diag/session-switch-profile.mjs'], { env: prodEnv }),
  );

  releaseGateLock();
}

async function runLivePhase() {
  if (skipLive || focusUi) {
    logStep('functional', 'live', 'live-phase', true, 'SKIP', 0);
    return;
  }
  const lock = acquireGateLock({ phase: 'e2e', holder: 'comprehensive-live' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('functional', 'live', 'test:prelaunch:quick', () => run(npmCmd, ['run', 'test:prelaunch:quick'], { env: prodEnv }));
  await step('functional', 'live', 'resilience-live', () =>
    run(nodeCmd, ['scripts/integration-conversation-resilience-live.mjs'], { env: prodEnv }),
  );
  await step('functional', 'live', 'browser-compat-matrix', () =>
    run(nodeCmd, ['scripts/browser-compat-matrix.mjs'], { env: prodEnv }),
  );
  await step('stability', 'live', 'test:dialogue-stability:full-chain', () =>
    run(npmCmd, ['run', 'test:dialogue-stability:full-chain'], { env: prodEnv }),
  );

  releaseGateLock();
}

async function runLoadStressPhase() {
  const lock = acquireGateLock({ phase: 'load', holder: 'comprehensive-load' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('stability', 'load', 'bridge-stability:browse', () =>
    run(nodeCmd, ['scripts/load/bridge-stability-load.mjs', '--scenario', 'browse'], { env: prodEnv }),
  );
  await step('load', 'load', 'bridge-stability:load', () =>
    run(nodeCmd, ['scripts/load/bridge-stability-load.mjs', '--scenario', 'load'], { env: prodEnv }),
  );
  await step('load', 'load', 'http-load-smoke', () =>
    run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'smoke'], { env: prodEnv }),
  );
  await step('stress', 'load', 'bridge-stability:stress', () =>
    run(nodeCmd, ['scripts/load/bridge-stability-load.mjs', '--scenario', 'stress'], { env: prodEnv }),
  );
  await step('stress', 'load', 'http-load-stress', () =>
    run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'stress'], { env: prodEnv }),
  );

  console.log('\n[comprehensive] Cooldown 65s after stress (login rate-limit)…');
  await sleep(65_000);

  releaseGateLock();
}

async function runMemoryPhase() {
  await step('memory', 'memory', 'memory-leak-audit', () =>
    run(nodeCmd, ['scripts/memory-leak-audit.mjs'], {
      env: {
        ...prodEnv,
        MEM_AUDIT_ROUNDS: skipExtreme ? '20' : '40',
        MEM_AUDIT_BROWSER_ROUNDS: skipExtreme ? '8' : '12',
      },
    }),
  );
}

async function runSecurityChaosPhase() {
  await step('security', 'security', 'security-regression', () =>
    run(nodeCmd, ['scripts/security-regression-checklist.mjs'], { env: prodEnv }),
  );
  await step('chaos', 'chaos', 'chaos-dev', () =>
    run(nodeCmd, ['scripts/run-chaos-dev.mjs', '--skip-gateway-kill'], { env: prodEnv }),
  );
}

async function runDbPressurePhase() {
  await step('db-pressure', 'db', 'projects-coalesce-stress', () =>
    run(nodeCmd, ['scripts/load/projects-coalesce-stress.mjs', '--gate'], { env: prodEnv }),
  );
  await step('db-pressure', 'db', 'test:saas:pg', () => run(npmCmd, ['run', 'test:saas:pg']), {
    skip: !hasPg,
  });
  await step('db-pressure', 'db', 'test:saas:pg-validation', () => run(npmCmd, ['run', 'test:saas:pg-validation']), {
    skip: !hasPg,
  });
}

async function runDialogueConcurrencyPhase() {
  if (skipExtreme || focusUi) {
    logStep('dialogue-concurrency', 'concurrency', 'multi-user-sim', true, 'SKIP --skip-extreme or --focus-ui', 0);
    return;
  }
  await step('dialogue-concurrency', 'concurrency', 'multi-user-sim', () =>
    run(nodeCmd, ['scripts/integration-multi-user-turn-sim.mjs'], {
      env: { ...prodEnv, FORCE_MULTI_USER_SIM: '1' },
    }),
  );
}

async function runExtremePhase() {
  if (skipExtreme) {
    logStep('extreme-load', 'extreme', 'extreme-suite', true, 'SKIP --skip-extreme', 0);
    logStep('extreme-concurrency', 'extreme', 'extreme-suite', true, 'SKIP --skip-extreme', 0);
    return;
  }
  const lock = acquireGateLock({ phase: 'load', holder: 'comprehensive-extreme' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('extreme-load', 'extreme', 'bridge-stability:soak-15m', () =>
    run(nodeCmd, ['scripts/load/bridge-stability-load.mjs', '--scenario', 'soak'], {
      env: { ...prodEnv, BRIDGE_SOAK_DURATION_MS: '900000' },
    }),
  );
  await step('extreme-load', 'extreme', 'http-load-soak', () =>
    run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'soak'], { env: prodEnv }),
  );
  await step('extreme-concurrency', 'extreme', 'http-load-spike', () =>
    run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'spike'], { env: prodEnv }),
  );
  await step('extreme-concurrency', 'extreme', 'trust-stack:perf', () =>
    run(nodeCmd, ['scripts/run-trust-stack-perf.mjs'], {
      env: { ...prodEnv, TRUST_STACK_SKIP_E2E: '1' },
    }),
  );

  releaseGateLock();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, '', 'utf8');

  console.log(
    `[comprehensive] SERVER=${SERVER} BASE=${BASE} focusUi=${focusUi} skipExtreme=${skipExtreme} skipOffline=${skipOffline} skipLive=${skipLive}`,
  );

  const pfOk = await preflightCheck();
  if (!pfOk) {
    console.warn('[comprehensive] Preflight incomplete — ensure Nova Launcher on 7990/8081');
  }

  await runOfflinePhase();
  await runUiResponsivenessPhase();
  await runLivePhase();
  await runLoadStressPhase();
  await runMemoryPhase();
  await runSecurityChaosPhase();
  await runDbPressurePhase();
  await runDialogueConcurrencyPhase();
  await runExtremePhase();

  const { overall, reportPath } = generateReport();
  const failed = steps.filter((s) => !s.ok && s.detail !== 'SKIP');
  console.log(`\n[comprehensive] ${steps.filter((s) => s.ok).length}/${steps.length} steps passed`);
  console.log(`[comprehensive] 总签收: ${overall.verdict}`);
  console.log(`[comprehensive] 报告: ${reportPath}`);

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  releaseGateLock();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
