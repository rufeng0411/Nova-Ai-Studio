#!/usr/bin/env node
// PD-SAAS-FORK: GordenSun/GordenSuperPPTSkills — 三技能全量
/** @see npm run vendor:gorden-ppt */
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './lib/vendorSkillPackCore.mjs';

const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'gorden-ppt');
const LOG = '[vendor-gorden-ppt]';

const MAPPINGS = [
  { sourcePath: 'GordenImagePPTGen', vendoredSlug: 'ppt-gorden-image-gen' },
  { sourcePath: 'GordenImage2PPTX', vendoredSlug: 'ppt-gorden-image2pptx' },
  { sourcePath: 'GordenSuperPPTSkill', vendoredSlug: 'ppt-gorden-super' },
];

function main() {
  const result = vendorSkillMappings({
    logTag: LOG,
    vendorRoot: VENDOR_ROOT,
    repo: 'https://github.com/GordenSun/GordenSuperPPTSkills.git',
    localDirEnv: 'GORDEN_PPT_LOCAL_DIR',
    license: 'Commercial use with attribution (@Gorden Sun / GitHub)',
    mappings: MAPPINGS,
  });

  console.log(`${LOG} done skills=${result.count} → ${VENDOR_ROOT}`);
  console.log(`${LOG} deps: pip3 install python-pptx pillow numpy; image API via generate_image`);
  console.log(`${LOG} post-vendor: npm run capabilities:gen && npm run smoke:skills-batch`);
}

main();
