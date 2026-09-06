#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Docker production smoke (DOCKER-01~05).
 * Usage: node scripts/docker-smoke.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEPLOY = path.join(REPO_ROOT, 'deploy');
const COMPOSE = path.join(DEPLOY, 'docker-compose.prod.yml');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'full-test');
const OUT_FILE = path.join(OUT_DIR, 'docker-smoke.json');
const BASE = 'http://127.0.0.1:3001';

const results = [];

function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

function docker(...args) {
  const useShell = process.platform === 'win32';
  return spawnSync('docker', args, { cwd: DEPLOY, encoding: 'utf8', shell: useShell });
}

function compose(...args) {
  const envFile = fs.existsSync(path.join(DEPLOY, '.env'))
    ? path.join(DEPLOY, '.env')
    : path.join(DEPLOY, 'env.local');
  return docker('compose', '-f', COMPOSE, '--env-file', envFile, ...args);
}

async function apiJson(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  const dockerInfo = docker('info');
  if (dockerInfo.status !== 0) {
    record('DOCKER-00', 'Docker daemon', false, 'Docker not available');
    writeSummary(false);
    process.exit(1);
  }
  record('DOCKER-00', 'Docker daemon', true);

  const up = compose('up', '-d');
  record('DOCKER-UP', 'compose up -d', up.status === 0, up.stderr?.slice(0, 120) || '');

  await new Promise((r) => setTimeout(r, 15_000));

  const captcha = await apiJson('/api/saas/captcha');
  record('DOCKER-01', 'captcha health', captcha.ok, `status=${captcha.status}`);

  const login = await apiJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  const token = login.json?.token;
  record('DOCKER-02', 'admin login', Boolean(token), `status=${login.status}`);

  if (token) {
    const overview = await apiJson('/api/saas/admin/overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    record('DOCKER-03', 'admin overview', overview.ok, `status=${overview.status}`);
  } else {
    record('DOCKER-03', 'admin overview', false, 'no token');
  }

  const load = spawnSync(process.execPath, ['scripts/load/http-load.mjs', '--scenario', 'smoke'], {
    cwd: REPO_ROOT,
    env: { ...process.env, SERVER_URL: BASE },
    encoding: 'utf8',
    shell: false,
  });
  record('DOCKER-04', 'http-load smoke', load.status === 0, load.status === 0 ? '' : 'exit non-zero');

  let composerOk = false;
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.fill('#saas-login-username', 'admin');
    await page.fill('#saas-login-password', 'SAAS_ADMIN_PASSWORD');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/p\//, { timeout: 30_000 }).catch(() => {});
    const composer = page.locator('form').filter({ has: page.locator('textarea') }).first();
    composerOk = await composer.isVisible().catch(() => false);
    await browser.close();
  } catch (e) {
    composerOk = false;
  }
  record('DOCKER-05', 'Composer visible after login', composerOk);

  compose('down');
  writeSummary(results.every((r) => r.ok || r.id === 'DOCKER-UP'));
  if (!results.filter((r) => r.id.startsWith('DOCKER-0')).every((r) => r.ok)) process.exit(1);
}

function writeSummary(pass) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    `${JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, results, pass }, null, 2)}\n`,
    'utf8',
  );
  console.log(`[docker-smoke] → ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
