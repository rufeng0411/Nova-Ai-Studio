#!/usr/bin/env node
/**
 * PD-SAAS-FORK: SEC-01~10 security regression checklist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'full-test');
const OUT_FILE = path.join(OUT_DIR, 'security-checklist.json');

const results = [];

function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(pathname, options = {}) {
  const res = await fetch(`${SERVER}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  const projects = await api('/api/projects');
  record('SEC-01', '未登录访问 /api/projects', projects.status === 401 || projects.status === 403, `status=${projects.status}`);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  const adminToken = login.json?.token;
  record('SEC-05', 'SaaS 登录墙 admin 可登录', Boolean(adminToken));

  const status = await api('/api/auth/status');
  record('SEC-05b', 'auth/status saasMode', status.json?.saasMode === true, `saasMode=${status.json?.saasMode}`);

  if (adminToken) {
    const fakeSession = await api(
      '/api/sessions/web-s_fake999/messages?projectName=general&limit=120&direction=backward',
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    record(
      'SEC-12',
      '伪造 sessionId GET messages',
      fakeSession.status === 404 || fakeSession.status === 403,
      `status=${fakeSession.status}`,
    );

    const configPut = await api('/api/config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ foo: 'bar' }),
    });
    record('SEC-02', 'admin 写全局 config（应允许或 403 成员专用）', configPut.status !== 500, `status=${configPut.status}`);
  }

  const badJwt = await api('/api/projects', {
    headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.e30' },
  });
  record('SEC-04', '篡改 JWT', badJwt.status === 401 || badJwt.status === 403, `status=${badJwt.status}`);

  const register = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: `sec_${Date.now()}`, password: 'secret1234' }),
  });
  record('SEC-06', '注册无验证码', register.status === 400, `status=${register.status}`);

  const sqli = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: "' OR 1=1 --", password: 'x' }),
  });
  record('SEC-10', 'SQL 注入探针登录', sqli.status === 401 || sqli.status === 400, `status=${sqli.status}`);

  const storageAnon = await api('/api/saas/storage/status');
  record('SEC-03', '未登录 storage/status', storageAnon.status === 401 || storageAnon.status === 403, `status=${storageAnon.status}`);

  const gitCheck = spawnSync('git', ['check-ignore', '-v', 'deploy/.env'], { cwd: REPO_ROOT, encoding: 'utf8' });
  record('SEC-08', 'deploy/.env gitignore', gitCheck.status === 0, gitCheck.stdout.trim().slice(0, 80));

  record('SEC-07', '遥测默认关闭（观察项）', true, 'manual: pilotdeck.yaml telemetry disabled');
  record('SEC-09', 'CORS 本地默认（观察项）', true, 'document in brand-security-audit.md');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = {
    capturedAt: new Date().toISOString(),
    server: SERVER,
    results,
    pass: results.filter((r) => r.id.startsWith('SEC-') && !r.id.endsWith('b')).every((r) => r.ok),
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[security] → ${OUT_FILE}`);
  if (!summary.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
