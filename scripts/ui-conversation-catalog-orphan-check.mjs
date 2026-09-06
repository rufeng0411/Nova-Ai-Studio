#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright — orphan jsonl reconcile smoke (catalog shadow + backfill).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.VITE_URL || 'http://127.0.0.1:5173';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(__dirname, '..');

function runBackfill() {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ['scripts/backfill-conversation-catalog.mjs'], {
      cwd: repo,
      env: { ...process.env, PILOTDECK_SAAS_MODE: '1', SAAS_CONVERSATION_CATALOG_SHADOW: '1' },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`backfill exit ${code}`));
    });
  });
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.fill('input[name="username"], input[autocomplete="username"]', 'admin');
  await page.fill('input[name="password"], input[type="password"]', 'SAAS_ADMIN_PASSWORD');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/p\//, { timeout: 60_000 });
}

async function main() {
  await runBackfill();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page);
    await page.goto(`${BASE}/p/general`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2000);
    console.log('[ui-conversation-catalog-orphan] OK (backfill + sidebar load)');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[ui-conversation-catalog-orphan] FAIL:', error.message);
  process.exit(1);
});
