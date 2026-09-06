#!/usr/bin/env node
/**
 * Vendor marketing / GEO skills for SaaS capability hub (seo-geo, best-aeo, knowledge-work).
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
    source: 'seo-geo',
    repo: 'https://github.com/aaron-he-zhu/seo-geo-claude-skills.git',
    ref: 'main',
    skillMappings: [
      { sourcePath: 'research/keyword-research', vendoredSlug: 'geo-keyword-research' },
      { sourcePath: 'research/competitor-analysis', vendoredSlug: 'geo-competitor-analysis' },
      { sourcePath: 'build/geo-content-optimizer', vendoredSlug: 'geo-content-optimizer' },
      { sourcePath: 'build/seo-content-writer', vendoredSlug: 'geo-seo-content-writer' },
      { sourcePath: 'optimize/technical-seo-checker', vendoredSlug: 'geo-technical-seo' },
      { sourcePath: 'optimize/on-page-seo-auditor', vendoredSlug: 'geo-on-page-audit' },
      { sourcePath: 'monitor/rank-tracker', vendoredSlug: 'geo-rank-track' },
      { sourcePath: 'research/content-gap-analysis', vendoredSlug: 'geo-content-gap-analysis' },
      { sourcePath: 'research/serp-analysis', vendoredSlug: 'geo-serp-analysis' },
      { sourcePath: 'monitor/backlink-analyzer', vendoredSlug: 'geo-backlink-analyzer' },
      { sourcePath: 'monitor/performance-reporter', vendoredSlug: 'geo-performance-reporter' },
    ],
  },
  {
    source: 'best-aeo-skill',
    repo: 'https://github.com/metawhisp/best-aeo-skill.git',
    ref: 'main',
    skillMappings: [{ sourcePath: '.', vendoredSlug: 'geo-aeo-audit' }],
    targetDir: 'seo-geo',
  },
  {
    source: 'geo-seo-claude',
    repo: 'https://github.com/zubair-trabzada/geo-seo-claude.git',
    ref: 'main',
    skillMappings: [{ sourcePath: 'skills/geo-citability', vendoredSlug: 'geo-citability' }],
    targetDir: 'seo-geo',
  },
  {
    source: 'knowledge-work-plugins',
    repo: 'https://github.com/anthropics/knowledge-work-plugins.git',
    ref: 'main',
    skillMappings: [
      { sourcePath: 'marketing/skills/competitive-brief', vendoredSlug: 'mkt-competitive-brief' },
      { sourcePath: 'sales/skills/competitive-intelligence', vendoredSlug: 'mkt-competitive-intel' },
      { sourcePath: 'marketing/skills/content-creation', vendoredSlug: 'mkt-content-creation' },
      { sourcePath: 'marketing/skills/draft-content', vendoredSlug: 'mkt-draft-content' },
      { sourcePath: 'marketing/skills/email-sequence', vendoredSlug: 'mkt-email-sequence' },
      { sourcePath: 'marketing/skills/performance-report', vendoredSlug: 'mkt-performance-report' },
    ],
    targetDir: 'marketing-hub',
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

function resolveSkillPath(cloneDir, mapping, pickFirstExisting) {
  if (pickFirstExisting && Array.isArray(mapping)) {
    for (const entry of mapping) {
      const full = path.join(cloneDir, entry.sourcePath);
      if (existsSync(path.join(full, 'SKILL.md'))) return { entry, full };
    }
    return null;
  }
  const full = path.join(cloneDir, mapping.sourcePath);
  if (!existsSync(path.join(full, 'SKILL.md'))) {
    throw new Error(`SKILL.md not found: ${full}`);
  }
  return { entry: mapping, full };
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

  const outParent = path.join(VENDOR_ROOT, sourceConfig.targetDir || sourceConfig.source);
  mkdirSync(outParent, { recursive: true });
  if (!sourceConfig.targetDir) {
    writeFileSync(path.join(outParent, 'LICENSE'), readLicense(cloneDir), 'utf8');
  }

  const copied = [];
  const mappings = sourceConfig.skillMappings;

  for (const mapping of mappings) {
    const skillDir = path.join(cloneDir, mapping.sourcePath);
    const skillMd = path.join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd)) {
      console.warn(`[vendor-marketing-geo] skip missing ${mapping.sourcePath}`);
      continue;
    }
    const targetDir = path.join(outParent, mapping.vendoredSlug);
    copySkillDir(skillDir, targetDir);
    copied.push({ sourcePath: mapping.sourcePath, vendoredSlug: mapping.vendoredSlug });
  }

  const attributionPath = path.join(outParent, `ATTRIBUTION-${sourceConfig.source}.md`);
  writeFileSync(
    attributionPath,
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
    console.log(`[vendor-marketing-geo] vendoring ${source.source}...`);
    reports.push(vendorSource(source));
  }
  const summary = {
    generatedAt: new Date().toISOString(),
    totalSkills: reports.reduce((sum, r) => sum + r.count, 0),
    sources: reports,
  };
  const summaryPath = path.join(VENDOR_ROOT, 'marketing-geo-manifest.json');
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`[vendor-marketing-geo] done skills=${summary.totalSkills} manifest=${summaryPath}`);
}

main();
