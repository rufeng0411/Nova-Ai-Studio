#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 云端生产环境深度验收（HTTP API + 轻量承载/破坏性探测）
 *
 * 用法:
 *   PROD_BASE_URL=http://www.novapage.online node scripts/integration-production-cloud-deep.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const BASE = (process.env.PROD_BASE_URL || 'http://www.novapage.online').replace(/\/$/, '');
const HTTPS_BASE = BASE.replace(/^http:/, 'https:');
const ADMIN_USER = process.env.PROD_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.PROD_ADMIN_PASS || 'SAAS_ADMIN_PASSWORD';
const ARTIFACT_DIR = join(REPO_ROOT, 'artifacts', 'production-cloud-test');
const REPORT_JSON = join(ARTIFACT_DIR, 'api-report.json');

const results = [];

function record(id, name, ok, detail = '', ms = 0, severity = ok ? 'pass' : 'fail') {
  const row = { id, name, ok, detail, ms, severity, at: new Date().toISOString() };
  results.push(row);
  const tag = ok ? 'PASS' : severity === 'warn' ? 'WARN' : 'FAIL';
  console.log(`[prod] ${tag} ${id} ${name}${detail ? ` — ${detail}` : ''}${ms ? ` (${ms}ms)` : ''}`);
}

async function timed(fn) {
  const t0 = Date.now();
  const out = await fn();
  return { out, ms: Date.now() - t0 };
}

async function fetchJson(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, url };
}

async function adminLogin() {
  const { res, body } = await fetchJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  });
  if (!res.ok || !body?.token) {
    throw new Error(`admin login ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  }
  return body.token;
}

async function registerMember(prefix = 'prodtest') {
  const cap = await fetchJson('/api/saas/captcha');
  if (!cap.res.ok) throw new Error(`captcha ${cap.res.status}`);
  const username = `${prefix}_${Date.now()}`;
  const { res, body } = await fetchJson('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password: 'ProdTest12!',
      captchaId: cap.body.captchaId,
      captchaAnswer: cap.body.challenge,
    }),
  });
  if (!res.ok || !body?.token) {
    throw new Error(`register ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  }
  return { username, token: body.token };
}

