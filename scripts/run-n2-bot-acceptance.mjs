#!/usr/bin/env node
/**
 * PD-SAAS-FORK: N2 Bot β acceptance — --lean = L0+L1+L3; --full adds L2 live.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync, execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outDir = join(root, `artifacts/n2-bot-acceptance-${stamp}`);
mkdirSync(outDir, { recursive: true });

function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function run(id, cmd, extraEnv = {}) {
  const logFile = join(outDir, `${id.replace(/[^\w.-]+/g, '_')}.log`);
  const started = Date.now();
  const result = spawnSync(cmd, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 20 * 1024 * 1024,
  });
  const body = `${result.stdout || ''}\n${result.stderr || ''}`;
  writeFileSync(logFile, body);
  const pass = result.status === 0;
  return { id, pass, status: result.status, ms: Date.now() - started, logFile };
}

function grepThreeFlags() {
  const files = [
    'scripts/release/pack.mjs',
    'scripts/release/apply-cloud-perf-env.sh',
    'scripts/lib/devLauncherCore.mjs',
  ];
  const missing = [];
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    if (!text.includes('PILOTDECK_N2_BOT')) missing.push(rel);
    if (rel.includes('pack.mjs') && !/PILOTDECK_N2_BOT:\s*'off'/.test(text) && !/PILOTDECK_N2_BOT:\s*"off"/.test(text)) {
      missing.push(`${rel}#default-off`);
    }
  }
  return missing;
}

function grepPlatformN2BotOff() {
  const text = readFileSync(join(root, 'config/platform-features.json'), 'utf8');
  if (!/"n2Bot"\s*:\s*false/.test(text)) return ['config/platform-features.json#n2Bot-off'];
  return [];
}

const summary = {
  gitHead: gitHead(),
  flag: 'off|shadow (lean)',
  startedAt: new Date().toISOString(),
  leanPass: false,
  l0: 'fail',
  l1: 'fail',
  l2: full ? 'fail' : 'skipped',
  l3: 'fail',
  failures: [],
  stewardSdmRows: 0,
  liveWorkerSessions: [],
};

const l0 = [
  ['A-unit', 'npm run test:n2-bot:unit'],
  ['B-ops', 'npm run test:n2-bot:ops'],
  ['S-schedule', 'npm run test:n2-bot:schedule'],
  ['W-isolation', 'npm run test:n2-bot:isolation'],
  ['K-copy', 'npm run test:n2-bot:copy-guard'],
  ['sdm', 'npm run test:sdm:unit'],
  ['continuation', 'npm run test:task-continuation-policy'],
  ['turn-queue', 'npm run test:turn-queue:unit'],
  ['beta-unit', 'npm run test:workbench-beta-11:unit'],
];

for (const [id, cmd] of l0) {
  const r = run(id, cmd);
  if (!r.pass) {
    summary.failures.push(id);
    summary.l0 = 'fail';
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.error(`[n2-bot-acceptance] FAIL ${id}`);
    process.exit(1);
  }
}
summary.l0 = 'pass';

const flagMissing = [...grepThreeFlags(), ...grepPlatformN2BotOff()];
const l1 = [
  ['fork', 'npm run check:saas-fork'],
  ['brand', 'npm run brand:check'],
  ['beta-flags', 'npm run test:workbench-beta-11:flags'],
];
if (flagMissing.length) {
  summary.failures.push('L1-flag-sync');
  summary.l1 = 'fail';
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify({ ...summary, flagMissing }, null, 2));
  console.error('[n2-bot-acceptance] FAIL L1-flag-sync', flagMissing);
  process.exit(1);
}
for (const [id, cmd] of l1) {
  const r = run(id, cmd);
  if (!r.pass) {
    summary.failures.push(id);
    summary.l1 = 'fail';
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.error(`[n2-bot-acceptance] FAIL ${id}`);
    process.exit(1);
  }
}
summary.l1 = 'pass';

if (full) {
  const live = run('L2-live', 'npm run test:n2-bot:live:gate');
  summary.l2 = live.pass ? 'passed' : 'fail';
  if (!live.pass) {
    summary.failures.push('L2-live');
    writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.error('[n2-bot-acceptance] FAIL L2-live');
    process.exit(1);
  }
} else {
  summary.l2 = 'skipped';
}

const pw = run('L3-playwright', 'npm run test:n2-bot:playwright', {
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081',
});
summary.l3 = pw.pass ? 'pass' : 'fail';
if (!pw.pass) {
  summary.failures.push('L3-playwright');
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.error('[n2-bot-acceptance] FAIL L3-playwright');
  process.exit(1);
}

summary.leanPass = summary.l0 === 'pass' && summary.l1 === 'pass' && summary.l3 === 'pass';
summary.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
const md = join(root, `docs/n2-bot-acceptance-${stamp}.zh-CN.md`);
writeFileSync(md, `# N2 Bot 验收 ${stamp}\n\n- gitHead: \`${summary.gitHead}\`\n- L0 ${summary.l0} / L1 ${summary.l1} / L2 ${summary.l2} / L3 ${summary.l3}\n- leanPass: ${summary.leanPass}\n- 不宣称生产 GO。pack 默认 off。\n`);
console.log(`[n2-bot-acceptance] leanPass=${summary.leanPass} dir=${outDir}`);
