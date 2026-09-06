#!/usr/bin/env node
/**
 * §9.9 双模式不变量探测（静态 / 无 dev 服）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`[saas-invariants] FAIL: ${message}`);
  process.exit(1);
}

const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`[saas-invariants] ${ok ? 'OK' : 'FAIL'} ${id}: ${detail}`);
  if (!ok) fail(`${id}: ${detail}`);
}

async function main() {
  // INV-SAAS-01
  process.env.PILOTDECK_SAAS_MODE = '1';
  const { isSaasMode } = await import('../ui/server/saas/mode.js');
  record('INV-SAAS-01', isSaasMode(), 'PILOTDECK_SAAS_MODE enables isSaasMode()');

  delete process.env.PILOTDECK_SAAS_MODE;
  record('INV-OSS-01', !isSaasMode(), 'without SAAS_MODE, isSaasMode() is false');

  // INV-SAAS-03 / INV-OSS-02 catalog + skills
  const catalogPath = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
  const catalogRaw = fs.readFileSync(catalogPath, 'utf8');
  const slugMatches = catalogRaw.match(/"slug"\s*:/g);
  const capCount = slugMatches ? slugMatches.length : 0;
  record('INV-OSS-02', capCount >= 80, `capabilities.catalog.json slug entries=${capCount}`);

  const { getLegacyPilotHome } = await import('../ui/server/saas/legacyBridge.js');
  const skillsDir = path.join(getLegacyPilotHome(), 'skills');
  const skillDirs = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length
    : 0;
  record('INV-SAAS-03', skillDirs >= 50, `legacy skills dirs=${skillDirs}`);

  // INV-FORK-01 / INV-BRAND-01 delegated to npm scripts (caller runs check:saas-fork + brand:check)

  console.log('[saas-invariants] all static invariants OK', results.length);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
