#!/usr/bin/env node
// PD-SAAS-FORK: persona business skills vendor
/**
 * Vendor business-thinking persona skills from awesome-persona-skills curated list.
 * @see https://github.com/tmstack/awesome-persona-skills#商业思维
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_PARENT = path.join(REPO_ROOT, 'skills', 'vendor', 'persona-skills');

/** @type {Array<{ repo: string; ref?: string; vendoredSlug: string; sourcePath?: string }>} */
const SKILL_MAPPINGS = [
  { repo: 'https://github.com/will2025btc/buffett-perspective.git', vendoredSlug: 'persona-buffett' },
  { repo: 'https://github.com/derrickgong87/duan-yongping-skill.git', vendoredSlug: 'persona-duan-yongping' },
  { repo: 'https://github.com/alchaincyf/steve-jobs-skill.git', vendoredSlug: 'persona-steve-jobs' },
  { repo: 'https://github.com/alchaincyf/elon-musk-skill.git', vendoredSlug: 'persona-elon-musk' },
  { repo: 'https://github.com/alchaincyf/munger-skill.git', vendoredSlug: 'persona-munger' },
  { repo: 'https://github.com/alchaincyf/feynman-skill.git', vendoredSlug: 'persona-feynman' },
  { repo: 'https://github.com/alchaincyf/naval-skill.git', vendoredSlug: 'persona-naval' },
  { repo: 'https://github.com/alchaincyf/taleb-skill.git', vendoredSlug: 'persona-taleb' },
  { repo: 'https://github.com/JikunR/zizek-skill.git', vendoredSlug: 'persona-zizek' },
  { repo: 'https://github.com/alchaincyf/trump-skill.git', vendoredSlug: 'persona-trump' },
  { repo: 'https://github.com/alchaincyf/zhang-yiming-skill.git', vendoredSlug: 'persona-zhang-yiming' },
];

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

function vendorSkill(mapping) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-persona-${mapping.vendoredSlug}-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  run('git', ['clone', '--depth', '1', mapping.repo, cloneDir], REPO_ROOT);
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  const sourcePath = mapping.sourcePath || '.';
  const skillDir = path.join(cloneDir, sourcePath);
  const skillMd = path.join(skillDir, 'SKILL.md');
  if (!existsSync(skillMd)) {
    rmSync(tempBase, { recursive: true, force: true });
    throw new Error(`SKILL.md missing for ${mapping.vendoredSlug} at ${sourcePath}`);
  }
  const targetDir = path.join(TARGET_PARENT, mapping.vendoredSlug);
  copySkillDir(skillDir, targetDir);
  rmSync(tempBase, { recursive: true, force: true });
  return { ...mapping, commit, sourcePath };
}

function main() {
  mkdirSync(TARGET_PARENT, { recursive: true });
  const copied = [];
  for (const mapping of SKILL_MAPPINGS) {
    console.log(`[vendor-persona-business] vendoring ${mapping.vendoredSlug}...`);
    copied.push(vendorSkill(mapping));
  }

  writeFileSync(
    path.join(TARGET_PARENT, 'ATTRIBUTION.md'),
    [
      '# Persona business-thinking skills',
      '',
      'Curated from [tmstack/awesome-persona-skills](https://github.com/tmstack/awesome-persona-skills#商业思维).',
      '',
      '| Slug | Repository | Commit |',
      '|---|---|---|',
      ...copied.map((c) => `| ${c.vendoredSlug} | ${c.repo} | ${c.commit} |`),
      '',
    ].join('\n'),
    'utf8',
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalSkills: copied.length,
    source: 'https://github.com/tmstack/awesome-persona-skills#商业思维',
    skills: copied.map(({ vendoredSlug, repo, commit, sourcePath }) => ({
      vendoredSlug,
      repo,
      commit,
      sourcePath: sourcePath || '.',
    })),
  };
  const manifestPath = path.join(TARGET_PARENT, 'persona-skills-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[vendor-persona-business] done skills=${manifest.totalSkills} manifest=${manifestPath}`);
}

main();
