#!/usr/bin/env node
/**
 * Vendor zhongweiv/hermes-edu-skills into skills/vendor/hermes-edu-skills/
 * and emit config/hermes-edu-skills.meta.json for capability catalog generation.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const REPO_URL = 'https://github.com/zhongweiv/hermes-edu-skills.git';
const REPO_REF = 'main';
const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'hermes-edu-skills');
const META_PATH = path.join(REPO_ROOT, 'config', 'hermes-edu-skills.meta.json');

/** 子类排序：教师工具 → 学习助手 → 教材同步 → 备考 → 每日练习 → 阅读写作 → 家庭教育 → 学前 */
const CATEGORY_BASE_SORT = {
  'teacher-tools': 0,
  'learning-assistant': 100,
  'textbook-sync': 200,
  'exam-prep': 300,
  'daily-practice': 400,
  'reading-writing': 500,
  'family-education': 600,
  preschool: 700,
};

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

function readLicense(repoDir) {
  for (const name of ['LICENSE', 'LICENSE.md', 'license', 'license.md']) {
    const licensePath = path.join(repoDir, name);
    if (existsSync(licensePath)) {
      return readFileSync(licensePath, 'utf8');
    }
  }
  throw new Error(`No LICENSE file found in ${repoDir}`);
}

function cleanTitle(title) {
  if (typeof title !== 'string') return '';
  return title.replace(/\s*Skill\s*$/i, '').trim();
}

function main() {
  const tempBase = path.join(os.tmpdir(), `pilotdeck-hermes-edu-${Date.now()}`);
  mkdirSync(tempBase, { recursive: true });
  const cloneDir = path.join(tempBase, 'repo');

  console.log('[hermes-edu] cloning', REPO_URL);
  run('git', ['clone', '--depth', '1', '--branch', REPO_REF, REPO_URL, cloneDir], REPO_ROOT);
  const commit = run('git', ['rev-parse', 'HEAD'], cloneDir);

  const catalogPath = path.join(cloneDir, 'catalog.json');
  if (!existsSync(catalogPath)) {
    throw new Error(`catalog.json not found in ${cloneDir}`);
  }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const catalogSkills = Array.isArray(catalog.skills) ? catalog.skills : [];

  rmSync(VENDOR_ROOT, { recursive: true, force: true });
  mkdirSync(VENDOR_ROOT, { recursive: true });
  writeFileSync(path.join(VENDOR_ROOT, 'LICENSE'), readLicense(cloneDir), 'utf8');

  const categoryCounters = new Map();
  const metaSkills = {};
  let copied = 0;
  let skipped = 0;

  for (const entry of catalogSkills) {
    const slug = entry.slug || entry.name;
    if (!slug || typeof slug !== 'string') {
      skipped += 1;
      continue;
    }
    const relPath = entry.path || `skills/${entry.category || 'misc'}/${slug}/SKILL.md`;
    const sourceSkillMd = path.join(cloneDir, relPath.replace(/\//g, path.sep));
    if (!existsSync(sourceSkillMd)) {
      console.warn(`[hermes-edu] skip missing: ${slug} (${relPath})`);
      skipped += 1;
      continue;
    }

    const category = entry.category || 'learning-assistant';
    const base = CATEGORY_BASE_SORT[category] ?? 900;
    const index = categoryCounters.get(category) || 0;
    categoryCounters.set(category, index + 1);
    const hubSort = base + index;

    const targetDir = path.join(VENDOR_ROOT, slug);
    mkdirSync(targetDir, { recursive: true });
    cpSync(sourceSkillMd, path.join(targetDir, 'SKILL.md'));

    const title = cleanTitle(entry.title) || slug;
    const description = typeof entry.description === 'string' ? entry.description.trim() : '';
    metaSkills[slug] = {
      slug,
      category,
      hub_sort: hubSort,
      title,
      description,
      task_summary: title,
      integration_level: 'L1',
      audience: ['学生', '家长', '教师', '教研'],
    };
    copied += 1;
  }

  const meta = {
    generated_at: new Date().toISOString(),
    source_repo: REPO_URL,
    source_ref: REPO_REF,
    source_commit: commit,
    catalog_version: catalog.version || null,
    skill_count: copied,
    skipped,
    categories: Object.keys(CATEGORY_BASE_SORT),
    skills: metaSkills,
  };
  writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  const attribution = [
    '# hermes-edu-skills attribution',
    '',
    `- Source: ${REPO_URL}`,
    `- Ref: ${REPO_REF}`,
    `- Commit: ${commit}`,
    `- License: MIT (see LICENSE)`,
    `- Vendored skills: ${copied}`,
    `- Catalog version: ${catalog.version || 'unknown'}`,
    '',
    'Upstream: 长沙欣慰科技 Hermes Edu Skills — 中文教育 Agent Skill Pack.',
    '',
  ].join('\n');
  writeFileSync(path.join(VENDOR_ROOT, 'ATTRIBUTION.md'), attribution, 'utf8');

  rmSync(tempBase, { recursive: true, force: true });
  console.log(`[hermes-edu] copied=${copied} skipped=${skipped}`);
  console.log(`[hermes-edu] vendor root: ${VENDOR_ROOT}`);
  console.log(`[hermes-edu] meta: ${META_PATH}`);
}

main();
