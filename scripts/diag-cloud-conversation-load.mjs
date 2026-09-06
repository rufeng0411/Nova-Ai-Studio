#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 云端对话加载全链路检测（HTTP + 可选 Playwright UI 抓包）
 *
 * 检测项：
 * - Bridge 健康 / ready 探针
 * - GET /api/projects 延迟
 * - messages API：tail120 backward / forward / 全量对比
 * - Redis 尾页缓存是否生效（连续 5 次同 URL）
 * - 生产 JS 是否启用尾部分页（全 chunk 扫描 + 可选 UI 实际请求参数）
 * - 推断 SANITIZE / TAIL_READ / MESSAGE_CACHE 是否生效
 * - （可选）ECS SSH 只读：verify-cloud-perf.sh、脱敏 .env、PG/Redis 健康
 *
 * 用法：
 *   npm run diag:cloud:conversation-load          # 上传 OSS + 打印 ECS curl + 本机 HTTP
 *   node scripts/diag-cloud-conversation-load.mjs --skip-ecs   # 仅本机 HTTP
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEcsSshConfig, probeEcsReadOnly } from './lib/cloudEcsProbe.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const BASE = (process.env.PROD_BASE_URL || 'https://www.novapage.online').replace(/\/$/, '');
/** 生产默认管理员（与 dev:saas / 云端 seed 一致） */
const USER = process.env.DIAG_USER || 'admin';
const PASS = process.env.DIAG_PASS || 'SAAS_ADMIN_PASSWORD';

const args = new Set(process.argv.slice(2));
const GATE = args.has('--gate');
const JSON_OUT = args.has('--json');
const UI_PROBE = args.has('--ui');
const ECS_ONLY = args.has('--ecs-only');
const SKIP_ECS = args.has('--skip-ecs') || !args.has('--ecs');
const FORCE_ECS = args.has('--ecs') || ECS_ONLY;
const ECS_CONFIG = loadEcsSshConfig(REPO_ROOT, BASE);
/** 默认不走 SSH；ECS 诊断请 npm run diag:cloud:conversation-load（OSS curl） */
const RUN_ECS = !SKIP_ECS && FORCE_ECS && ECS_CONFIG.enabled;
const MAX_SESSIONS = (() => {
  const idx = process.argv.indexOf('--sessions');
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number.parseInt(process.argv[idx + 1], 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  }
  return 5;
})();

const THRESH = {
  tailMsWarn: 1500,
  tailMsFail: 3000,
  tailKbWarn: 500,
  tailKbFail: 1024,
  projectsMsWarn: 3000,
  readyMsWarn: 2500,
  cacheSpeedupRatio: 0.75,
};

/** @typedef {'pass' | 'warn' | 'fail' | 'skip'} Verdict */

/** @type {Array<{ id: string, title: string, verdict: Verdict, detail: string }>} */
const checks = [];

function record(id, title, verdict, detail) {
  checks.push({ id, title, verdict, detail });
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

async function fetchText(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text, ms: Date.now() - started, bytes: text.length };
}

async function fetchJson(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  const ms = Date.now() - started;
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 200) };
  }
  return { response, body, ms, bytes: text.length };
}

async function login() {
  const { response, body, ms } = await fetchJson(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!response.ok || !body?.token) {
    throw new Error(`登录失败 HTTP ${response.status} (${ms}ms): ${JSON.stringify(body)?.slice(0, 200)}`);
  }
  record('auth.login', '登录 API', 'pass', `${ms}ms`);
  return { token: body.token, auth: { Authorization: `Bearer ${body.token}` } };
}

