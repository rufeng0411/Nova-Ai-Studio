#!/usr/bin/env node
// PD-SAAS-FORK: html-ppt-skill vendor (single integrated skill, not split)
/**
 * Vendor lewislulu/html-ppt-skill as one Hub card slug `html-ppt`.
 * Env: HTML_PPT_SKILL_LOCAL_DIR=<existing clone path>
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureLaunchRegistrySeed } from './lib/launchRegistry.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/lewislulu/html-ppt-skill.git';
const TARGET_DIR = path.join(REPO_ROOT, 'skills', 'vendor', 'html-ppt');
const VENDORED_SLUG = 'html-ppt';

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function copyRepo(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

function patchSkillMd(skillDir) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return;
  let content = readFileSync(skillMd, 'utf8');
  content = content.replace(/^name:\s*.+$/m, `name: ${VENDORED_SLUG}`);
  writeFileSync(skillMd, content, 'utf8');
}

function resolveCloneDir() {
  const localDir = process.env.HTML_PPT_SKILL_LOCAL_DIR;
  if (localDir && existsSync(localDir)) {
    const commit = run('git', ['rev-parse', 'HEAD'], localDir);
    return { cloneDir: localDir, commit, cleanup: null };
  }
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-html-ppt-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  run('git', ['clone', '--depth', '1', REPO, cloneDir], REPO_ROOT, { GIT_LFS_SKIP_SMUDGE: '1' });
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  return {
    cloneDir,
    commit,
    cleanup: () => rmSync(tempBase, { recursive: true, force: true }),
  };
}

function main() {
  console.log('[vendor-html-ppt] cloning upstream…');
  const { cloneDir, commit, cleanup } = resolveCloneDir();
  copyRepo(cloneDir, TARGET_DIR);
  patchSkillMd(TARGET_DIR);
  cleanup?.();

  writeFileSync(
    path.join(TARGET_DIR, 'VENDOR.md'),
    [
      '# html-ppt-skill (vendored)',
      '',
      `- Repository: ${REPO}`,
      `- Commit: ${commit}`,
      '- License: MIT',
      '- Hub slug: `html-ppt` (integrated single card)',
      '',
    ].join('\n'),
    'utf8',
  );

  ensureLaunchRegistrySeed(VENDORED_SLUG);
  console.log(`[vendor-html-ppt] done → ${TARGET_DIR} (commit ${commit.slice(0, 7)})`);
}

main();
