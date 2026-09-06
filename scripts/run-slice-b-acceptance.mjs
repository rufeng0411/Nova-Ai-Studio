#!/usr/bin/env node
// PD-SAAS-FORK: Slice B strict acceptance L0–L2 hard gate; L3 skipped if Bridge down
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'skills-acceptance');
const REPORT_PATH = path.join(REPORT_DIR, 'slice-b.json');

function runStep(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return {
    name,
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 1,
  };
}

function assertI18n() {
  const i18n = JSON.parse(readFileSync(path.join(REPO_ROOT, 'config/capabilities.i18n.json'), 'utf8'));
  const name = i18n.skills?.['ppt-master']?.['zh-CN']?.display_name;
  return name === '原生可编辑 PPT';
}

async function probeL3() {
  const url = process.env.SLICE_B_HEALTH_URL || 'http://127.0.0.1:7990/api/saas/health/ready';
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    return { attempted: true, ok: res.ok, status: res.status };
  } catch (err) {
    return { attempted: true, ok: false, skipped: true, reason: String(err?.message || err) };
  }
}

async function main() {
  const steps = [];
  steps.push(runStep('L0 nova-fit G3', 'node', ['scripts/skills-nova-fit-check.mjs', '--batch', 'G3']));
  steps.push(runStep('L0 smoke:ppt-master', 'npm', ['run', 'smoke:ppt-master']));
  steps.push(runStep('L1 audit overlays', 'npm', ['run', 'audit:skill-overlays']));
  steps.push(runStep('L1 capabilities:gen', 'npm', ['run', 'capabilities:gen']));
  const i18nOk = assertI18n();
  steps.push(runStep('L2 preflight catalog gen', 'npm', ['run', 'preflight:catalog:gen']));
  steps.push(runStep('L2 preflight studio unit', 'npm', ['run', 'test:preflight-studio:unit']));
  steps.push(runStep('L2 launch:audit', 'npm', ['run', 'launch:audit']));
  steps.push(runStep('L2 smoke:ppt-master', 'npm', ['run', 'smoke:ppt-master']));
  steps.push(runStep('L2 smoke:ppt-timesfm-batch', 'npm', ['run', 'smoke:ppt-timesfm-batch']));
  steps.push(runStep('L2 binding tests', 'npx', ['tsx', '--test', 'src/saas/capabilityBindingPrompt.test.ts']));
  steps.push(runStep('L2 ppt-master SDM profile', 'npx', ['vitest', 'run', 'tests/saas/deliverable-capability-profiles.test.ts']));

  const l3 = await probeL3();
  const backupDir = path.join(REPO_ROOT, 'artifacts/skills-backup');
  const backups = existsSync(backupDir)
    ? readdirSync(backupDir).filter((n) => n.startsWith('pre-ppt-master-4.8.0-') && n.endsWith('.tar.gz'))
    : [];
  const assertions = [
    { name: 'i18n ppt-master display_name', ok: i18nOk },
    { name: 'backup tarball exists', ok: backups.length > 0 },
  ];

  const l0l2Ok = steps.every((s) => s.exitCode === 0) && assertions.every((a) => a.ok);
  const report = {
    ok: l0l2Ok,
    l0l2: l0l2Ok,
    l3: l3.ok ? 'pass' : 'skipped',
    generatedAt: new Date().toISOString(),
    steps,
    assertions,
    l3Probe: l3,
  };
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[slice-b-acceptance] l0l2=${l0l2Ok} l3=${report.l3} → ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  if (!l0l2Ok) {
    for (const s of steps.filter((x) => x.exitCode !== 0)) {
      console.error(`  step fail: ${s.name} exit=${s.exitCode}`);
    }
    for (const a of assertions.filter((x) => !x.ok)) {
      console.error(`  assert fail: ${a.name}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
