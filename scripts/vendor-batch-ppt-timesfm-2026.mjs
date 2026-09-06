#!/usr/bin/env node
// PD-SAAS-FORK: vendor ppt-master + bump timesfm (official 2.5) + last30days
/** @see npm run vendor:batch-ppt-timesfm */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor');
const LOG = '[vendor-batch-ppt-timesfm]';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

function downloadRepoZip(owner, repo, ref) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${repo}-${Date.now()}`);
  const zipPath = path.join(tempBase, `${repo}.zip`);
  const extractDir = path.join(tempBase, 'extract');
  mkdirSync(extractDir, { recursive: true });
  const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${ref}`;
  run('curl', ['-fsSL', zipUrl, '-o', zipPath], REPO_ROOT);
  run(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`],
    REPO_ROOT,
  );
  const entries = readdirSync(extractDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (entries.length !== 1) {
    rmSync(tempBase, { recursive: true, force: true });
    throw new Error(`${owner}/${repo}: unexpected zip layout`);
  }
  const root = path.join(extractDir, entries[0].name);
  return {
    root,
    cleanup: () => rmSync(tempBase, { recursive: true, force: true }),
  };
}

function vendorOne({ owner, repo, ref, sourcePath, targetDir, label }) {
  const { root, cleanup } = downloadRepoZip(owner, repo, ref);
  const skillDir = path.join(root, sourcePath);
  if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
    cleanup();
    throw new Error(`${label}: missing SKILL.md at ${sourcePath}`);
  }
  copySkillDir(skillDir, targetDir);
  cleanup();
  return {
    label,
    repo: `https://github.com/${owner}/${repo}`,
    ref,
    sourcePath,
    targetDir: path.relative(REPO_ROOT, targetDir).replace(/\\/g, '/'),
  };
}

const results = [];

for (const spec of [
  { label: 'ppt-master', owner: 'hugohe3', repo: 'ppt-master', ref: 'main', sourcePath: 'skills/ppt-master', targetDir: path.join(VENDOR_ROOT, 'ppt-master') },
  { label: 'timesfm-official', owner: 'google-research', repo: 'timesfm', ref: 'master', sourcePath: 'timesfm-forecasting', targetDir: path.join(VENDOR_ROOT, 'education-ecosystem', 'edu-sci-timesfm-forecasting') },
  { label: 'last30days', owner: 'mvanhorn', repo: 'last30days-skill', ref: 'main', sourcePath: 'skills/last30days', targetDir: path.join(VENDOR_ROOT, 'marketing-ecosystem', 'mkt-last30days') },
]) {
  try {
    results.push(vendorOne(spec));
  } catch (e) {
    console.error(`${LOG} ${spec.label} FAILED: ${e.message || e}`);
    results.push({ label: spec.label, error: String(e.message || e) });
  }
}

const reportPath = path.join(REPO_ROOT, 'artifacts', 'capabilities-smoke', 'vendor-batch-ppt-timesfm.json');
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');

const ok = results.filter((r) => !r.error).length;
console.log(`${LOG} done ${ok}/${results.length} → ${reportPath}`);
for (const r of results) {
  if (r.error) console.log(`${LOG}   FAIL ${r.label}: ${r.error}`);
  else console.log(`${LOG}   OK ${r.label} → ${r.targetDir}`);
}
process.exit(ok === results.length ? 0 : 1);