async function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  console.log(`[prod] 目标: ${BASE}`);

  // --- 连通性 ---
  try {
    const { out, ms } = await timed(() => fetch(BASE, { method: 'HEAD' }));
    record('NET-01', 'HTTP 可达', out.ok, `status=${out.status}`, ms);
  } catch (e) {
    record('NET-01', 'HTTP 可达', false, e.message);
  }

  try {
    const { out, ms } = await timed(() => fetch(HTTPS_BASE, { method: 'HEAD', signal: AbortSignal.timeout(8000) }));
    record('NET-02', 'HTTPS 可达', out.ok, `status=${out.status}`, ms, out.ok ? 'pass' : 'warn');
  } catch (e) {
    record('NET-02', 'HTTPS 可达', false, e.message, 0, 'warn');
  }

  // --- 认证 / SaaS ---
  let adminToken = null;
  try {
    const { out: token, ms } = await timed(() => adminLogin());
    adminToken = token;
    record('AUTH-01', '管理员登录', true, ADMIN_USER, ms);
  } catch (e) {
    record('AUTH-01', '管理员登录', false, e.message);
  }

  try {
    const { out, ms } = await timed(() => fetchJson('/api/auth/status'));
    const { res, body } = out;
    record(
      'AUTH-02',
      'SaaS 模式状态',
      res.ok && body?.saasMode === true,
      `saasMode=${body?.saasMode} authDisabled=${body?.authDisabled}`,
      ms,
    );
  } catch (e) {
    record('AUTH-02', 'SaaS 模式状态', false, e.message);
  }

  try {
    const { res } = await fetchJson('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x', password: 'short' }),
    });
    record('AUTH-03', '注册缺验证码拒绝', res.status === 400, `status=${res.status}`);
  } catch (e) {
    record('AUTH-03', '注册缺验证码拒绝', false, e.message);
  }

  let member = null;
  try {
    const { out, ms } = await timed(() => registerMember('clouduat'));
    member = out;
    record('AUTH-04', '成员注册', true, out.username, ms);
  } catch (e) {
    record('AUTH-04', '成员注册', false, e.message);
  }

  // --- 破坏性 / 安全探测（非毁数据）---
  try {
    const { res } = await fetchJson('/api/projects', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    record('DEST-01', '无效 JWT 拒绝', res.status === 401 || res.status === 403, `status=${res.status}`);
  } catch (e) {
    record('DEST-01', '无效 JWT 拒绝', false, e.message);
  }

  try {
    const { res } = await fetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password-xyz' }),
    });
    record('DEST-02', '错误密码拒绝', res.status === 401 || res.status === 400, `status=${res.status}`);
  } catch (e) {
    record('DEST-02', '错误密码拒绝', false, e.message);
  }

  if (member?.token) {
    try {
      const { res } = await fetchJson('/api/saas/admin/users', {
        headers: { Authorization: `Bearer ${member.token}` },
      });
      record('DEST-03', '成员无法访问管理 API', res.status === 403 || res.status === 401, `status=${res.status}`);
    } catch (e) {
      record('DEST-03', '成员无法访问管理 API', false, e.message);
    }
  }

  // --- 功能 API ---
  if (adminToken) {
    const auth = { Authorization: `Bearer ${adminToken}` };

    try {
      const samples = [];
      for (let i = 0; i < 10; i++) {
        const t0 = Date.now();
        const { res } = await fetchJson('/api/saas/captcha', { headers: auth });
        samples.push({ ok: res.ok, ms: Date.now() - t0 });
      }
      const avg = Math.round(samples.reduce((s, x) => s + x.ms, 0) / samples.length);
      record('PERF-01', 'Captcha 10 次均值', samples.every((s) => s.ok), `avg=${avg}ms`, avg);
    } catch (e) {
      record('PERF-01', 'Captcha 10 次均值', false, e.message);
    }

    try {
      const { out, ms } = await timed(() =>
        fetchJson('/api/projects', { headers: auth }),
      );
      const { res, body } = out;
      const count = Array.isArray(body) ? body.length : body?.projects?.length ?? 0;
      record('FUNC-01', '项目列表', res.ok, `count=${count}`, ms);
    } catch (e) {
      record('FUNC-01', '项目列表', false, e.message);
    }

    try {
      const { out, ms } = await timed(() =>
        fetchJson('/api/capabilities/welcome', { headers: auth }),
      );
      const { res, body } = out;
      const n = Array.isArray(body?.items) ? body.items.length : Array.isArray(body) ? body.length : 0;
      record('FUNC-02', '能力中心 welcome', res.ok, `items=${n}`, ms);
    } catch (e) {
      record('FUNC-02', '能力中心 welcome', false, e.message);
    }

    try {
      const { out, ms } = await timed(() =>
        fetchJson('/api/capabilities?locale=zh-CN', { headers: auth }),
      );
      const { res, body } = out;
      const skills = body?.capabilities || body?.skills || [];
      record('FUNC-03', '能力目录 hub', res.ok && skills.length > 100, `capabilities=${skills.length}`, ms);
    } catch (e) {
      record('FUNC-03', '能力目录 catalog', false, e.message);
    }

    try {
      const { out, ms } = await timed(() =>
        fetchJson('/api/saas/admin/dashboard', { headers: auth }),
      );
      const { res } = out;
      record('FUNC-04', '管理仪表盘 API', res.ok, `status=${res.status}`, ms);
    } catch (e) {
      record('FUNC-04', '管理仪表盘 API', false, e.message);
    }

    try {
      const { out, ms } = await timed(() =>
        fetchJson('/api/projects/general/files/export/capabilities', { headers: auth }),
      );
      const { res, body } = out;
      const ok = res.ok && (body?.formats || body?.capabilities || Array.isArray(body));
      record(
        'FIX-01',
        '文档导出 capabilities API',
        ok,
        typeof body === 'object' ? JSON.stringify(body).slice(0, 160) : String(body).slice(0, 80),
        ms,
        ok ? 'pass' : 'warn',
      );
    } catch (e) {
      record('FIX-01', '文档导出 capabilities API', false, e.message, 0, 'warn');
    }

    // Skills 抽样存在性（各类型）
    try {
      const { body } = await fetchJson('/api/capabilities?locale=zh-CN', { headers: auth });
      const skills = body?.capabilities || [];
      const slugs = new Set(skills.map((s) => s.slug));
      const picks = [
        { id: 'SKILL-GEO', slug: 'pd-geo', cat: '营销飞轮' },
        { id: 'SKILL-DOCX', slug: 'anth-docx', cat: '办公' },
        { id: 'SKILL-OD', slug: 'open-design', cat: '创作' },
        { id: 'SKILL-TPL', slug: 'geo-aeo-audit', cat: '流程模板关联' },
        { id: 'SKILL-EDU', slug: 'hermes-primary-math', cat: '教育' },
      ];
      for (const p of picks) {
        const found = slugs.has(p.slug);
        record(p.id, `目录含 ${p.slug}（${p.cat}）`, found, found ? 'catalog' : 'missing');
      }
    } catch (e) {
      record('SKILL-CAT', '技能目录抽样', false, e.message);
    }
  }

  // --- 租户隔离（双用户 projects）---
  if (adminToken && member?.token) {
    try {
      const a = await fetchJson('/api/projects', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const m = await fetchJson('/api/projects', {
        headers: { Authorization: `Bearer ${member.token}` },
      });
      const aList = Array.isArray(a.body) ? a.body : a.body?.projects || [];
      const mList = Array.isArray(m.body) ? m.body : m.body?.projects || [];
      const aNames = new Set(aList.map((p) => p.name || p.id).filter((n) => n !== 'general'));
      const overlap = mList.filter((p) => {
        const n = p.name || p.id;
        return n !== 'general' && aNames.has(n);
      });
      record(
        'ISO-01',
        '租户项目列表隔离',
        overlap.length === 0,
        `admin=${aList.length} member=${mList.length} overlap=${overlap.length}`,
      );
    } catch (e) {
      record('ISO-01', '租户项目列表隔离', false, e.message);
    }
  }

  // --- 承载（轻量并发）---
  try {
    const concurrency = 20;
    const t0 = Date.now();
    const responses = await Promise.all(
      Array.from({ length: concurrency }, () => fetch(`${BASE}/login`, { method: 'GET' })),
    );
    const ms = Date.now() - t0;
    const ok = responses.filter((r) => r.ok).length;
    record(
      'LOAD-01',
      `登录页 ${concurrency} 并发`,
      ok >= concurrency * 0.9,
      `${ok}/${concurrency} ok in ${ms}ms`,
      ms,
      ok >= concurrency * 0.9 ? 'pass' : 'warn',
    );
  } catch (e) {
    record('LOAD-01', '登录页并发', false, e.message);
  }

  if (adminToken) {
    try {
      const concurrency = 15;
      const t0 = Date.now();
      const responses = await Promise.all(
        Array.from({ length: concurrency }, () =>
          fetch(`${BASE}/api/saas/captcha`, {
            headers: { Authorization: `Bearer ${adminToken}` },
          }),
        ),
      );
      const ms = Date.now() - t0;
      const ok = responses.filter((r) => r.ok).length;
      record(
        'LOAD-02',
        `Captcha API ${concurrency} 并发`,
        ok >= concurrency * 0.85,
        `${ok}/${concurrency} ok in ${ms}ms`,
        ms,
      );
    } catch (e) {
      record('LOAD-02', 'Captcha 并发', false, e.message);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok && r.severity === 'fail').length;
  const warned = results.filter((r) => !r.ok && r.severity === 'warn').length;
  const summary = { base: BASE, passed, failed, warned, total: results.length, results };
  writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  console.log(`\n[prod] 完成: ${passed}/${results.length} pass, ${failed} fail, ${warned} warn`);
  console.log(`[prod] 报告: ${REPORT_JSON}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[prod] fatal', e);
  process.exit(1);
});
