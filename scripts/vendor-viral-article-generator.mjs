#!/usr/bin/env node
/**
 * PD-SAAS-FORK: viral-article-generator — GiantClam/auto-viral-article-writer (MIT)
 * @see npm run vendor:viral-article-generator
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, resolveCloneDir, writeAttribution } from './lib/vendorSkillPackCore.mjs';

const LOG = '[vendor-viral-article-generator]';
const REPO = 'https://github.com/GiantClam/auto-viral-article-writer.git';
const PACK_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'viral-article-generator');
const SKILL_ROOT = path.join(REPO_ROOT, 'skills', 'viral-article-generator');
const PACK_DIRS = ['scripts', 'tools', 'rubrics', 'templates', 'config'];
const REF_SKILLS = ['write-article', 'viral-patterns', 'repurpose-content', 'hot-topics', 'research-brief'];

function copyTree(from, to) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

/** references/ 内 SKILL.md 改名为 UPSTREAM.md，避免 catalog 重复收录 */
function demoteReferenceSkillMd(rootDir) {
  if (!existsSync(rootDir)) return;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (/^skill\.md$/i.test(entry.name)) {
        renameSync(full, path.join(current, 'UPSTREAM.md'));
      }
    }
  }
}

function main() {
  const { cloneDir, commit, cleanup } = resolveCloneDir({
    repo: REPO,
    localDirEnv: 'VIRAL_ARTICLE_GENERATOR_LOCAL_DIR',
  });

  mkdirSync(PACK_ROOT, { recursive: true });
  const copied = [];

  for (const dir of PACK_DIRS) {
    const src = path.join(cloneDir, dir);
    if (!existsSync(src)) {
      console.warn(`${LOG} skip missing pack dir ${dir}`);
      continue;
    }
    copyTree(src, path.join(PACK_ROOT, dir));
    copied.push({ sourcePath: dir, vendoredSlug: dir });
    console.log(`${LOG} pack/${dir}`);
  }

  const licensePath = path.join(cloneDir, 'LICENSE');
  if (existsSync(licensePath)) {
    cpSync(licensePath, path.join(PACK_ROOT, 'LICENSE'), { force: true });
  }

  const refRoot = path.join(PACK_ROOT, 'references');
  mkdirSync(refRoot, { recursive: true });
  for (const skillId of REF_SKILLS) {
    const src = path.join(cloneDir, 'skills', skillId);
    if (!existsSync(src)) continue;
    const dest = path.join(refRoot, skillId);
    copyTree(src, dest);
    const skillMd = path.join(dest, 'SKILL.md');
    if (existsSync(skillMd)) {
      const content = readFileSync(skillMd, 'utf8');
      writeFileSync(path.join(dest, 'UPSTREAM.md'), content, 'utf8');
      rmSync(skillMd);
    }
    demoteReferenceSkillMd(dest);
    copied.push({ sourcePath: `skills/${skillId}`, vendoredSlug: `ref-${skillId}` });
    console.log(`${LOG} references/${skillId}`);
  }

  writeAttribution(PACK_ROOT, {
    title: 'viral-article-generator (Auto Viral Article Writer pack)',
    repo: REPO,
    commit,
    license: 'MIT',
    copied,
  });

  if (!existsSync(path.join(SKILL_ROOT, 'SKILL.md'))) {
    console.warn(`${LOG} skills/viral-article-generator/SKILL.md missing — keep repo-authored skill file`);
  } else {
    let skillMd = readFileSync(path.join(SKILL_ROOT, 'SKILL.md'), 'utf8');
    if (!skillMd.includes('Upstream commit:')) {
      skillMd = skillMd.replace(
        '<!-- NOVA-EXEC-END -->',
        `<!-- NOVA-EXEC-END -->\n\n<!-- Upstream commit: ${commit} -->`,
      );
      writeFileSync(path.join(SKILL_ROOT, 'SKILL.md'), skillMd, 'utf8');
    }
  }

  cleanup?.();
  console.log(`${LOG} done pack=${PACK_ROOT}`);
  console.log(`${LOG} post: npm run capabilities:gen && npm run smoke:capability-hub`);
}

main();
