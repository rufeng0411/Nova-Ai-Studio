#!/usr/bin/env node
/**
 * PD-SAAS-FORK: ECS 4C8G pre-launch eight-dimension test orchestrator + evaluation report.
 *
 * Usage:
 *   node scripts/run-prelaunch-ecs-4c8g-suite.mjs
 *   node scripts/run-prelaunch-ecs-4c8g-suite.mjs --skip-extreme
 *   node scripts/run-prelaunch-ecs-4c8g-suite.mjs --skip-live
 *
 * Env (defaults for Nova Launcher single stack):
 *   SERVER_URL=http://127.0.0.1:7990
 *   BASE_URL=http://127.0.0.1:8081
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGateLock, releaseGateLock } from './lib/gateMutex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'prelaunch-ecs-4c8g');
const LOG_FILE = path.join(OUT_DIR, 'suite-log.jsonl');
const SUMMARY_FILE = path.join(OUT_DIR, 'summary.json');

const skipExtreme = process.argv.includes('--skip-extreme');
const skipLive = process.argv.includes('--skip-live');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeCmd = process.execPath;
const isWindowsShellScript = (cmd) => process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(cmd);

const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const BASE = (process.env.BASE_URL || process.env.VITE_URL || 'http://127.0.0.1:8081').replace(/\/$/, '');

const prodEnv = {
  SERVER_URL: SERVER,
  VITE_URL: BASE,
  BASE_URL: BASE,
  PLAYWRIGHT_BASE_URL: BASE,
  PILOTDECK_HISTORY_SANITIZE: '1',
  PILOTDECK_HISTORY_TAIL_READ: '1',
  PILOTDECK_HISTORY_MESSAGE_CACHE: '1',
  SAAS_CONVERSATION_CATALOG: '1',
  // PD-SAAS-FORK: suite 内连续压测时避免 login 429 污染后续 SEC/http 探针
  SAAS_LOGIN_RATE_IP_PER_MIN: process.env.SAAS_LOGIN_RATE_IP_PER_MIN || '1000',
  SAAS_LOGIN_RATE_USER_PER_MIN: process.env.SAAS_LOGIN_RATE_USER_PER_MIN || '1000',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** @type {Array<{ dimension: string, phase: string, name: string, ok: boolean, detail: string, durationMs: number, at: string, blocker?: boolean }>} */
const steps = [];
const preflight = { checks: [], at: new Date().toISOString() };

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
  console.log('\n[ecs-4c8g] Preflight checks…');
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
  } catch (error) {
    await add('PF-02', 'Vite UI', false, `${BASE} unreachable`);
  }

  const pg = Boolean(process.env.SAAS_DATABASE_URL?.trim());
  await add('PF-03', 'PostgreSQL', pg, pg ? 'SAAS_DATABASE_URL set' : 'SQLite control (dev ok)');

  let redisOk = false;
  try {
    const ping = spawnSync(process.execPath, ['-e', "fetch('http://127.0.0.1:6379').catch(()=>{})"], {
      encoding: 'utf8',
      timeout: 2000,
    });
    void ping;
    const memurai = spawnSync('powershell', ['-NoProfile', '-Command', '(Test-NetConnection 127.0.0.1 -Port 6379).TcpTestSucceeded'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    redisOk = /True/i.test(memurai.stdout || '');
  } catch {
    redisOk = false;
  }
  await add('PF-04', 'Redis/Memurai', redisOk, redisOk ? '127.0.0.1:6379 open' : 'not detected (captcha cache may degrade)');

  preflight.checks = checks;
  preflight.server = SERVER;
  preflight.base = BASE;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'preflight.json'), `${JSON.stringify(preflight, null, 2)}\n`, 'utf8');
  return checks.every((c) => c.id === 'PF-04' ? true : c.ok);
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
  else if (items.some((s) => s.detail?.includes('WARN') || s.detail?.includes('blocker'))) status = 'WARN';
  return { dimension, status, passed: passed.length, failed: failed.length, skipped: skipped.length, items };
}

