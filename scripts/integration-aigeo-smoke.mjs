#!/usr/bin/env node
/**
 * Smoke: pd-geo skill + aigeo-cli score/verify (quick / agent_web_search paths).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const SKILL_MD = path.join(REPO_ROOT, 'skills', 'pd-geo', 'SKILL.md');
const RESILIENCE = path.join(REPO_ROOT, 'skills', 'pd-geo', 'references', 'resilience.md');
const MANIFEST = path.join(REPO_ROOT, 'config', 'aigeo-sync.manifest.json');
const WRAPPER = path.join(REPO_ROOT, 'scripts', 'aigeo-api.mjs');
const CLI = path.join(REPO_ROOT, 'scripts', 'aigeo-cli.py');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'aigeo-smoke');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'report.json');
const SAMPLE = path.join(ARTIFACT_DIR, 'sample.md');

const checkWrapperOnly = process.argv.includes('--check-wrapper');

function fail(message) {
  console.error(`[aigeo-smoke] FAIL: ${message}`);
  process.exit(1);
}

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function runPython(payload) {
  const payloadPath = path.join(ARTIFACT_DIR, 'payload.json');
  writeFileSync(payloadPath, JSON.stringify(payload), 'utf8');
  const py = process.platform === 'win32' ? 'python' : 'python3';
  return spawnSync(py, [CLI, '--payload-file', payloadPath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

const report = { ok: true, checks: [] };

function check(name, pass, detail) {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
}

if (!existsSync(SKILL_MD)) fail(`missing ${SKILL_MD}`);
if (!existsSync(RESILIENCE)) fail(`missing ${RESILIENCE}`);
if (!existsSync(MANIFEST)) fail(`missing ${MANIFEST}`);

check('skill_md', existsSync(SKILL_MD), SKILL_MD);
check('resilience', existsSync(RESILIENCE), RESILIENCE);
check('manifest', existsSync(MANIFEST), MANIFEST);
check('wrapper', existsSync(WRAPPER), WRAPPER);
check('cli', existsSync(CLI), CLI);

if (checkWrapperOnly) {
  console.log('[aigeo-smoke] OK wrapper check');
  process.exit(0);
}

mkdirSync(ARTIFACT_DIR, { recursive: true });
writeFileSync(
  SAMPLE,
  `# 示例品牌\n\n## FAQ\n\n常见问题：如何选择？\n\n示例品牌 适合中小企业。示例品牌 提供可靠服务。\n`,
  'utf8',
);

const scoreRun = runPython({
  action: 'score',
  brand: '示例品牌',
  platform: '知乎',
  content_path: SAMPLE,
});
let scoreJson = null;
try {
  scoreJson = JSON.parse((scoreRun.stdout || '').trim());
} catch {
  scoreJson = null;
}
check(
  'score_quick',
  scoreRun.status === 0 && scoreJson?.ok === true && scoreJson?.scoring_mode === 'quick',
  scoreRun.stderr || scoreRun.stdout,
);

const verifyRun = runPython({
  action: 'verify',
  brand: '示例品牌',
  queries: ['最好的示例软件是什么'],
});
let verifyJson = null;
try {
  verifyJson = JSON.parse((verifyRun.stdout || '').trim());
} catch {
  verifyJson = null;
}
check(
  'verify_agent_web_search',
  verifyRun.status === 0 &&
    verifyJson?.ok === true &&
    verifyJson?.data?.verification_mode === 'agent_web_search' &&
    verifyJson?.data?.is_mock === false,
  verifyRun.stderr || verifyRun.stdout,
);

const wrapperRun = runNode([
  WRAPPER,
  '--payload',
  JSON.stringify({ action: 'keywords', brand: 'Demo', advantages: 'fast' }),
]);
let kwJson = null;
try {
  kwJson = JSON.parse((wrapperRun.stdout || '').trim());
} catch {
  kwJson = null;
}
check('wrapper_keywords', wrapperRun.status === 0 && kwJson?.ok === true, wrapperRun.stderr || wrapperRun.stdout);

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  fail('one or more checks failed');
}

console.log(`[aigeo-smoke] OK report=${REPORT_PATH}`);
