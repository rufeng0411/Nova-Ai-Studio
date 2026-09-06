#!/usr/bin/env node
// PD-SAAS-FORK: Leonxlnx/taste-skill 全量 skills/* → create-taste-*
/** @see npm run vendor:taste-skill-full */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './lib/vendorSkillPackCore.mjs';

const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'taste-skill');
const LOG = '[vendor-taste-skill-full]';
const REPO = 'https://github.com/Leonxlnx/taste-skill.git';

/** Upstream skills/ folder → vendored slug */
const TASTE_MAPPINGS = [
  { sourcePath: 'skills/taste-skill', vendoredSlug: 'create-taste-skill' },
  { sourcePath: 'skills/taste-skill-v1', vendoredSlug: 'create-taste-skill-v1' },
  { sourcePath: 'skills/brandkit', vendoredSlug: 'create-taste-brandkit' },
  { sourcePath: 'skills/brutalist-skill', vendoredSlug: 'create-taste-brutalist' },
  { sourcePath: 'skills/gpt-tasteskill', vendoredSlug: 'create-taste-gpt' },
  { sourcePath: 'skills/image-to-code-skill', vendoredSlug: 'create-taste-image-to-code' },
  { sourcePath: 'skills/imagegen-frontend-mobile', vendoredSlug: 'create-taste-imagegen-mobile' },
  { sourcePath: 'skills/imagegen-frontend-web', vendoredSlug: 'create-taste-imagegen-web' },
  { sourcePath: 'skills/minimalist-skill', vendoredSlug: 'create-taste-minimalist' },
  { sourcePath: 'skills/output-skill', vendoredSlug: 'create-taste-output' },
  { sourcePath: 'skills/redesign-skill', vendoredSlug: 'create-taste-redesign' },
  { sourcePath: 'skills/soft-skill', vendoredSlug: 'create-taste-soft' },
  { sourcePath: 'skills/stitch-skill', vendoredSlug: 'create-taste-stitch' },
];

function main() {
  const legacy = path.join(REPO_ROOT, 'skills', 'vendor', 'creation-ecosystem', 'create-taste-skill');
  if (existsSync(legacy)) {
    rmSync(legacy, { recursive: true, force: true });
    console.log(`${LOG} removed legacy ${legacy}`);
  }

  const result = vendorSkillMappings({
    logTag: LOG,
    vendorRoot: VENDOR_ROOT,
    repo: REPO,
    localDirEnv: 'TASTE_SKILL_LOCAL_DIR',
    license: 'MIT (see upstream)',
    mappings: TASTE_MAPPINGS,
  });

  console.log(`${LOG} done skills=${result.count} → ${VENDOR_ROOT}`);
  console.log(`${LOG} post-vendor: npm run capabilities:gen && npm run smoke:skills-batch`);
}

main();