function evaluateOverall(dimensions, metrics) {
  const p0Fail = steps.some((s) => s.blocker && !s.ok);
  const secFail = dimensions.security?.status === 'FAIL';
  const stabFail = dimensions.stability?.status === 'FAIL';
  const funcFail = dimensions.functional?.status === 'FAIL';
  const wedged = metrics.wedgedTotal ?? 0;
  const httpStressFail = metrics.httpStressFail ?? 0;

  if (p0Fail || secFail || stabFail || funcFail || wedged > 0 || httpStressFail > 0) {
    return { verdict: '不可上线', reason: 'P0/安全/稳定/功能 FAIL 或 wedged/hard fail' };
  }
  const yellow =
    (metrics.httpStressP95 ?? 0) > 3500 ||
    (metrics.bridgeRssGrowth ?? 0) > 0.25 ||
    metrics.multiUserTimeout >= 1;
  if (yellow) {
    return { verdict: '有条件上线', reason: '存在黄线指标，须 swap/限流/滚动重启' };
  }
  return { verdict: '可 controlled 上线', reason: '八维无红，4C8G 配额内' };
}

function generateReport() {
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `prelaunch-ecs-4c8g-evaluation-report-${date}.zh-CN.md`);

  const bridgeDir = path.join(REPO_ROOT, 'artifacts', 'bridge-stability-test');
  const browse = latestJsonIn(bridgeDir, 'load-browse') || latestJsonIn(bridgeDir, 'browse');
  const load = latestJsonIn(bridgeDir, 'load-load') || latestJsonIn(bridgeDir, 'load-');
  const stress = latestJsonIn(bridgeDir, 'load-stress') || latestJsonIn(bridgeDir, 'stress');
  const soak = latestJsonIn(bridgeDir, 'load-soak') || latestJsonIn(bridgeDir, 'soak');

  const httpSmoke = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'pre-production-test', 'http-load-smoke.json'));
  const httpStress = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'pre-production-test', 'http-load-stress.json'));
  const httpSpike = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'pre-production-test', 'http-load-spike.json'));
  const httpSoak = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'pre-production-test', 'http-load-soak.json'));

  const memAudit = latestJsonIn(path.join(REPO_ROOT, 'artifacts', 'memory-audit'), 'memory-audit');
  const security = readJsonIfExists(path.join(REPO_ROOT, 'artifacts', 'full-test', 'security-checklist.json'));
  const chaos = latestJsonIn(path.join(REPO_ROOT, 'artifacts', 'chaos-dev'), 'report');
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
    httpSpikeFail: httpSpike?.fail ?? 0,
    bridgeRssGrowth: memAudit?.runtime?.bridge?.growthRatio,
    gatewayRssGrowth: memAudit?.runtime?.gateway?.growthRatio,
    multiUserTimeout: 0,
  };

  const dims = {
    functional: dimensionSummary('functional'),
    stability: dimensionSummary('stability'),
    load: dimensionSummary('load'),
    stress: dimensionSummary('stress'),
    security: dimensionSummary('security'),
    chaos: dimensionSummary('chaos'),
    extremeLoad: dimensionSummary('extreme-load'),
    extremeConcurrency: dimensionSummary('extreme-concurrency'),
  };

  const overall = evaluateOverall(dims, metrics);
  const blockers = steps.filter((s) => s.blocker && !s.ok);

  const lines = [
    `# ECS 4C8G 上线前全维测试评估报告（${date}）`,
    '',
    '**环境**：本机 Nova Launcher 单栈（本地代理测试，**非**阿里云 ECS cgroup 真机压测）',
    `**Bridge**：\`${SERVER}\` · **UI**：\`${BASE}\``,
    `**JSON 汇总**：\`artifacts/prelaunch-ecs-4c8g/summary.json\``,
    '**容量基线**：[`ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md`](ecs-4c8g-capacity-assessment-2026-07-02.zh-CN.md)',
    '',
    '---',
    '',
    '## 1. 执行摘要',
    '',
    `| 项目 | 结果 |`,
    `|------|------|`,
    `| **总签收** | **${overall.verdict}** — ${overall.reason} |`,
    `| 八维通过 | ${Object.values(dims).filter((d) => d.status === 'PASS').length}/8 |`,
    `| 套件步骤 | ${steps.filter((s) => s.ok).length}/${steps.length} |`,
    `| Bridge wedged 合计 | ${wedgedTotal} |`,
    `| skip-extreme | ${skipExtreme} |`,
    '',
    '### 八维总判定',
    '',
    '| 维度 | 判定 | 通过/失败 |',
    '|------|------|-----------|',
    ...Object.entries(dims).map(([key, d]) => {
      const label = {
        functional: '1. 功能',
        stability: '2. 稳定',
        load: '3. 负载',
        stress: '4. 压力',
        security: '5. 安全',
        chaos: '6. 破坏',
        extremeLoad: '7. 极限负载',
        extremeConcurrency: '8. 极限并发',
      }[key];
      return `| ${label} | ${d.status} | ${d.passed} pass / ${d.failed} fail |`;
    }),
    '',
    '### 4C8G 推荐配额对照（摘自容量评估）',
    '',
    '| 维度 | 绿（推荐日常） | 黄（峰值） | 本轮观测 |',
    '|------|---------------|-----------|----------|',
    `| 同时在线浏览 | 20～30 | 50 | browse ready P95 ${metrics.browseReadyP95 ?? '—'} ms |`,
    `| 对话页 heavy | 10～15 | 25 | load ready P95 ${metrics.loadReadyP95 ?? '—'} ms |`,
    `| 登录突发 | ≤10 并发 | 30 | stress fail=${metrics.httpStressFail}, P95 ${metrics.httpStressP95 ?? '—'} ms |`,
    `| AI 并发 turn | 3 | 5 | multi-user 见套件日志 |`,
    '',
    '---',
    '',
    '## 2. 前置检查',
    '',
    ...preflight.checks.map((c) => `- **${c.id}** ${c.label}: ${c.ok ? '✅' : '⚠️'} ${c.detail}`),
    '',
    '---',
    '',
    '## 3. 八维明细',
    '',
  ];

  for (const [key, d] of Object.entries(dims)) {
    const titles = {
      functional: '功能',
      stability: '稳定',
      load: '负载',
      stress: '压力',
      security: '安全',
      chaos: '破坏/混沌',
      extremeLoad: '极限负载',
      extremeConcurrency: '极限并发',
    };
    lines.push(`### 3.${Object.keys(dims).indexOf(key) + 1} ${titles[key]}`);
    lines.push('');
    lines.push(`**判定**：${d.status}`);
    lines.push('');
    lines.push('| 步骤 | 结果 | 说明 |');
    lines.push('|------|------|------|');
    for (const item of d.items) {
      lines.push(`| ${item.name} | ${item.ok ? '✅' : '❌'} | ${(item.detail || '').replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }

  lines.push('---', '', '## 4. 关键指标', '', '| 指标 | 值 | 绿/黄/红 |', '|------|-----|---------|');
  lines.push(`| Bridge wedged | ${wedgedTotal} | ${wedgedTotal === 0 ? '绿' : '红'} |`);
  lines.push(`| HTTP stress P95 | ${metrics.httpStressP95 ?? '—'} ms | ${!metrics.httpStressP95 ? '—' : metrics.httpStressP95 <= 3500 ? '绿' : metrics.httpStressP95 <= 5000 ? '黄' : '红'} |`);
  lines.push(`| HTTP stress fail | ${metrics.httpStressFail} | ${metrics.httpStressFail === 0 ? '绿' : '红'} |`);
  lines.push(`| Gateway RSS 增幅 | ${metrics.gatewayRssGrowth != null ? `${(metrics.gatewayRssGrowth * 100).toFixed(1)}%` : '—'} | ${metrics.gatewayRssGrowth == null ? '—' : metrics.gatewayRssGrowth <= 0.25 ? '绿' : metrics.gatewayRssGrowth <= 0.5 ? '黄' : '红'} |`);
  lines.push(`| Bridge RSS 增幅 | ${metrics.bridgeRssGrowth != null ? `${(metrics.bridgeRssGrowth * 100).toFixed(1)}%` : '—'} | ${metrics.bridgeRssGrowth == null ? '—' : metrics.bridgeRssGrowth <= 0.25 ? '绿' : metrics.bridgeRssGrowth <= 0.5 ? '黄' : '红'} |`);
  if (browserMatrix?.summary) {
    lines.push(`| 浏览器矩阵 | ${browserMatrix.summary.failedChecks?.length ?? 0} fail | ${browserMatrix.summary.allChecksPass ? '绿' : '红'} |`);
  }
  lines.push('');

  if (blockers.length) {
    lines.push('---', '', '## 5. 阻塞项', '', ...blockers.map((b) => `- **${b.name}**：${b.detail}`), '');
  }

  lines.push(
    '---',
    '',
    '## 6. 发版建议（ECS 4C8G）',
    '',
    '1. 生产必跑 `apply-cloud-perf-env.sh` + `verify-cloud-perf.sh`（SANITIZE/TAIL_READ/CACHE/catalog/Redis）',
    '2. 配置 **4GB swap**；监控 Bridge/Gateway RSS（告警 >1.2GB）',
    '3. 公网前改默认口令、HTTPS、登录 rate limit',
    '4. Nginx 限流保护 captcha/login；长任务并发 ≤3',
    '5. 定期滚动重启 nova 容器（Bridge sessionState 泄漏治理前）',
    '',
    '---',
    '',
    '## 7. 产物索引',
    '',
    '| 路径 | 说明 |',
    '|------|------|',
    `| \`artifacts/prelaunch-ecs-4c8g/\` | 套件日志 |`,
    `| \`artifacts/bridge-stability-test/\` | Bridge 负载/压力/soak |`,
    `| \`artifacts/pre-production-test/http-load-*.json\` | HTTP 入口压测 |`,
    `| \`artifacts/memory-audit/\` | 内存审计 |`,
    `| \`artifacts/chaos-dev/\` | 混沌探针 |`,
    `| \`artifacts/full-test/security-checklist.json\` | SEC 回归 |`,
    '',
    '**声明**：本报告基于本机 dev:saas 单栈代理测试，极限 OOM/CPU 行为与阿里云 4C8G 真机可能存在偏差；发版前建议在 ECS 抽测 soak + spike。',
    '',
  );

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\n[ecs-4c8g] 评估报告 → ${reportPath}`);

  const summary = {
    capturedAt: new Date().toISOString(),
    server: SERVER,
    base: BASE,
    skipExtreme,
    skipLive,
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
  const lock = acquireGateLock({ phase: 'offline', holder: 'ecs-4c8g-suite' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('functional', 'offline', 'build', () => run(npmCmd, ['run', 'build']), { blocker: true });
  await step('functional', 'offline', 'check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));
  await step('functional', 'offline', 'brand:check', () => run(npmCmd, ['run', 'brand:check']), { blocker: true });
  await step('functional', 'offline', 'test:p0-p2:full', () => run(npmCmd, ['run', 'test:p0-p2:full']));
  await step('functional', 'offline', 'test:saas:deep', () => run(npmCmd, ['run', 'test:saas:deep']));
  await step('stability', 'offline', 'smoke:resilience', () => run(npmCmd, ['run', 'smoke:resilience']));
  await step('stability', 'offline', 'test:dialogue-stability:full-chain', () =>
    run(npmCmd, ['run', 'test:dialogue-stability:full-chain']),
  );
  await step('load', 'offline', 'test:history-messages:quick', () => run(npmCmd, ['run', 'test:history-messages:quick']));

  releaseGateLock();
}

async function runLivePhase() {
  if (skipLive) {
    logStep('functional', 'live', 'live-phase', true, 'SKIP --skip-live', 0);
    return;
  }

  const lock = acquireGateLock({ phase: 'e2e', holder: 'ecs-4c8g-suite' });
  if (!lock.ok) throw new Error(lock.reason);

  await step('functional', 'live', 'test:prelaunch:quick', () => run(npmCmd, ['run', 'test:prelaunch:quick'], { env: prodEnv }));
  await step('functional', 'live', 'resilience-live', () =>
    run(nodeCmd, ['scripts/integration-conversation-resilience-live.mjs'], { env: prodEnv }),
  );
  await step('functional', 'live', 'playwright-saas-core', () =>
    run(
      npxCmd,
      [
        'playwright',
        'test',
        'ui/e2e/saas/resilience-recovery.spec.ts',
        'ui/e2e/saas/isolation.spec.ts',
        'ui/e2e/saas/deep-uat.spec.ts',
        '-c',
        'ui/playwright.config.ts',
      ],
      { env: prodEnv },
    ),
  );
  await step('functional', 'live', 'browser-compat-matrix', () =>
    run(nodeCmd, ['scripts/browser-compat-matrix.mjs'], { env: prodEnv }),
  );

  releaseGateLock();
}

async function runLoadPhase() {
  const lock = acquireGateLock({ phase: 'load', holder: 'ecs-4c8g-suite' });
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

  console.log('\n[ecs-4c8g] Cooldown 65s after stress (login rate-limit window)…');
  await sleep(65_000);

  await step('security', 'load', 'security-regression', () =>
    run(nodeCmd, ['scripts/security-regression-checklist.mjs'], { env: prodEnv }),
  );
  await step('chaos', 'load', 'chaos-dev', () =>
    run(nodeCmd, ['scripts/run-chaos-dev.mjs', '--skip-gateway-kill'], { env: prodEnv }),
  );

  if (!skipExtreme) {
    await step('extreme-load', 'load', 'bridge-stability:soak-15m', () =>
      run(nodeCmd, ['scripts/load/bridge-stability-load.mjs', '--scenario', 'soak'], {
        env: { ...prodEnv, BRIDGE_SOAK_DURATION_MS: '900000' },
      }),
    );
    await step('extreme-load', 'load', 'http-load-soak', () =>
      run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'soak'], { env: prodEnv }),
    );
    await step('extreme-load', 'load', 'memory-leak-audit', () =>
      run(nodeCmd, ['scripts/memory-leak-audit.mjs'], {
        env: { ...prodEnv, MEM_AUDIT_ROUNDS: '40', MEM_AUDIT_BROWSER_ROUNDS: '12' },
      }),
    );
    await step('extreme-concurrency', 'load', 'http-load-spike', () =>
      run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'spike'], { env: prodEnv }),
    );
    await step('extreme-concurrency', 'load', 'multi-user-sim', () =>
      run(nodeCmd, ['scripts/integration-multi-user-turn-sim.mjs'], {
        env: { ...prodEnv, FORCE_MULTI_USER_SIM: '1' },
      }),
    );
  } else {
    logStep('extreme-load', 'load', 'extreme-suite', true, 'SKIP --skip-extreme', 0);
    logStep('extreme-concurrency', 'load', 'extreme-suite', true, 'SKIP --skip-extreme', 0);
  }

  releaseGateLock();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, '', 'utf8');

  console.log(`[ecs-4c8g] SERVER=${SERVER} BASE=${BASE} skipExtreme=${skipExtreme} skipLive=${skipLive}`);

  const pfOk = await preflightCheck();
  if (!pfOk) {
    console.warn('[ecs-4c8g] Preflight incomplete — ensure Nova Launcher single stack on 7990/8081');
  }

  await runOfflinePhase();
  await runLivePhase();
  await runLoadPhase();

  const { overall, reportPath } = generateReport();
  const failed = steps.filter((s) => !s.ok && s.detail !== 'SKIP');
  console.log(`\n[ecs-4c8g] ${steps.filter((s) => s.ok).length}/${steps.length} steps passed`);
  console.log(`[ecs-4c8g] 总签收: ${overall.verdict}`);
  console.log(`[ecs-4c8g] 报告: ${reportPath}`);

  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  releaseGateLock();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
