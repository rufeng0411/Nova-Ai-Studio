#!/usr/bin/env node
// PD-SAAS-FORK: vendor hugohe3/ppt-master at pinned SHA (no timesfm / last30days)
/** @see npm run vendor:ppt-master */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applySkillOverlays } from './lib/skillVendorOverlays/applySkillOverlays.mjs';
import { patchSkillMdName } from './lib/vendorSkillPackCore.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_DIR = path.join(REPO_ROOT, 'skills', 'vendor', 'ppt-master');
const PIN_SHA = 'a160e776b7faff5d2227d180d0f31c6253056fae';
const ZIP_URL = `https://codeload.github.com/hugohe3/ppt-master/zip/${PIN_SHA}`;
const SOURCE_PATH = 'skills/ppt-master';
const SKIP_NAMES = new Set(['.git', 'node_modules', 'tests', 'test', '__pycache__']);
const LOG = '[vendor-ppt-master]';
const REQUIRED_REL = [
  'LICENSE',
  'SPONSORS.md',
  'SPONSORS_CN.md',
  'scripts/attribution_guard.py',
  'workflows/routing.md',
  'scripts/confirm_ui/static/catalogs.json',
];
const GUARD_MARKER = 'python3 "${SKILL_DIR}/scripts/attribution_guard.py"';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: process.platform === 'win32' && command === 'npm',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function dirSizeBytes(dir) {
  let total = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        try {
          total += statSync(full).size;
        } catch {
          /* ignore */
        }
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return total;
}

function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

function downloadPinnedZip() {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-ppt-master-${Date.now()}`);
  const zipPath = path.join(tempBase, 'ppt-master.zip');
  const extractDir = path.join(tempBase, 'extract');
  mkdirSync(extractDir, { recursive: true });
  run('curl', ['-fsSL', ZIP_URL, '-o', zipPath], REPO_ROOT);
  const zipEsc = zipPath.replace(/'/g, "''");
  const destEsc = extractDir.replace(/'/g, "''");
  run(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipEsc}' -DestinationPath '${destEsc}' -Force`],
    REPO_ROOT,
  );
  const entries = readdirSync(extractDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (entries.length !== 1) {
    rmSync(tempBase, { recursive: true, force: true });
    throw new Error('ppt-master: unexpected zip layout');
  }
  return {
    root: path.join(extractDir, entries[0].name),
    cleanup: () => rmSync(tempBase, { recursive: true, force: true }),
  };
}

function runAttributionGuard() {
  const script = path.join(TARGET_DIR, 'scripts', 'attribution_guard.py');
  for (const bin of ['python', 'python3']) {
    const result = spawnSync(bin, [script], {
      cwd: TARGET_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error && result.error.code === 'ENOENT') continue;
    if (result.status !== 0) {
      throw new Error(
        `attribution_guard.py exit ${result.status}: ${(result.stderr || result.stdout || '').trim()}`,
      );
    }
    return bin;
  }
  throw new Error('python/python3 not found for attribution_guard.py');
}

function main() {
  const beforeBytes = dirSizeBytes(TARGET_DIR);
  const stashLaunch = existsSync(path.join(TARGET_DIR, 'launch.profile.json'))
    ? readFileSync(path.join(TARGET_DIR, 'launch.profile.json'))
    : null;

  const { root, cleanup } = downloadPinnedZip();
  try {
    const skillDir = path.join(root, SOURCE_PATH);
    if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
      throw new Error(`missing SKILL.md at ${SOURCE_PATH}`);
    }
    copySkillDir(skillDir, TARGET_DIR);
  } finally {
    cleanup();
  }

  if (stashLaunch) {
    writeFileSync(path.join(TARGET_DIR, 'launch.profile.json'), stashLaunch);
  }

  writeFileSync(
    path.join(TARGET_DIR, 'ATTRIBUTION.md'),
    [
      '# ppt-master',
      '',
      'Vendored from [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) (MIT).',
      '',
      `- Commit: ${PIN_SHA}`,
      `- Vendored at: ${new Date().toISOString()}`,
      '- Pin via codeload zip SHA (not a floating main branch).',
      '',
      'Nova Ai-Studio integration: `skills/vendor/ppt-master/` · Hub slug `ppt-master`.',
      '',
    ].join('\n'),
    'utf8',
  );

  patchSkillMdName(TARGET_DIR, 'ppt-master');

  const overlay = applySkillOverlays(['ppt-master']);
  if (overlay.missing.length) {
    console.error(`${LOG} overlay missing: ${overlay.missing.join(', ')}`);
    process.exit(1);
  }

  for (const rel of REQUIRED_REL) {
    if (!existsSync(path.join(TARGET_DIR, rel))) {
      throw new Error(`missing required file ${rel}`);
    }
  }

  const skillText = readFileSync(path.join(TARGET_DIR, 'SKILL.md'), 'utf8');
  const guardCount = skillText.split(GUARD_MARKER).length - 1;
  if (guardCount !== 1) {
    throw new Error(`attribution_guard marker count=${guardCount}, expected 1`);
  }
  if (skillText.includes('refs/heads/main') && skillText.includes('codeload')) {
    /* ignore skill body */
  }

  const guardBin = runAttributionGuard();
  const afterBytes = dirSizeBytes(TARGET_DIR);
  console.log(
    `${LOG} done sha=${PIN_SHA.slice(0, 7)} size ${beforeBytes} → ${afterBytes} bytes guard=${guardBin}`,
  );
}

main();
