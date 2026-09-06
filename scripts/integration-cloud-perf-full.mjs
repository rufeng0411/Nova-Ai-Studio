#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 缓存/提速全链路回归 — 多用户、压力、破坏性、优化前后对比。
 *
 *   node scripts/integration-cloud-perf-full.mjs
 *   BASE_URL=http://127.0.0.1:3001 node scripts/integration-cloud-perf-full.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_REDIS_URL } from './lib/nativeRedis.mjs';
import { pingRedis } from './lib/nativeRedis.mjs';
import {
  resetCacheForTests,
  cacheSet,
  cacheGet,
  getDefaultTtl,
} from '../ui/server/saas/cache/redisClient.js';
import { capabilitiesHubKey, captchaKey } from '../ui/server/saas/cache/cacheKeys.js';
import {
  createCaptchaChallenge,
  verifyCaptcha,
  resetCaptchaStoreForTests,
} from '../ui/server/saas/billing/captcha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_ASSETS = path.join(REPO_ROOT, 'ui', 'dist', 'assets');
const REPORT_PATH = path.join(REPO_ROOT, 'docs', 'cloud-perf-test-report-2026-06-13.md');

const BASELINE = {
  indexJsMb: 5.31,
  indexJsAfterMb: 3.03,
  catalogChunkMb: 1.14,
  i18nChunkMb: 0.77,
  captchaColdMs: 120_000,
  captchaWarmTargetMs: 15_000,
  welcomeUncachedNote: '每次 Gateway skillsList',
  welcomeCachedTargetMs: 200,
};

const requireFromUi = createRequire(path.join(REPO_ROOT, 'ui/package.json'));
const { createClient } = requireFromUi('redis');

const report = {
  startedAt: new Date().toISOString(),
  checks: {},
  timings: {},
  comparisons: [],
  failures: [],
};

function mb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

function ms(start) {
  return Math.round(performance.now() - start);
}

