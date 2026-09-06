#!/usr/bin/env node
/**
 * PD-SAAS-FORK: task-stall RCA orchestrator — HTML parse, session resolve, stress matrix.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'task-stall-rca');
const SESSIONS_CONFIG = path.join(REPO_ROOT, 'config', 'sessions', 'task-stall-8.json');

const args = process.argv.slice(2);
const gate = args.includes('--gate');
const parseOnly = args.includes('--parse-only');
const checkSessions = args.includes('--check-sessions');
const live = args.includes('--live');
const stress = args.includes('--stress');
const memory = args.includes('--memory');
const runAll = args.includes('--all');

const htmlDirArg = args.find((a) => a.startsWith('--html-dir='))?.split('=').slice(1).join('=')
  ?? path.join(os.homedir(), 'Downloads');

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function loadSessionsConfig() {
  const raw = fs.readFileSync(SESSIONS_CONFIG, 'utf8');
  return JSON.parse(raw);
}

function fail(msg) {
  console.error(`[task-stall-rca] FAIL: ${msg}`);
  if (gate) process.exit(1);
  return false;
}

function pass(msg) {
  console.log(`[task-stall-rca] OK: ${msg}`);
  return true;
}

function runStep(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    stdio: opts.quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  return result.status === 0;
}

async function runParseOnly() {
  ensureOutDir();
  const { parseExportHtmlFourLine } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'scripts/lib/parseExportHtmlFourLine.mjs')).href
  );
  const config = loadSessionsConfig();
  const htmlFiles = fs.existsSync(htmlDirArg)
    ? fs.readdirSync(htmlDirArg).filter((f) => f.endsWith('.html'))
    : [];

  const results = [];
  for (const session of config.sessions) {
    const match = htmlFiles.find((f) => f.includes(session.shortId));
    if (!match) {
      results.push({ sessionId: session.id, shortId: session.shortId, error: 'html_not_found' });
      continue;
    }
    const html = fs.readFileSync(path.join(htmlDirArg, match), 'utf8');
    const parsed = parseExportHtmlFourLine(html);
    results.push({
      sessionId: session.id,
      shortId: session.shortId,
      title: session.title,
      archetype: session.archetype,
      projectName: parsed.manifest?.projectName,
      messageCount: parsed.manifest?.messageCount,
      scopeDir: parsed.fourLineDebug?.scopeDir ?? '',
      deliverableRows: parsed.snapshotCompleteness?.deliverableRowCount ?? 0,
      statuses: (parsed.deliverableTable?.rows ?? []).map((r) => r.statusLabel).join('/'),
      kpis: parsed.kpis,
    });
  }

  const outPath = path.join(OUT_DIR, 'case-kpi.json');
  fs.writeFileSync(outPath, JSON.stringify({ exportedAt: new Date().toISOString(), htmlDir: htmlDirArg, results }, null, 2));
  const found = results.filter((r) => !r.error).length;
  console.log(`[task-stall-rca] wrote ${outPath} (${found}/${config.sessions.length} HTML matched)`);
  if (gate && found < 6) {
    fail(`HTML parse matched ${found}/8, need >=6`);
    return false;
  }
  return pass(`parse-only ${found}/8`);
}

function resolveSessionJsonl(sessionId, dataRoots) {
  const normalized = sessionId.replace(/^web:s_/, 'web-s_');
  for (const root of dataRoots) {
    if (!root || !fs.existsSync(root)) continue;
    const hits = [];
    const walk = (dir, depth = 0) => {
      if (depth > 8) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(full, depth + 1);
        } else if (ent.name.includes(normalized) && ent.name.endsWith('.jsonl')) {
          hits.push(full);
        }
      }
    };
    walk(root);
    if (hits.length > 0) return hits[0];
  }
  return null;
}

function runCheckSessions() {
  ensureOutDir();
  const config = loadSessionsConfig();
  const dataRoot = process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data');
  const pilotHome = process.env.PILOTDECK_PILOT_HOME || path.join(os.homedir(), '.pilotdeck');
  const roots = [
    path.join(dataRoot, 'saas', 'tenants'),
    path.join(dataRoot, 'tenants'),
    path.join(pilotHome, 'projects'),
  ];

  const resolved = config.sessions.map((session) => {
    const jsonl = resolveSessionJsonl(session.id, roots);
    return {
      sessionId: session.id,
      shortId: session.shortId,
      resolved: Boolean(jsonl),
      jsonlPath: jsonl ?? null,
    };
  });

  const outPath = path.join(OUT_DIR, 'session-resolve.json');
  fs.writeFileSync(outPath, JSON.stringify({ resolved, checkedAt: new Date().toISOString() }, null, 2));
  const count = resolved.filter((r) => r.resolved).length;
  console.log(`[task-stall-rca] session resolve ${count}/8 → ${outPath}`);
  if (gate && count < 6) {
    fail(`session resolve ${count}/8, need >=6`);
    return false;
  }
  return pass(`check-sessions ${count}/8`);
}

function runPreflightLog() {
  ensureOutDir();
  const ports = [8081, 7990, 18789];
  const portResults = ports.map((port) => {
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', `(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1).State`],
      { encoding: 'utf8', shell: true },
    );
    return { port, state: (r.stdout || '').trim() || 'closed' };
  });
  const gitStatus = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const gitLines = (gitStatus.stdout || '').trim().split('\n').filter(Boolean);
  const log = {
    at: new Date().toISOString(),
    ports: portResults,
    git: {
      dirtyFileCount: gitLines.length,
      sample: gitLines.slice(0, 20),
    },
    sessionsConfig: fs.existsSync(SESSIONS_CONFIG),
    dataRoot: process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data'),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'preflight.log'), JSON.stringify(log, null, 2));
  console.log(`[task-stall-rca] preflight ports: ${portResults.map((p) => `${p.port}=${p.state}`).join(', ')}`);
  return pass('preflight.log written');
}

function runStress() {
  ensureOutDir();
  const steps = [
    ['npm', ['run', 'test:bridge-stability:stress']],
    ['npm', ['run', 'test:dialogue-stability:adversarial']],
  ];
  if (memory) {
    steps.push(['npm', ['run', 'test:memory-leak:audit']]);
  }
  const results = [];
  for (const [cmd, cmdArgs] of steps) {
    const ok = runStep(cmd, cmdArgs);
    results.push({ cmd: `${cmd} ${cmdArgs.join(' ')}`, ok });
    if (!ok && gate) {
      fs.writeFileSync(path.join(OUT_DIR, 'stress-summary.json'), JSON.stringify({ ok: false, results }, null, 2));
      fail(`stress step failed: ${cmd}`);
      return false;
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'stress-summary.json'), JSON.stringify({ ok: true, results }, null, 2));
  return pass('stress matrix');
}

function runLive() {
  console.log('[task-stall-rca] live: run Playwright task-stall-regression when dev:saas is up');
  const ok = runStep('npx', [
    'playwright', 'test', '-c', 'ui/playwright.config.ts',
    'ui/e2e/saas/task-stall-regression.spec.ts',
    '--workers=1',
  ]);
  if (gate && !ok) fail('live playwright failed');
  return ok ? pass('live playwright') : false;
}

async function main() {
  const results = [];
  if (runAll || (!parseOnly && !checkSessions && !live && !stress)) {
    results.push(runPreflightLog());
    results.push(await runParseOnly());
    results.push(runCheckSessions());
  }
  if (parseOnly || runAll) results.push(await runParseOnly());
  if (checkSessions || runAll) results.push(runCheckSessions());
  if (stress || runAll) results.push(runStress());
  if (live) results.push(runLive());

  const failed = results.filter((r) => r === false).length;
  if (gate && failed > 0) process.exit(1);
  console.log('[task-stall-rca] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
