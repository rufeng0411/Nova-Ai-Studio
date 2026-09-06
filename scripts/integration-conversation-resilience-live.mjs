#!/usr/bin/env node
/**
 * PD-SAAS-FORK: live SaaS resilience checks (health, auth, no Recovery leak on shell).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const VITE = (process.env.VITE_URL || process.env.BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'pre-production-test');
const OUT_FILE = path.join(OUT_DIR, 'resilience-live.json');

const results = [];
function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
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
  const health = await apiJson(`${SERVER}/api/saas/health`);
  record('R-LIVE-00', 'Server health', health.ok, SERVER);

  const login = await apiJson(`${SERVER}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
  });
  record('R-LIVE-01', 'Admin login API', login.ok && Boolean(login.json?.token), `status=${login.status}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${VITE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#saas-login-username', 'admin');
  await page.fill('#saas-login-password', 'SAAS_ADMIN_PASSWORD');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/p\//, { timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const bodyText = await page.locator('body').innerText();
  record('R-LIVE-02', 'No Several tools failed in UI', !/Several tools failed/i.test(bodyText));
  record('R-LIVE-03', 'No Failed tools: read_file leak', !/Failed tools:\s*read_file/i.test(bodyText));

  const composer = page.locator('form').filter({ has: page.locator('textarea') }).first();
  record('R-LIVE-04', 'Composer visible when logged in', await composer.isVisible().catch(() => false));

  await page.context().setOffline(true);
  await page.waitForTimeout(1500);
  const sendDisabled = await page.locator('button[type="submit"]').first().isDisabled().catch(() => false);
  record('R-LIVE-05', 'Offline: send disabled or composer guarded', sendDisabled || !(await composer.isEnabled().catch(() => true)));

  await page.context().setOffline(false);
  await page.waitForTimeout(3000);
  record('R-LIVE-06', 'Back online: composer still present', await composer.isVisible().catch(() => false));

  await browser.close();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const summary = {
    capturedAt: new Date().toISOString(),
    results,
    pass: results.every((r) => r.ok),
  };
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  if (!summary.pass) process.exit(1);
  console.log(`[resilience-live] OK → ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