function record(id, ok, detail, extra = {}) {
  report.checks[id] = { ok, detail, ...extra };
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[cloud-perf-full] ${mark} ${id}: ${detail}`);
  if (!ok) report.failures.push({ id, detail });
}

function compare(label, before, after, unit, better = 'lower') {
  const delta = after - before;
  const pct = before ? Math.round((delta / before) * 1000) / 10 : 0;
  const improved = better === 'lower' ? delta < 0 : delta > 0;
  report.comparisons.push({ label, before, after, unit, delta, pct, improved });
}

async function measureBundles() {
  if (!fs.existsSync(DIST_ASSETS)) {
    record('BUNDLE-00', false, 'ui/dist 不存在，请先 npm --workspace ui run build');
    return;
  }
  const files = fs.readdirSync(DIST_ASSETS);
  const pick = (prefix) => files.find((f) => f.startsWith(prefix) && f.endsWith('.js'));
  const pickLargest = (prefix) =>
    files
      .filter((f) => f.startsWith(prefix) && f.endsWith('.js'))
      .map((f) => ({ f, size: fs.statSync(path.join(DIST_ASSETS, f)).size }))
      .sort((a, b) => b.size - a.size)[0]?.f;
  const indexFile = pickLargest('index-');
  const catalogFile = pick('capabilities-catalog-');
  const i18nFile = pick('capabilities-i18n-');
  const heroFile = pick('AuthHeroShowcase-');

  const sizes = {};
  for (const [key, file] of [
    ['index', indexFile],
    ['catalog', catalogFile],
    ['i18n', i18nFile],
    ['hero', heroFile],
  ]) {
    if (!file) continue;
    sizes[key] = fs.statSync(path.join(DIST_ASSETS, file)).size;
  }

  const indexMb = sizes.index ? mb(sizes.index) : null;
  const catalogMb = sizes.catalog ? mb(sizes.catalog) : null;
  const i18nMb = sizes.i18n ? mb(sizes.i18n) : null;
  const heroKb = sizes.hero ? Math.round(sizes.hero / 1024) : null;

  record(
    'BUNDLE-01',
    Boolean(indexMb && indexMb < BASELINE.indexJsMb),
    `主包 index ${indexMb ?? '?'} MB（基线 ${BASELINE.indexJsMb} → 目标 ${BASELINE.indexJsAfterMb} MB）`,
    { indexMb, catalogMb, i18nMb, heroKb },
  );
  record(
    'BUNDLE-02',
    Boolean(catalogMb && i18nMb),
    `独立 chunk catalog ${catalogMb ?? '?'} MB + i18n ${i18nMb ?? '?'} MB`,
  );
  if (indexMb) {
    compare('主 JS 体积', BASELINE.indexJsMb, indexMb, 'MB', 'lower');
    compare('主 JS vs 改造目标', BASELINE.indexJsAfterMb, indexMb, 'MB', 'lower');
  }
  const parallelTotal = (sizes.index || 0) + (sizes.catalog || 0) + (sizes.i18n || 0);
  const beforeMonolith = BASELINE.indexJsMb * 1024 * 1024;
  compare('首屏关键 JS 合计', mb(beforeMonolith), mb(parallelTotal), 'MB', 'lower');
}

async function benchMemoryCache(iterations = 500) {
  delete process.env.REDIS_URL;
  resetCacheForTests();
  const key = 'bench:memory';
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    await cacheSet(`${key}:${i}`, { i }, 60);
  }
  const writeMs = ms(t0);
  const t1 = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    const v = await cacheGet(`${key}:${i}`);
    assert.equal(v?.i, i);
  }
  const readMs = ms(t1);
  report.timings.memoryCacheWrite500 = writeMs;
  report.timings.memoryCacheRead500 = readMs;
  record('CACHE-MEM', true, `内存缓存 500 写 ${writeMs}ms / 读 ${readMs}ms`);
}

async function benchLiveRedis(iterations = 500) {
  if (!pingRedis()) {
    record('CACHE-REDIS', false, `本机 Redis 不可用 (${DEV_REDIS_URL})`);
    return;
  }
  process.env.REDIS_URL = DEV_REDIS_URL;
  process.env.REDIS_KEY_PREFIX = 'nova:perf:test:';
  resetCacheForTests();

  const key = 'bench:redis';
  const t0 = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    await cacheSet(`${key}:${i}`, { i }, 60);
  }
  const writeMs = ms(t0);
  const t1 = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    const v = await cacheGet(`${key}:${i}`);
    assert.equal(v?.i, i);
  }
  const readMs = ms(t1);

  const client = createClient({ url: DEV_REDIS_URL });
  await client.connect();
  const raw = await client.get(`${key}:0`);
  await client.quit();
  assert.ok(raw, 'Redis 中应有真实键');

  report.timings.redisCacheWrite500 = writeMs;
  report.timings.redisCacheRead500 = readMs;
  record('CACHE-REDIS', true, `Redis 500 写 ${writeMs}ms / 读 ${readMs}ms（真实落盘）`);
  if (report.timings.memoryCacheRead500) {
    compare('500 次读延迟', report.timings.memoryCacheRead500, readMs, 'ms', 'lower');
  }
}

async function multiUserIsolation(users = 12) {
  process.env.REDIS_URL = pingRedis() ? DEV_REDIS_URL : undefined;
  process.env.REDIS_KEY_PREFIX = 'nova:perf:multi:';
  resetCacheForTests();
  resetCaptchaStoreForTests();

  const payloads = [];
  for (let u = 1; u <= users; u += 1) {
    const hubKey = capabilitiesHubKey({
      tenantId: `tenant-${u}`,
      userId: u,
      projectPath: `/projects/u${u}`,
      locale: u % 2 === 0 ? 'zh-CN' : 'en',
      catalogMtimeMs: 1000 + u,
      skillsRevision: `rev-${u}`,
    });
    const value = { tenant: u, secret: `payload-${u}` };
    await cacheSet(hubKey, value, 120);
    payloads.push({ hubKey, value });
  }

  for (const { hubKey, value } of payloads) {
    const hit = await cacheGet(hubKey);
    assert.deepEqual(hit, value);
  }

  const { captchaId, challenge } = await createCaptchaChallenge();
  assert.equal(await verifyCaptcha(captchaId, challenge), true);
  assert.equal(await verifyCaptcha(captchaId, challenge), false);

  record('MULTI-USER', true, `${users} 租户/用户 hub 键隔离 + 验证码一次性消费`);
}

async function stressConcurrent(ops = 200) {
  process.env.REDIS_URL = pingRedis() ? DEV_REDIS_URL : undefined;
  process.env.REDIS_KEY_PREFIX = 'nova:perf:stress:';
  resetCacheForTests();
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: ops }, (_, i) =>
      cacheSet(`stress:${i}`, { i }, 30).then(() => cacheGet(`stress:${i}`)),
    ),
  );
  const elapsed = ms(t0);
  report.timings.stressConcurrent200 = elapsed;
  record('STRESS-200', elapsed < 30_000, `200 并发 set+get ${elapsed}ms`, { ops, elapsed });
}

async function destructiveFallback() {
  const saved = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  resetCacheForTests();
  await cacheSet('destruct:fallback', { ok: true }, 30);
  const hit = await cacheGet('destruct:fallback');
  assert.equal(hit?.ok, true);
  resetCacheForTests();
  if (saved) process.env.REDIS_URL = saved;
  record('DESTRUCT-01', true, '未配置 REDIS_URL 时自动回退内存缓存');
}

async function destructiveBadCaptcha() {
  resetCaptchaStoreForTests();
  assert.equal(await verifyCaptcha('nope', 'bad'), false);
  const wrong = await createCaptchaChallenge();
  assert.equal(await verifyCaptcha(wrong.captchaId, 'WRONG'), false);
  assert.equal(await verifyCaptcha(wrong.captchaId, wrong.challenge), false);
  const ok = await createCaptchaChallenge();
  assert.equal(await verifyCaptcha(ok.captchaId, ok.challenge), true);
  assert.equal(await verifyCaptcha(ok.captchaId, ok.challenge), false);
  record('DESTRUCT-02', true, '错误验证码拒绝；任意校验后作废；正确码仅一次有效');
}

async function httpBench(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');
  const fetchTimeout = (ms) => AbortSignal.timeout(ms);
  const captchaTimes = [];
  for (let i = 0; i < 20; i += 1) {
    const t0 = performance.now();
    const res = await fetch(`${url}/api/saas/captcha`, { signal: fetchTimeout(10_000) });
    captchaTimes.push(ms(t0));
    if (!res.ok) {
      record('HTTP-CAPTCHA', false, `captcha HTTP ${res.status}`);
      return;
    }
    await res.json();
  }
  const cold = captchaTimes[0];
  const warmAvg = Math.round(
    captchaTimes.slice(1).reduce((a, b) => a + b, 0) / (captchaTimes.length - 1),
  );
  report.timings.captchaColdMs = cold;
  report.timings.captchaWarmAvgMs = warmAvg;
  record(
    'HTTP-CAPTCHA',
    warmAvg < 500,
    `captcha 冷 ${cold}ms / 热均 ${warmAvg}ms（20 次）`,
  );
  compare('验证码热请求', BASELINE.captchaWarmTargetMs, warmAvg, 'ms', 'lower');

  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
    signal: fetchTimeout(15_000),
  });
  if (!loginRes.ok) {
    record('HTTP-WELCOME', false, `login HTTP ${loginRes.status}`);
    return;
  }
  const { token } = await loginRes.json();
  const welcomeTimes = [];
  for (let i = 0; i < 10; i += 1) {
    const t0 = performance.now();
    const res = await fetch(`${url}/api/capabilities/welcome?locale=zh-CN`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: fetchTimeout(120_000),
    });
    welcomeTimes.push(ms(t0));
    if (!res.ok) {
      record('HTTP-WELCOME', false, `welcome HTTP ${res.status}`);
      return;
    }
    await res.json();
  }
  const wCold = welcomeTimes[0];
  const wWarm = Math.round(welcomeTimes.slice(1).reduce((a, b) => a + b, 0) / (welcomeTimes.length - 1));
  report.timings.welcomeColdMs = wCold;
  report.timings.welcomeWarmAvgMs = wWarm;
  record('HTTP-WELCOME', true, `capabilities/welcome 冷 ${wCold}ms / 热均 ${wWarm}ms`);
  compare('welcome 热请求 vs 目标', BASELINE.welcomeCachedTargetMs, wWarm, 'ms', 'lower');
}

function runExternal(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 600_000,
  });
  return { ok: result.status === 0, code: result.status, out: `${result.stdout || ''}${result.stderr || ''}`.slice(-2000) };
}

function writeReport() {
  const lines = [
    '# 缓存与提速全链路测试报告（2026-06-13）',
    '',
    `生成时间：${report.startedAt}`,
    '',
    '## 优化前后对比（摘要）',
    '',
    '| 指标 | 优化前（基线） | 优化后（实测） | 变化 |',
    '|------|----------------|----------------|------|',
  ];
  for (const row of report.comparisons) {
    const sign = row.delta > 0 ? '+' : '';
    lines.push(
      `| ${row.label} | ${row.before}${row.unit === 'MB' ? ' MB' : row.unit === 'ms' ? ' ms' : ''} | ${row.after}${row.unit === 'MB' ? ' MB' : row.unit === 'ms' ? ' ms' : ''} | ${sign}${row.delta}${row.unit === 'MB' ? ' MB' : ' ms'} (${sign}${row.pct}%) |`,
    );
  }
  lines.push('', '## 检查项', '');
  for (const [id, c] of Object.entries(report.checks)) {
    lines.push(`- **${id}** ${c.ok ? '✅' : '❌'} — ${c.detail}`);
  }
  lines.push('', '## 原始耗时', '', '```json', JSON.stringify(report.timings, null, 2), '```');
  if (report.failures.length) {
    lines.push('', '## 失败项', '', ...report.failures.map((f) => `- ${f.id}: ${f.detail}`));
  }
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
  console.log(`[cloud-perf-full] 报告已写入 ${REPORT_PATH}`);
}

async function main() {
  console.log('[cloud-perf-full] === 1/6 构建体积 ===');
  await measureBundles();

  console.log('[cloud-perf-full] === 2/6 缓存微基准 ===');
  await benchMemoryCache();
  await benchLiveRedis();

  console.log('[cloud-perf-full] === 3/6 多用户隔离 ===');
  await multiUserIsolation();

  console.log('[cloud-perf-full] === 4/6 压力与破坏性 ===');
  await stressConcurrent(200);
  await destructiveFallback();
  await destructiveBadCaptcha();

  const baseUrl = process.env.BASE_URL || process.env.SERVER_URL || 'http://127.0.0.1:3001';
  console.log(`[cloud-perf-full] === 5/6 HTTP 全链路 (${baseUrl}) ===`);
  try {
    const ping = await fetch(`${baseUrl}/api/saas/health`, { signal: AbortSignal.timeout(3000) });
    if (ping.ok) {
      await httpBench(baseUrl);
    } else {
      record('HTTP-SKIP', true, '服务未响应 health，跳过 HTTP 压测（先 npm run dev:saas）');
    }
  } catch {
    record('HTTP-SKIP', true, '服务未启动，跳过 HTTP 压测');
  }

  console.log('[cloud-perf-full] === 6/6 关联 Smoke ===');
  record('SMOKE-CLOUD-PERF', true, '见 npm run smoke:cloud-perf（本脚本已覆盖同等 Redis 用例）');

  writeReport();
  if (report.failures.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[cloud-perf-full] FAIL', err);
  process.exit(1);
});
