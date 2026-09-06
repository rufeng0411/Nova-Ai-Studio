#!/usr/bin/env node
// PD-SAAS-FORK: crazyykhllc-bit/CyberPPT — 咨询风高密度可编辑 PPTX
/** @see npm run vendor:cyber-ppt */
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './lib/vendorSkillPackCore.mjs';

const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'cyber-ppt');
const LOG = '[vendor-cyber-ppt]';

function main() {
  const result = vendorSkillMappings({
    logTag: LOG,
    vendorRoot: VENDOR_ROOT,
    repo: 'https://github.com/crazyykhllc-bit/CyberPPT.git',
    localDirEnv: 'CYBER_PPT_LOCAL_DIR',
    license: 'MIT',
    mappings: [{ sourcePath: '.', vendoredSlug: 'cyber-ppt' }],
  });

  console.log(`${LOG} done skills=${result.count} → ${VENDOR_ROOT}`);
  console.log(`${LOG} deps: python3 + python-pptx pillow; post: npm run capabilities:gen`);
}

main();
