#!/usr/bin/env node
// PD-SAAS-FORK: batch_copy_rewrite_distill — quill + avoid-ai-writing + skill-creator 官方
/** @see npm run vendor:copy-rewrite */
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './lib/vendorSkillPackCore.mjs';

const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'copy-rewrite');
const LOG = '[vendor-copy-rewrite]';

const PACKS = [
  {
    vendorSubdir: 'quill',
    repo: 'https://github.com/sevenwoood/quill-skill.git',
    localDirEnv: 'QUILL_SKILL_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'writing-quill' }],
  },
  {
    vendorSubdir: 'avoid-ai-writing',
    repo: 'https://github.com/conorbronsdon/avoid-ai-writing.git',
    localDirEnv: 'AVOID_AI_WRITING_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'writing-avoid-ai' }],
  },
  {
    vendorSubdir: 'skill-creator',
    repo: 'https://github.com/anthropics/skills.git',
    localDirEnv: 'ANTHROPICS_SKILLS_LOCAL_DIR',
    sparsePaths: ['skills/skill-creator'],
    license: 'See anthropics/skills',
    mappings: [{ sourcePath: 'skills/skill-creator', vendoredSlug: 'skill-creator' }],
  },
];

function main() {
  let total = 0;
  for (const pack of PACKS) {
    const root = path.join(VENDOR_ROOT, pack.vendorSubdir);
    const result = vendorSkillMappings({
      logTag: `${LOG}:${pack.vendorSubdir}`,
      vendorRoot: root,
      repo: pack.repo,
      localDirEnv: pack.localDirEnv,
      sparsePaths: pack.sparsePaths,
      license: pack.license,
      mappings: pack.mappings,
    });
    total += result.count;
  }
  console.log(`${LOG} done skills=${total} → ${VENDOR_ROOT}`);
  console.log(`${LOG} post-vendor: npm run capabilities:gen && npm run smoke:skills-batch`);
}

main();
