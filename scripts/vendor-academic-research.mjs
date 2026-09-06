#!/usr/bin/env node
/**
 * Vendor academic / research skills (Orchestra-Research + Anthropic PDF).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor');

const SOURCES = [
  {
    source: 'orchestra-research',
    repo: 'https://github.com/Orchestra-Research/AI-Research-SKILLs.git',
    ref: 'main',
    targetDir: 'academic-research',
    skillMappings: [
      { sourcePath: '20-ml-paper-writing/ml-paper-writing', vendoredSlug: 'ora-ml-paper-writing' },
      { sourcePath: '20-ml-paper-writing/academic-plotting', vendoredSlug: 'ora-academic-plotting' },
      { sourcePath: '20-ml-paper-writing/systems-paper-writing', vendoredSlug: 'ora-systems-paper-writing' },
      { sourcePath: '21-research-ideation/brainstorming-research-ideas', vendoredSlug: 'ora-brainstorm-research' },
      { sourcePath: '22-agent-native-research-artifact/rigor-reviewer', vendoredSlug: 'ora-rigor-reviewer' },
      { sourcePath: '22-agent-native-research-artifact/research-manager', vendoredSlug: 'ora-research-manager' },
    ],
  },
  {
    source: 'anthropics-skills',
    repo: 'https://github.com/anthropics/skills.git',
    ref: 'main',
    targetDir: 'academic-research',
    skillMappings: [{ sourcePath: 'skills/pdf', vendoredSlug: 'anth-pdf' }],
  },
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

function readLicense(repoDir) {
  for (const name of ['LICENSE', 'LICENSE.md', 'license', 'license.md']) {
    const licensePath = path.join(repoDir, name);
    if (existsSync(licensePath)) return readFileSync(licensePath, 'utf8');
  }
  return 'See upstream repository for license terms.';
}

function copySkillDir(fromDir, toDir) {
  rmSync(toDir, { recursive: true, force: true });
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    cpSync(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true });
  }
}

function vendorSource(sourceConfig) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${sourceConfig.source}-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  run('git', ['clone', '--depth', '1', '--branch', sourceConfig.ref, sourceConfig.repo, cloneDir], REPO_ROOT);
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);

  const outParent = path.join(VENDOR_ROOT, sourceConfig.targetDir);
  mkdirSync(outParent, { recursive: true });

  const copied = [];
  for (const mapping of sourceConfig.skillMappings) {
    const skillDir = path.join(cloneDir, mapping.sourcePath);
    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) {
      console.warn(`[vendor-academic-research] skip missing ${mapping.sourcePath}`);
      continue;
    }
    const targetDir = path.join(outParent, mapping.vendoredSlug);
    copySkillDir(skillDir, targetDir);
    copied.push({ sourcePath: mapping.sourcePath, vendoredSlug: mapping.vendoredSlug });
  }

  writeFileSync(
    path.join(outParent, `ATTRIBUTION-${sourceConfig.source}.md`),
    [
      `# ${sourceConfig.source}`,
      '',
      `- Repository: ${sourceConfig.repo}`,
      `- Ref: ${sourceConfig.ref}`,
      `- Commit: ${commit}`,
      '',
      '| Source path | Slug |',
      '|---|---|',
      ...copied.map((c) => `| ${c.sourcePath} | ${c.vendoredSlug} |`),
      '',
    ].join('\n'),
    'utf8',
  );

  rmSync(tempBase, { recursive: true, force: true });
  return { source: sourceConfig.source, commit, count: copied.length, copied };
}

function main() {
  mkdirSync(VENDOR_ROOT, { recursive: true });
  const reports = [];
  for (const source of SOURCES) {
    console.log(`[vendor-academic-research] vendoring ${source.source}...`);
    reports.push(vendorSource(source));
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    totalSkills: reports.reduce((sum, r) => sum + r.count, 0),
    sources: reports,
  };
  const summaryPath = path.join(VENDOR_ROOT, 'academic-research-manifest.json');
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[vendor-academic-research] done skills=${summary.totalSkills} manifest=${summaryPath}`);
}

main();
