#!/usr/bin/env node
// PD-SAAS-FORK: vendor 9 video planning skills for creation create_video hub
/** @see npm run vendor:video-planning */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'creation-ecosystem');
const LOG = '[vendor-video-planning]';

function run(command, args, cwd = REPO_ROOT) {
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

function findSkillRoot(baseDir, preferredPaths = [], label = '') {
  for (const rel of preferredPaths) {
    const candidate = path.join(baseDir, rel);
    if (existsSync(path.join(candidate, 'SKILL.md'))) return candidate;
    const nested = path.join(candidate, path.basename(candidate), 'SKILL.md');
    if (existsSync(nested)) return path.dirname(nested);
  }
  if (preferredPaths.length > 0) {
    return null;
  }
  const direct = path.join(baseDir, 'SKILL.md');
  if (existsSync(direct)) return baseDir;
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (existsSync(path.join(current, 'SKILL.md'))) return current;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return null;
}

function downloadRepoZip(owner, repo, ref) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${repo}-${Date.now()}`);
  const zipPath = path.join(tempBase, `${repo}.zip`);
  const extractDir = path.join(tempBase, 'extract');
  mkdirSync(extractDir, { recursive: true });
  const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${ref}`;
  run('curl', ['-fsSL', zipUrl, '-o', zipPath]);
  run(
    'powershell',
    ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`],
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

function cloneRepo(owner, repo, ref) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${repo}-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  run('git', ['clone', '--depth', '1', '--branch', ref, `https://github.com/${owner}/${repo}.git`, tempBase]);
  return {
    root: tempBase,
    cleanup: () => rmSync(tempBase, { recursive: true, force: true }),
  };
}

function fetchRepo(owner, repo, ref) {
  try {
    return downloadRepoZip(owner, repo, ref);
  } catch (zipErr) {
    console.warn(`${LOG} zip failed for ${owner}/${repo}, trying git clone: ${zipErr.message}`);
    return cloneRepo(owner, repo, ref);
  }
}

function vendorOne({ owner, repo, ref, sourcePaths, targetDir, label }) {
  const { root, cleanup } = fetchRepo(owner, repo, ref);
  const skillDir = findSkillRoot(root, sourcePaths, label);
  if (!skillDir) {
    cleanup();
    throw new Error(`${label}: missing SKILL.md (tried ${sourcePaths.join(', ')})`);
  }
  copySkillDir(skillDir, targetDir);
  cleanup();
  return {
    label,
    repo: `https://github.com/${owner}/${repo}`,
    ref,
    sourcePath: path.relative(root, skillDir).replace(/\\/g, '/'),
    targetDir: path.relative(REPO_ROOT, targetDir).replace(/\\/g, '/'),
  };
}

const SPECS = [
  {
    label: 'create-vid-scriptwriting',
    owner: 'mkurman',
    repo: 'zorai',
    ref: 'main',
    sourcePaths: ['skills/nontechnical/absolutelyskilled/video-scriptwriting'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-scriptwriting'),
  },
  {
    label: 'create-vid-saas-demo-script',
    owner: 'changxiyue1992-lang',
    repo: 'ai-saas-demo-script-skill',
    ref: 'main',
    sourcePaths: ['ai-saas-demo-script'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-saas-demo-script'),
  },
  {
    label: 'create-vid-seedance-prompt',
    owner: 'dexhunter',
    repo: 'seedance2-skill',
    ref: 'main',
    sourcePaths: ['.'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-seedance-prompt'),
  },
  {
    label: 'create-vid-seedance-codec',
    owner: 'MapleShaw',
    repo: 'seedance2.0-prompt-skill',
    ref: 'main',
    sourcePaths: ['.'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-seedance-codec'),
  },
  {
    label: 'create-vid-visual-prompt',
    owner: 'smixs',
    repo: 'visual-skills',
    ref: 'main',
    sourcePaths: ['video', 'skills/video'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-visual-prompt'),
  },
  {
    label: 'create-vid-director',
    owner: 'wuwangzhang1216',
    repo: 'DirectorSKILL',
    ref: 'main',
    sourcePaths: ['DirectorSKILL', '.'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-director'),
  },
  {
    label: 'create-vid-storyboard-pack',
    owner: 'TateZhouSiu',
    repo: 'create-storyboard-skill',
    ref: 'main',
    sourcePaths: ['skills/create-storyboard', 'create-storyboard'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-storyboard-pack'),
  },
  {
    label: 'create-vid-seedance-series',
    owner: 'liangdabiao',
    repo: 'Seedance2-Storyboard-Generator',
    ref: 'main',
    sourcePaths: ['.claude/skills/seedance-storyboard-generator', 'seedance-storyboard-generator'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-seedance-series'),
  },
  {
    label: 'create-vid-viral-copy',
    owner: 'anbeime',
    repo: 'skill',
    ref: 'main',
    sourcePaths: ['skills/viral-video-copywriting/viral-video-copywriting', 'skills/viral-video-copywriting'],
    targetDir: path.join(VENDOR_ROOT, 'create-vid-viral-copy'),
  },
];

const results = [];
for (const spec of SPECS) {
  try {
    results.push(vendorOne(spec));
  } catch (e) {
    console.error(`${LOG} ${spec.label} FAILED: ${e.message || e}`);
    results.push({ label: spec.label, error: String(e.message || e) });
  }
}

const reportPath = path.join(REPO_ROOT, 'artifacts', 'capabilities-smoke', 'vendor-video-planning.json');
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, 'utf8');

const ok = results.filter((r) => !r.error).length;
console.log(`${LOG} done ${ok}/${results.length} → ${reportPath}`);
for (const r of results) {
  if (r.error) console.log(`${LOG}   FAIL ${r.label}: ${r.error}`);
  else console.log(`${LOG}   OK ${r.label} → ${r.targetDir}`);
}
process.exit(ok === results.length ? 0 : 1);