async function probeHealth(auth) {
  for (const path of ['/api/saas/health', '/api/saas/health/ready']) {
    try {
      const { response, body, ms } = await fetchJson(`${BASE}${path}`, { headers: auth });
      const ok = response.ok && body?.ok !== false;
      const verdict = !response.ok ? 'fail' : ms > THRESH.readyMsWarn ? 'warn' : 'pass';
      const backend = body?.backend ? ` backend=${body.backend}` : '';
      const db = body?.db ? ` db=${body.db}` : '';
      record(
        `health.${path.split('/').pop()}`,
        `GET ${path}`,
        /** @type {Verdict} */ (verdict),
        `HTTP ${response.status}, ${ms}ms, ok=${body?.ok ?? 'n/a'}${backend}${db} probe=${body?.probe ?? '-'}`,
      );
      if (path.endsWith('/health') && body?.backend) {
        record(
          'health.dbBackend',
          '控制库后端（HTTP）',
          body.db === 'ok' ? 'pass' : 'fail',
          `${body.backend} ping=${body.db ?? 'n/a'}`,
        );
      }
    } catch (error) {
      record(
        `health.${path.split('/').pop()}`,
        `GET ${path}`,
        'fail',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

/**
 * @param {string} url
 * @param {Record<string, string>} auth
 * @param {number} repeats
 */
async function benchMessages(url, auth, repeats = 1) {
  /** @type {number[]} */
  const times = [];
  /** @type {unknown} */
  let lastBody = null;
  let lastBytes = 0;
  let lastStatus = 0;

  for (let i = 0; i < repeats; i += 1) {
    const { response, body, ms, bytes } = await fetchJson(url, { headers: auth });
    times.push(ms);
    lastBody = body;
    lastBytes = bytes;
    lastStatus = response.status;
    if (!response.ok) break;
  }

  const sorted = [...times].sort((a, b) => a - b);
  return {
    times,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    avg: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    status: lastStatus,
    bytes: lastBytes,
    kb: Math.round(lastBytes / 1024),
    body: lastBody,
  };
}

function messagesUrl(sessionId, projectName, query = {}) {
  const params = new URLSearchParams({ projectName, ...query });
  return `${BASE}/api/sessions/${encodeURIComponent(sessionId)}/messages?${params}`;
}

/**
 * @param {ReturnType<typeof benchMessages> extends Promise<infer T> ? T : never} tail
 * @param {ReturnType<typeof benchMessages> extends Promise<infer T> ? T : never | null} full
 */
function inferServerFlags(tail, full) {
  const flags = {
    sanitize: 'unknown',
    tailRead: 'unknown',
    messageCache: 'unknown',
  };

  if (tail.kb <= THRESH.tailKbWarn) flags.sanitize = 'likely_on';
  else if (tail.kb >= THRESH.tailKbFail) flags.sanitize = 'likely_off';
  else flags.sanitize = 'partial';

  if (full && full.avg > 0 && tail.avg > 0) {
    if (full.kb >= tail.kb * 2 && full.avg >= tail.avg * 1.8) {
      flags.tailRead = 'likely_on';
    } else if (full.kb > THRESH.tailKbWarn && Math.abs(full.avg - tail.avg) < tail.avg * 0.35) {
      flags.tailRead = 'likely_off';
    } else {
      flags.tailRead = 'uncertain';
    }
  }

  if (tail.times.length >= 3) {
    const first = tail.times[0];
    const rest = tail.times.slice(1);
    const restMedian = pct([...rest].sort((a, b) => a - b), 50);
    if (restMedian <= first * THRESH.cacheSpeedupRatio) {
      flags.messageCache = 'likely_on';
    } else if (rest.every((t) => Math.abs(t - first) < first * 0.25)) {
      flags.messageCache = 'likely_off';
    } else {
      flags.messageCache = 'uncertain';
    }
  }

  return flags;
}

async function scanProductionBundle() {
  const { response, text: html } = await fetchText(`${BASE}/`);
  if (!response.ok) {
    record('bundle.index', '生产 index.html', 'fail', `HTTP ${response.status}`);
    return { tailPagination: 'unknown', chunks: [] };
  }

  const fromHtml = [...html.matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)].map((m) => m[1]);
  const unique = [...new Set(fromHtml)];

  // Vite 懒加载 chunk 可能只出现在 index.js 字符串里
  for (const file of [...unique]) {
    const { text } = await fetchText(`${BASE}/assets/${file}`);
    for (const m of text.matchAll(/assets\/([A-Za-z0-9_.-]+\.js)/g)) {
      unique.push(m[1]);
    }
  }
  const allChunks = [...new Set(unique)];

  let tailPagination = 'unknown';
  let evidence = '';

  for (const file of allChunks) {
    const { text } = await fetchText(`${BASE}/assets/${file}`);
    if (text.includes('VITE_TAIL_MESSAGE_PAGINATION') && text.includes('true')) {
      tailPagination = 'enabled_literal';
      evidence = file;
      break;
    }
    if (text.includes('VITE_TAIL_MESSAGE_PAGINATION') && text.includes('false')) {
      tailPagination = 'disabled_literal';
      evidence = file;
      break;
    }
    if (
      text.includes('buildTailFetchQueryParams')
      || text.includes('TAIL_PAGE_INITIAL_LIMIT')
      || (text.includes('direction') && text.includes('backward') && text.includes('limit'))
    ) {
      tailPagination = 'likely_enabled_minified';
      evidence = file;
    }
  }

  const verdict = tailPagination.includes('disabled') ? 'fail'
    : tailPagination === 'unknown' ? 'warn' : 'pass';
  record(
    'bundle.tailPagination',
    '生产包尾部分页',
    /** @type {Verdict} */ (verdict),
    `${tailPagination}${evidence ? ` (${evidence})` : ''}, chunks=${allChunks.length}`,
  );

  return { tailPagination, chunks: allChunks };
}

async function probeUiMessagesRequest(auth, sessionId, projectName) {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addInitScript((token) => {
      localStorage.setItem('auth-token', token);
    }, auth.Authorization.replace('Bearer ', ''));

    const page = await context.newPage();
    /** @type {string | null} */
    let capturedQuery = null;

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/messages') && url.includes(sessionId)) {
        capturedQuery = new URL(url).search;
      }
    });

    await page.goto(`${BASE}/p/${encodeURIComponent(projectName)}/s/${encodeURIComponent(sessionId)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForResponse(
      (r) => r.url().includes('/messages') && r.status() === 200,
      { timeout: 120_000 },
    ).catch(() => null);

    await browser.close();

    if (!capturedQuery) {
      record('ui.messagesQuery', '浏览器实际 messages 请求', 'warn', '未捕获到请求');
      return null;
    }

    const hasBackward = capturedQuery.includes('direction=backward');
    const hasLimit = /[?&]limit=\d+/.test(capturedQuery);
    record(
      'ui.messagesQuery',
      '浏览器实际 messages 请求',
      hasBackward && hasLimit ? 'pass' : 'fail',
      capturedQuery.slice(0, 160),
    );
    return capturedQuery;
  } catch (error) {
    record(
      'ui.messagesQuery',
      '浏览器实际 messages 请求',
      'skip',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * @param {Array<{ projectName: string, sessionId: string, title: string, totalHint?: number }>} samples
 * @param {Record<string, string>} auth
 */
async function probeSessions(samples, auth) {
  /** @type {Array<Record<string, unknown>>} */
  const sessionReports = [];

  for (const sample of samples) {
    const { projectName, sessionId, title } = sample;
    const tailUrl = messagesUrl(sessionId, projectName, {
      limit: '120',
      direction: 'backward',
    });
    const forwardUrl = messagesUrl(sessionId, projectName, {
      limit: '120',
      offset: '0',
    });
    const fullUrl = messagesUrl(sessionId, projectName, {});

    const tail = await benchMessages(tailUrl, auth, 5);
    const forward = await benchMessages(forwardUrl, auth, 1);
    const total = tail.body && typeof tail.body === 'object' && 'total' in tail.body
      ? Number(tail.body.total) || 0
      : 0;
    const full = total > 120 ? await benchMessages(fullUrl, auth, 1) : null;

    const flags = inferServerFlags(tail, full);

    let verdict = 'pass';
    if (tail.status !== 200) verdict = 'fail';
    else if (tail.p95 >= THRESH.tailMsFail || tail.kb >= THRESH.tailKbFail) verdict = 'fail';
    else if (tail.p95 >= THRESH.tailMsWarn || tail.kb >= THRESH.tailKbWarn) verdict = 'warn';

    record(
      `session.${sessionId.slice(0, 12)}`,
      `tail120 · ${title.slice(0, 40)}`,
      /** @type {Verdict} */ (verdict),
      `p50=${tail.p50}ms p95=${tail.p95}ms KB=${tail.kb} total=${total} | cache=${flags.messageCache} tailRead=${flags.tailRead} sanitize=${flags.sanitize}`,
    );

    sessionReports.push({
      projectName,
      sessionId,
      title,
      total,
      tail,
      forward,
      full,
      inferredFlags: flags,
      verdict,
    });
  }

  return sessionReports;
}

function collectSessionSamples(projects, maxSessions) {
  /** @type {Array<{ projectName: string, sessionId: string, title: string }>} */
  const samples = [];
  for (const project of projects) {
    const projectName = project.name || project.id;
    for (const session of (project.sessions ?? []).slice(0, maxSessions)) {
      const sessionId = session.id || session.sessionId;
      if (!sessionId) continue;
      samples.push({
        projectName,
        sessionId,
        title: session.title || session.summary || session.customTitle || sessionId,
      });
    }
  }
  return samples.slice(0, maxSessions);
}

function printReport(report) {
  console.log('\n=== 云端对话加载检测 ===');
  console.log(`BASE=${BASE}`);
  console.log(`USER=${USER}`);
  console.log(`时间=${report.generatedAt}\n`);

  for (const row of report.checks) {
    const icon = row.verdict === 'pass' ? '✓'
      : row.verdict === 'warn' ? '⚠'
        : row.verdict === 'fail' ? '✗' : '○';
    console.log(`${icon} [${row.id}] ${row.title}`);
    console.log(`    ${row.detail}`);
  }

  if (report.sessions?.length) {
    console.log('\n--- 会话明细 ---');
    for (const s of report.sessions) {
      console.log(`\n· ${s.title} (${s.projectName})`);
      console.log(`  tail120  p50=${s.tail.p50}ms p95=${s.tail.p95}ms KB=${s.tail.kb} total=${s.total}`);
      console.log(`  forward  ${s.forward.avg}ms KB=${s.forward.kb}`);
      if (s.full) console.log(`  full     ${s.full.avg}ms KB=${s.full.kb}`);
      console.log(`  推断: sanitize=${s.inferredFlags.sanitize} tailRead=${s.inferredFlags.tailRead} messageCache=${s.inferredFlags.messageCache}`);
    }
  }

  if (report.ecs) {
    console.log('\n--- ECS 只读探测 ---');
    if (report.ecs.skipped) {
      console.log(`○ ${report.ecs.reason || '未执行'}`);
    } else if (report.ecs.sshError) {
      console.log(`⚠ SSH 未连通（${report.ecs.config?.host || '?'}）— 本机需配置密钥后自动跑 verify-cloud-perf`);
    } else {
      console.log(`host=${report.ecs.config?.host} installRoot=${report.ecs.config?.installRoot}`);
      if (report.ecs.pg) {
        console.log(`PG backend=${report.ecs.pg.backend} ping=${report.ecs.pg.ping} catalog=${report.ecs.pg.catalogRows}`);
      }
      if (report.ecs.redis) {
        console.log(`Redis: ${report.ecs.redis}`);
      }
      if (report.ecs.verify) {
        console.log(`verify-cloud-perf: fail=${report.ecs.verify.failCount} warn=${report.ecs.verify.warnCount}`);
      }
    }
  }

  console.log('\n--- 汇总 ---');
  console.log(`pass=${report.summary.pass} warn=${report.summary.warn} fail=${report.summary.fail} skip=${report.summary.skip}`);
  if (report.summary.recommendations.length) {
    console.log('\n建议：');
    for (const line of report.summary.recommendations) {
      console.log(`  · ${line}`);
    }
  }
}

function buildRecommendations(checks, sessions) {
  /** @type {string[]} */
  const rec = [];

  const cacheLikelyOff = sessions.some((s) => s.inferredFlags.messageCache === 'likely_off');
  const tailReadOff = sessions.some((s) => s.inferredFlags.tailRead === 'likely_off');
  const sanitizeOff = sessions.some((s) => s.inferredFlags.sanitize === 'likely_off');
  const slowTail = sessions.some((s) => s.tail.p95 >= THRESH.tailMsWarn);

  if (sanitizeOff || sessions.some((s) => s.tail.kb >= THRESH.tailKbWarn)) {
    rec.push('ECS 确认 PILOTDECK_HISTORY_SANITIZE=1（apply-cloud-perf-env.sh 阶段 A）');
  }
  if (tailReadOff || slowTail) {
    rec.push('ECS 确认 PILOTDECK_HISTORY_TAIL_READ=1（阶段 B）并 recreate nova');
  }
  if (cacheLikelyOff) {
    rec.push('开启 PILOTDECK_HISTORY_MESSAGE_CACHE=1 + REDIS_URL（阶段 C），同会话二访应明显加速');
  }
  const bundleFail = checks.find((c) => c.id === 'bundle.tailPagination' && c.verdict === 'fail');
  if (bundleFail) {
    rec.push('重新 pack:deploy 并 upgrade，确保 VITE_TAIL_MESSAGE_PAGINATION=true 打入 UI');
  }
  const uiFail = checks.find((c) => c.id === 'ui.messagesQuery' && c.verdict === 'fail');
  if (uiFail) {
    rec.push('浏览器未发 direction=backward，客户端可能在拉全量或从头分页');
  }

  const ecsVerifyFail = checks.find((c) => c.id === 'ecs.verify_cloud_perf' && c.verdict === 'fail');
  if (ecsVerifyFail) {
    rec.push('ECS 上 bash verify-cloud-perf.sh 未通过，按 docs/history-messages-deploy-runbook.zh-CN.md 补 env 并 recreate');
  }
  const ecsPgFail = checks.find((c) => c.id === 'ecs.pg.probe' && c.verdict === 'fail');
  if (ecsPgFail) {
    rec.push('ECS 控制库（PostgreSQL/SQLite）探测失败，检查 SAAS_DATABASE_URL 与 PG 连通');
  }
  const ecsRedisFail = checks.find((c) => c.id === 'ecs.redis.ping' && c.verdict === 'fail');
  if (ecsRedisFail) {
    rec.push('ECS Redis 不可达，确认 nova-redis 容器与 REDIS_URL');
  }

  if (rec.length === 0) {
    rec.push('服务端延迟在可接受范围；若 UI 仍全屏 loading，优先做 stale-while-revalidate / sessionStorage 尾页缓存');
  }

  return rec;
}

async function main() {
  if (FORCE_ECS && !SKIP_ECS && !ECS_CONFIG.enabled) {
    record('ecs.config', 'ECS 只读探测', 'skip', '无法解析 ECS 主机（可设 ECS_SSH_HOST）');
  }

  /** @type {unknown} */
  let ecsReport = null;
  /** @type {ReturnType<typeof collectSessionSamples>} */
  let samples = [];
  /** @type {Array<Record<string, unknown>>} */
  let sessions = [];
  /** @type {{ tailPagination: string, chunks: string[] }} */
  let bundle = { tailPagination: 'unknown', chunks: [] };

  if (RUN_ECS) {
    ecsReport = probeEcsReadOnly(ECS_CONFIG, record);
  }

  if (!ECS_ONLY) {
    const { auth } = await login();
    await probeHealth(auth);

    const projectsResult = await fetchJson(`${BASE}/api/projects`, { headers: auth });
    if (!projectsResult.response.ok) {
      record('projects.list', 'GET /api/projects', 'fail', `HTTP ${projectsResult.response.status}`);
      throw new Error('无法读取项目列表');
    }

    const projectsVerdict = projectsResult.ms > THRESH.projectsMsWarn ? 'warn' : 'pass';
    record(
      'projects.list',
      'GET /api/projects',
      /** @type {Verdict} */ (projectsVerdict),
      `${projectsResult.ms}ms, ${Math.round(projectsResult.bytes / 1024)}KB`,
    );

    const projects = Array.isArray(projectsResult.body)
      ? projectsResult.body
      : projectsResult.body?.projects ?? [];

    samples = collectSessionSamples(projects, MAX_SESSIONS);
    if (samples.length === 0) {
      record('sessions.sample', '抽样会话', 'fail', '侧栏无会话可测');
    }

    bundle = await scanProductionBundle();
    sessions = samples.length > 0 ? await probeSessions(samples, auth) : [];

    if (UI_PROBE && samples[0]) {
      await probeUiMessagesRequest(auth, samples[0].sessionId, samples[0].projectName);
    }
  }

  const summary = {
    pass: checks.filter((c) => c.verdict === 'pass').length,
    warn: checks.filter((c) => c.verdict === 'warn').length,
    fail: checks.filter((c) => c.verdict === 'fail').length,
    skip: checks.filter((c) => c.verdict === 'skip').length,
    recommendations: buildRecommendations(checks, sessions),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    user: ECS_ONLY ? '(ecs-only)' : USER,
    ecsConfig: RUN_ECS ? {
      host: ECS_CONFIG.host,
      user: ECS_CONFIG.user,
      port: ECS_CONFIG.port,
      installRoot: ECS_CONFIG.installRoot,
      autoHost: ECS_CONFIG.autoHost,
      autoIdentity: ECS_CONFIG.autoIdentity,
    } : null,
    ecs: ecsReport && typeof ecsReport === 'object'
      ? {
          ...ecsReport,
          rawStdout: undefined,
          rawStderr: ecsReport.rawStderr ? String(ecsReport.rawStderr).slice(0, 500) : undefined,
        }
      : ecsReport,
    checks,
    bundle,
    sessions,
    summary,
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  const outDir = join(REPO_ROOT, 'docs');
  mkdirSync(outDir, { recursive: true });
  const stamp = report.generatedAt.slice(0, 10).replace(/-/g, '');
  const outPath = join(outDir, `diag-cloud-conversation-load-${stamp}.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!JSON_OUT) {
    console.log(`\n报告已写入 ${outPath}`);
  }

  if (GATE && summary.fail > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[diag-cloud-conversation-load] 失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
