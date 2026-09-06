#!/usr/bin/env node
// PD-SAAS-FORK: batch vendor for skills batch 2026-06 (phase 2/3 gaps)
/** @see npm run vendor:batch-2026-06 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor');
const LOG = '[vendor-batch-2026-06]';

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

function cloneRepo(repo, ref = 'main') {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-vendor-batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');
  run('git', ['clone', '--depth', '1', '--branch', ref, repo, cloneDir], REPO_ROOT);
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);
  return { cloneDir, commit, cleanup: () => rmSync(tempBase, { recursive: true, force: true }) };
}

function findSkillDirs(rootDir) {
  const found = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    if (existsSync(path.join(dir, 'SKILL.md'))) {
      let childSkill = false;
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory() && !['.git', 'node_modules'].includes(ent.name)) {
          walk(path.join(dir, ent.name));
          if (found.some((f) => f.startsWith(path.join(dir, ent.name)))) childSkill = true;
        }
      }
      if (!childSkill) found.push(dir);
      return;
    }
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory() && !['.git', 'node_modules'].includes(ent.name)) walk(path.join(dir, ent.name));
    }
  }
  walk(rootDir);
  return found;
}

function vendorMapping({ packDir, repo, mappings, needsConfig = false }) {
  const { cloneDir, commit, cleanup } = cloneRepo(repo);
  mkdirSync(packDir, { recursive: true });
  const copied = [];
  const failures = [];
  for (const m of mappings) {
    const skillDir = path.join(cloneDir, m.sourcePath);
    if (!existsSync(path.join(skillDir, 'SKILL.md'))) {
      failures.push({ slug: m.vendoredSlug, reason: `missing ${m.sourcePath}` });
      continue;
    }
    copySkillDir(skillDir, path.join(packDir, m.vendoredSlug));
    copied.push({ ...m, commit });
  }
  cleanup();
  return { repo, commit, copied, failures, needsConfig };
}

function appendAttribution(packDir, title, lines) {
  const p = path.join(packDir, 'ATTRIBUTION-batch-2026-06.md');
  const block = [`## ${title}`, '', ...lines, ''].join('\n');
  writeFileSync(p, existsSync(p) ? `${readFileSync(p, 'utf8')}\n${block}` : `# ${title}\n\n${block}`, 'utf8');
}

const results = [];

try {
  const web = vendorMapping({
    packDir: path.join(VENDOR_ROOT, 'web-scrape'),
    repo: 'https://github.com/scrapegraphai/just-scrape.git',
    needsConfig: true,
    mappings: [
      { sourcePath: 'just-scrape', vendoredSlug: 'web-just-scrape' },
      { sourcePath: 'skills/just-scrape', vendoredSlug: 'web-just-scrape' },
      { sourcePath: '.', vendoredSlug: 'web-just-scrape' },
    ].filter((v, i, a) => a.findIndex((x) => x.vendoredSlug === v.vendoredSlug && x.sourcePath === v.sourcePath) === i),
  });
  // retry single path discovery
  if (web.copied.length === 0) {
    const { cloneDir, commit, cleanup } = cloneRepo('https://github.com/scrapegraphai/just-scrape.git');
    const dirs = findSkillDirs(cloneDir);
    if (dirs.length === 1) {
      copySkillDir(dirs[0], path.join(VENDOR_ROOT, 'web-scrape', 'web-just-scrape'));
      web.copied.push({ sourcePath: path.relative(cloneDir, dirs[0]), vendoredSlug: 'web-just-scrape', commit });
    }
    cleanup();
  }
  results.push({ pack: 'web-scrape', ...web });
} catch (e) {
  results.push({ pack: 'web-scrape', copied: [], failures: [{ slug: 'web-just-scrape', reason: String(e.message || e) }] });
  console.error(`${LOG} web-scrape FAILED: ${e.message || e}`);
}

for (const entry of [
  {
    pack: 'creation-ecosystem',
    repo: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git',
    mappings: [{ sourcePath: '.claude/skills/ui-ux-pro-max', vendoredSlug: 'create-ui-ux-pro-max' }],
  },
  {
    pack: 'creation-ecosystem',
    repo: 'https://github.com/qu-skills/skills.git',
    mappings: [{ sourcePath: 'tools/video/ai-video-generation', vendoredSlug: 'create-ai-video-gen' }],
    needsConfig: true,
  },
  {
    pack: 'education-ecosystem',
    repo: 'https://github.com/juliusbrussee/caveman.git',
    mappings: [
      { sourcePath: 'skills/caveman', vendoredSlug: 'edu-fun-caveman' },
      { sourcePath: 'plugins/caveman/skills/caveman', vendoredSlug: 'edu-fun-caveman' },
    ],
  },
  {
    pack: 'legal',
    repo: 'https://github.com/anthropics/knowledge-work-plugins.git',
    mappings: [
      { sourcePath: 'legal-risk-assessment', vendoredSlug: 'legal-risk-assessment' },
      { sourcePath: 'legal-response', vendoredSlug: 'legal-response' },
      { sourcePath: 'skills/legal-risk-assessment', vendoredSlug: 'legal-risk-assessment' },
      { sourcePath: 'skills/legal-response', vendoredSlug: 'legal-response' },
    ],
  },
]) {
  try {
    const packDir = path.join(VENDOR_ROOT, entry.pack);
    const seen = new Set();
    const uniqueMappings = entry.mappings.filter((m) => {
      const k = m.vendoredSlug;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    let r = vendorMapping({ packDir, repo: entry.repo, mappings: uniqueMappings, needsConfig: entry.needsConfig });
    if (r.copied.length === 0 && entry.repo.includes('knowledge-work')) {
      const { cloneDir, commit, cleanup } = cloneRepo(entry.repo);
      for (const slug of ['legal-risk-assessment', 'legal-response']) {
        const dirs = findSkillDirs(cloneDir).filter((d) => path.basename(d) === slug || d.includes(slug));
        if (dirs[0]) {
          copySkillDir(dirs[0], path.join(packDir, slug));
          r.copied.push({ sourcePath: path.relative(cloneDir, dirs[0]), vendoredSlug: slug, commit });
        }
      }
      cleanup();
    }
    if (r.copied.length === 0 && entry.repo.includes('ui-ux')) {
      const { cloneDir, commit, cleanup } = cloneRepo(entry.repo);
      const dirs = findSkillDirs(cloneDir).filter((d) => /ui-ux-pro-max/i.test(d));
      const pick = dirs[0] || findSkillDirs(cloneDir).find((d) => /ui-ux-pro-max/i.test(path.basename(d)));
      if (pick) {
        copySkillDir(pick, path.join(packDir, 'create-ui-ux-pro-max'));
        r.copied.push({ sourcePath: path.relative(cloneDir, pick), vendoredSlug: 'create-ui-ux-pro-max', commit });
      }
      cleanup();
    }
    results.push({ pack: entry.pack, ...r });
    console.log(`${LOG} ${entry.pack} copied=${r.copied.length} failures=${r.failures?.length || 0}`);
  } catch (e) {
    results.push({ pack: entry.pack, copied: [], failures: [{ slug: entry.pack, reason: String(e.message || e) }] });
    console.error(`${LOG} ${entry.pack} FAILED: ${e.message || e}`);
  }
}

writeFileSync(
  path.join(VENDOR_ROOT, 'batch-2026-06-manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
  'utf8',
);
console.log(`${LOG} manifest written`);
