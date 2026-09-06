#!/usr/bin/env node
// PD-SAAS-FORK: Firecrawl CLI skills vendor (skills/vendor/firecrawl)
/** @see npm run vendor:firecrawl */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'firecrawl');
const REPO = 'https://github.com/firecrawl/cli.git';
const LOG = '[vendor-firecrawl]';

const MAPPINGS = [
  { sourcePath: 'skills/firecrawl-agent', vendoredSlug: 'fc-firecrawl-agent' },
  { sourcePath: 'skills/firecrawl-cli', vendoredSlug: 'fc-firecrawl-cli' },
  { sourcePath: 'skills/firecrawl-crawl', vendoredSlug: 'fc-firecrawl-crawl' },
  { sourcePath: 'skills/firecrawl-download', vendoredSlug: 'fc-firecrawl-download' },
  { sourcePath: 'skills/firecrawl-interact', vendoredSlug: 'fc-firecrawl-interact' },
  { sourcePath: 'skills/firecrawl-map', vendoredSlug: 'fc-firecrawl-map' },
  { sourcePath: 'skills/firecrawl-monitor', vendoredSlug: 'fc-firecrawl-monitor' },
  { sourcePath: 'skills/firecrawl-parse', vendoredSlug: 'fc-firecrawl-parse' },
  { sourcePath: 'skills/firecrawl-scrape', vendoredSlug: 'fc-firecrawl-scrape' },
  { sourcePath: 'skills/firecrawl-search', vendoredSlug: 'fc-firecrawl-search' },
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
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

function main() {
  mkdirSync(VENDOR_ROOT, { recursive: true });
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-firecrawl-${Date.now()}`);
  const cloneDir = path.join(tempBase, 'repo');
  run('git', ['clone', '--depth', '1', REPO, cloneDir], REPO_ROOT);
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  const copied = [];
  for (const m of MAPPINGS) {
    const skillDir = path.join(cloneDir, m.sourcePath);
    if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
      console.warn(`${LOG} skip missing ${m.sourcePath}`);
      continue;
    }
    copySkillDir(skillDir, path.join(VENDOR_ROOT, m.vendoredSlug));
    copied.push(m);
  }
  writeFileSync(
    path.join(VENDOR_ROOT, 'ATTRIBUTION.md'),
    [
      '# firecrawl-cli',
      '',
      '## firecrawl-cli',
      '',
      `- Repository: ${REPO}`,
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
  console.log(`${LOG} done skills=${copied.length} commit=${commit.slice(0, 8)}`);
}

main();
