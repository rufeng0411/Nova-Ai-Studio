#!/usr/bin/env node
/**
 * Smoke test for YiXiaoEr (蚁小二) integration.
 * Read-only by default: accounts list. Does NOT publish public posts.
 *
 * Usage:
 *   YIXIAOER_API_KEY=... node scripts/integration-yixiaoer-smoke.mjs
 *   node scripts/integration-yixiaoer-smoke.mjs --check-wrapper
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildRuntimeEnv, readPilotDeckConfigFile } from '../ui/server/services/pilotdeckConfig.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'yixiaoer-smoke');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'report.json');
const SKILL_DIR = path.join(REPO_ROOT, 'skills', 'yixiaoer');
const WRAPPER = path.join(REPO_ROOT, 'scripts', 'yixiaoer-api.mjs');
const MANIFEST = path.join(REPO_ROOT, 'config', 'yixiaoer-sync.manifest.json');

const checkWrapperOnly = process.argv.includes('--check-wrapper');

function runNode(args, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    shell: false,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function parseJsonOutput(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  if (!process.env.YIXIAOER_API_KEY?.trim()) {
    const { config } = readPilotDeckConfigFile();
    Object.assign(process.env, buildRuntimeEnv(config));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    checks: [],
    passed: false,
  };

  const skillOk = existsSync(path.join(SKILL_DIR, 'SKILL.md'))
    && existsSync(path.join(SKILL_DIR, 'scripts', 'api.ts'));
  report.checks.push({
    id: 'skill-files',
    ok: skillOk,
    detail: skillOk ? 'skills/yixiaoer present' : 'missing skills/yixiaoer',
  });

  const manifestOk = existsSync(MANIFEST);
  report.checks.push({
    id: 'sync-manifest',
    ok: manifestOk,
    detail: manifestOk ? 'config/yixiaoer-sync.manifest.json' : 'manifest missing',
  });

  const wrapperOk = existsSync(WRAPPER);
  report.checks.push({
    id: 'api-wrapper',
    ok: wrapperOk,
    detail: wrapperOk ? 'scripts/yixiaoer-api.mjs' : 'wrapper missing',
  });

  if (!process.env.YIXIAOER_API_KEY?.trim()) {
    report.checks.push({
      id: 'api-key',
      ok: false,
      detail: 'YIXIAOER_API_KEY not set — configure tools.yixiaoer.apiKey in settings',
    });
    report.passed = report.checks.every((c) => c.id === 'api-key' ? true : c.ok) && false;
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error('[yixiaoer-smoke] Missing YIXIAOER_API_KEY');
    process.exit(1);
  }

  if (checkWrapperOnly) {
    report.passed = report.checks.every((c) => c.ok);
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.passed ? 0 : 1);
  }

  const payloadPath = path.join(ARTIFACT_DIR, 'accounts-payload.json');
  writeFileSync(payloadPath, `${JSON.stringify({ action: 'accounts', page: 1, size: 5 })}\n`, 'utf8');

  const accountsRun = runNode([WRAPPER, '--payload-file', payloadPath]);
  const accountsJson = parseJsonOutput(accountsRun.stdout);
  const accountsOk = accountsRun.status === 0 && accountsJson?.success === true;

  report.checks.push({
    id: 'accounts',
    ok: accountsOk,
    detail: accountsOk
      ? `action=${accountsJson?.action ?? 'accounts'}`
      : (accountsJson?.message || accountsRun.stderr || accountsRun.stdout || 'accounts failed').slice(0, 500),
  });

  report.passed = report.checks.every((c) => c.ok);
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}

main();
