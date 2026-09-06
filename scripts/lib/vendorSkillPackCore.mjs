// PD-SAAS-FORK: shared git-clone + skill copy for batch vendor scripts
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applySkillOverlays } from './skillVendorOverlays/applySkillOverlays.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, ...env, GIT_LFS_SKIP_SMUDGE: '1' },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

export function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

/** Patch SKILL.md frontmatter `name:` to match vendored slug (read_skill discovery). */
export function patchSkillMdName(skillDir, vendoredSlug) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) return;
  let content = readFileSync(skillMd, 'utf8');
  content = content.replace(/^name:\s*.+$/m, `name: ${vendoredSlug}`);
  writeFileSync(skillMd, content, 'utf8');
}

export function resolveCloneDir({ repo, localDirEnv, sparsePaths }) {
  const localDir = localDirEnv ? process.env[localDirEnv] : undefined;
  if (localDir && existsSync(localDir)) {
    const commit = run('git', ['rev-parse', 'HEAD'], localDir);
    return { cloneDir: localDir, commit, cleanup: null };
  }
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  const cloneArgs = ['clone', '--depth', '1'];
  if (sparsePaths?.length) cloneArgs.push('--filter=blob:none', '--sparse');
  cloneArgs.push(repo, cloneDir);
  run('git', cloneArgs, REPO_ROOT);
  if (sparsePaths?.length) {
    run('git', ['sparse-checkout', 'set', ...sparsePaths], cloneDir);
  }
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  return {
    cloneDir,
    commit,
    cleanup: () => rmSync(tempBase, { recursive: true, force: true }),
  };
}

export function writeAttribution(vendorRoot, { title, repo, commit, license, copied }) {
  writeFileSync(
    path.join(vendorRoot, 'ATTRIBUTION.md'),
    [
      `# ${title}`,
      '',
      `- Repository: ${repo}`,
      `- Commit: ${commit}`,
      `- License: ${license || 'See upstream'}`,
      `- Vendored at: ${new Date().toISOString()}`,
      '',
      '| Source path | Slug |',
      '|---|---|',
      ...copied.map((c) => `| ${c.sourcePath} | ${c.vendoredSlug} |`),
      '',
    ].join('\n'),
    'utf8',
  );
}

export function vendorSkillMappings({
  logTag,
  vendorRoot,
  repo,
  localDirEnv,
  sparsePaths,
  license,
  mappings,
  overlaySlugs = [],
}) {
  mkdirSync(vendorRoot, { recursive: true });
  const { cloneDir, commit, cleanup } = resolveCloneDir({ repo, localDirEnv, sparsePaths });
  const copied = [];
  for (const mapping of mappings) {
    const skillDir = path.join(cloneDir, mapping.sourcePath);
    if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
      console.warn(`${logTag} skip missing ${mapping.sourcePath}`);
      continue;
    }
    const target = path.join(vendorRoot, mapping.vendoredSlug);
    copySkillDir(skillDir, target);
    patchSkillMdName(target, mapping.vendoredSlug);
    copied.push({ sourcePath: mapping.sourcePath, vendoredSlug: mapping.vendoredSlug });
    console.log(`${logTag} ${mapping.vendoredSlug}`);
  }
  writeAttribution(vendorRoot, { title: logTag, repo, commit, license, copied });
  cleanup?.();
  if (overlaySlugs.length) {
    applySkillOverlays(overlaySlugs);
  }
  return { commit, count: copied.length, copied };
}
