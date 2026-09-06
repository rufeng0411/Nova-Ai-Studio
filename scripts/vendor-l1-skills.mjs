#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const VENDOR_ROOT = path.join(SKILLS_ROOT, 'vendor');

const SOURCES = [
  {
    source: 'marketingskills',
    repo: 'https://github.com/coreyhaines31/marketingskills.git',
    ref: 'main',
    slugPrefix: 'mkt',
    include: () => true,
  },
  {
    source: 'deer-flow',
    repo: 'https://github.com/bytedance/deer-flow.git',
    ref: 'main',
    slugPrefix: 'df',
    include: () => true,
  },
  {
    source: 'awesome-llm-apps',
    repo: 'https://github.com/shubhamsaboo/awesome-llm-apps.git',
    ref: 'main',
    slugPrefix: 'ala',
    include: () => true,
  },
  {
    source: 'pm-skills',
    repo: 'https://github.com/phuryn/pm-skills.git',
    ref: 'main',
    slugPrefix: 'pms',
    include: ({ slug }) => slug === 'swot-analysis',
  },
  {
    source: 'anthropics-skills',
    repo: 'https://github.com/anthropics/skills.git',
    ref: 'main',
    slugPrefix: 'anth',
    include: ({ slug }) => slug === 'docx',
  },
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed: ${message}`);
  }
  return (result.stdout || '').trim();
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readLicense(repoDir) {
  const candidates = ['LICENSE', 'LICENSE.md', 'license', 'license.md'];
  for (const name of candidates) {
    const licensePath = path.join(repoDir, name);
    if (existsSync(licensePath)) {
      return readFileSync(licensePath, 'utf8');
    }
  }
  throw new Error(`No LICENSE file found in ${repoDir}`);
}

function discoverSkillDirs(rootDir) {
  const found = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && /^skill\.md$/i.test(entry.name))) {
      found.push(current);
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
}

function parseNameAndDescription(skillMdPath) {
  const content = readFileSync(skillMdPath, 'utf8');
  const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return { name: null, description: null };
  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : null,
    description: descriptionMatch ? descriptionMatch[1].trim().replace(/^['"]|['"]$/g, '') : null,
  };
}

function writeAttribution(sourceDir, sourceConfig, commit, copiedSkills) {
  const lines = [
    `# ${sourceConfig.source} attribution`,
    '',
    `- Source repository: ${sourceConfig.repo}`,
    `- Source ref: ${sourceConfig.ref}`,
    `- Source commit: ${commit}`,
    `- Slug prefix: ${sourceConfig.slugPrefix}-`,
    `- Vendored at: ${new Date().toISOString()}`,
    '',
    '## Vendored skills',
    '',
    '| Source skill | Vendored slug |',
    '|---|---|',
    ...copiedSkills.map((entry) => `| ${entry.sourceSlug} | ${entry.vendoredSlug} |`),
    '',
  ];
  writeFileSync(path.join(sourceDir, 'ATTRIBUTION.md'), lines.join('\n'), 'utf8');
}

function vendorSource(sourceConfig) {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-${sourceConfig.source}-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  run('git', ['clone', '--depth', '1', '--branch', sourceConfig.ref, sourceConfig.repo, cloneDir], REPO_ROOT);
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);

  const sourceDir = path.join(VENDOR_ROOT, sourceConfig.source);
  rmSync(sourceDir, { recursive: true, force: true });
  mkdirSync(sourceDir, { recursive: true });

  const licenseText = readLicense(cloneDir);
  writeFileSync(path.join(sourceDir, 'LICENSE'), licenseText, 'utf8');

  const skillDirs = discoverSkillDirs(cloneDir);
  const copied = [];

  for (const skillDir of skillDirs) {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;
    const sourceSlug = path.basename(skillDir);
    if (!sourceConfig.include({ slug: sourceSlug, skillDir })) continue;

    const normalized = normalizeSlug(sourceSlug);
    if (!normalized) continue;
    const vendoredSlug = `${sourceConfig.slugPrefix}-${normalized}`;
    const targetDir = path.join(sourceDir, vendoredSlug);
    cpSync(skillDir, targetDir, { recursive: true });

    const details = parseNameAndDescription(skillMdPath);
    copied.push({
      sourceSlug,
      vendoredSlug,
      name: details.name,
      description: details.description,
    });
  }

  writeAttribution(sourceDir, sourceConfig, commit, copied);
  rmSync(tempBase, { recursive: true, force: true });
  return { source: sourceConfig.source, commit, count: copied.length, copied };
}

function main() {
  mkdirSync(VENDOR_ROOT, { recursive: true });
  const reports = SOURCES.map(vendorSource);
  const summary = {
    generatedAt: new Date().toISOString(),
    totalSources: reports.length,
    totalSkills: reports.reduce((sum, item) => sum + item.count, 0),
    sources: reports,
  };
  const summaryPath = path.join(VENDOR_ROOT, 'manifest.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`[vendor-l1] done. sources=${summary.totalSources} skills=${summary.totalSkills}`);
  console.log(`[vendor-l1] manifest: ${summaryPath}`);
}

main();
