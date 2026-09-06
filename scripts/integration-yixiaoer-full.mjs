#!/usr/bin/env node
/**
 * Full read-only integration test for YiXiaoEr (蚁小二).
 * Loads API key from ~/.pilotdeck/pilotdeck.yaml via buildRuntimeEnv.
 * Does NOT publish or save drafts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildRuntimeEnv,
  readPilotDeckConfigFile,
} from '../ui/server/services/pilotdeckConfig.js';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'yixiaoer-smoke');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'full-report.json');
const WRAPPER = path.join(REPO_ROOT, 'scripts', 'yixiaoer-api.mjs');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');

function runNode(args, env) {
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    shell: false,
  });
}

function parseJsonOutput(text) {
  const trimmed = (text || '').trim();
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

function callAction(env, payload) {
  const payloadPath = path.join(ARTIFACT_DIR, `payload-${payload.action}.json`);
  writeFileSync(payloadPath, `${JSON.stringify(payload)}\n`, 'utf8');
  const result = runNode([WRAPPER, '--payload-file', payloadPath], env);
  const json = parseJsonOutput(result.stdout);
  return {
    status: result.status ?? 1,
    json,
    stderr: (result.stderr || '').slice(0, 300),
    stdout: (result.stdout || '').slice(0, 300),
  };
}

function pushCheck(report, id, ok, detail) {
  report.checks.push({ id, ok, detail });
}

function main() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    checks: [],
    passed: false,
  };

  const { config, configPath, exists } = readPilotDeckConfigFile();
  const runtimeEnv = { ...process.env, ...buildRuntimeEnv(config) };

  pushCheck(
    report,
    'config-file',
    Boolean(exists && configPath),
    exists ? configPath : 'missing pilotdeck.yaml',
  );

  const yamlKey = config?.tools?.yixiaoer?.apiKey?.trim();
  const envKey = runtimeEnv.YIXIAOER_API_KEY?.trim();
  pushCheck(
    report,
    'config-yixiaoer-key',
    Boolean(yamlKey || envKey),
    yamlKey
      ? 'tools.yixiaoer.apiKey present in yaml'
      : envKey
        ? 'YIXIAOER_API_KEY from env only'
        : 'no key in yaml or runtime env',
  );

  pushCheck(
    report,
    'runtime-env-injection',
    Boolean(envKey),
    envKey ? 'YIXIAOER_API_KEY injected (value redacted)' : 'buildRuntimeEnv did not set YIXIAOER_API_KEY',
  );

  if (!envKey) {
    report.passed = false;
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  try {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
    const entry = (catalog.skills || []).find((s) => s.slug === 'yixiaoer');
    pushCheck(
      report,
      'capabilities-catalog',
      Boolean(entry && entry.integration_level === 'L2'),
      entry
        ? `stage=${entry.stage}, integration_level=${entry.integration_level}`
        : 'yixiaoer missing from capabilities.catalog.json',
    );
  } catch (error) {
    pushCheck(
      report,
      'capabilities-catalog',
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  const readOnlyActions = [
    { action: 'accounts', page: 1, size: 5 },
    { action: 'records', page: 1, size: 5 },
    { action: 'proxies' },
    { action: 'proxy-areas' },
    { action: 'syncapps' },
  ];

  let firstAccountId = null;
  for (const payload of readOnlyActions) {
    const run = callAction(runtimeEnv, payload);
    const ok = run.status === 0 && run.json?.success === true;
    if (payload.action === 'accounts' && ok) {
      const data = run.json?.data ?? {};
      const items =
        (Array.isArray(data) ? data : null) ??
        data.items ??
        data.list ??
        data.records ??
        data.content ??
        [];
      if (Array.isArray(items) && items.length > 0) {
        firstAccountId =
          items[0]?.platformAccountId ??
          items[0]?.id ??
          items[0]?.account_id ??
          null;
      }
    }
    const isOptionalUpstream =
      payload.action === 'syncapps'
      && !ok
      && /500|Internal server error/i.test(
        String(run.json?.details || run.json?.message || run.stderr || ''),
      );
    pushCheck(
      report,
      `api-${payload.action}`,
      ok || isOptionalUpstream,
      ok
        ? `success action=${run.json?.action ?? payload.action}`
        : isOptionalUpstream
          ? 'upstream HTTP 500 (optional — account may lack sync apps)'
          : (run.json?.message || run.stderr || run.stdout || 'failed').slice(0, 200),
    );
  }

  if (firstAccountId) {
    const accountScoped = [
      { action: 'categories', account_id: firstAccountId, type: 'image-text' },
      { action: 'account-overviews', account_id: firstAccountId, page: 1, size: 5 },
    ];
    for (const payload of accountScoped) {
      const run = callAction(runtimeEnv, payload);
      const ok = run.status === 0 && run.json?.success === true;
      pushCheck(
        report,
        `api-${payload.action}`,
        ok,
        ok
          ? `account=${String(firstAccountId).slice(0, 8)}…`
          : (run.json?.message || run.stderr || 'failed').slice(0, 200),
      );
    }
  } else {
    pushCheck(
      report,
      'api-categories',
      true,
      'skipped — no bound accounts (bind platforms in YiXiaoEr web UI first)',
    );
    pushCheck(
      report,
      'api-account-overviews',
      true,
      'skipped — no bound accounts',
    );
  }

  const missingKeyRun = callAction(
    { ...runtimeEnv, YIXIAOER_API_KEY: '' },
    { action: 'accounts', page: 1, size: 1 },
  );
  const missingKeyJson = parseJsonOutput(missingKeyRun.stderr || missingKeyRun.stdout);
  pushCheck(
    report,
    'wrapper-auth-guard',
    missingKeyRun.status !== 0 && missingKeyJson?.errorCode === 'YIXIAOER_AUTH_ERR',
    missingKeyJson?.errorCode ?? 'expected YIXIAOER_AUTH_ERR',
  );

  report.passed = report.checks.every((c) => c.ok);
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}

main();
