#!/usr/bin/env node
// PD-SAAS-FORK: batch_paid_media_ops — claude-ads + cn-ads-skills
/** @see npm run vendor:paid-media */
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './lib/vendorSkillPackCore.mjs';

const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'paid-media');
const LOG = '[vendor-paid-media]';

const PACKS = [
  {
    vendorSubdir: 'claude-ads',
    repo: 'https://github.com/AgriciDaniel/claude-ads.git',
    localDirEnv: 'CLAUDE_ADS_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'mkt-claude-ads' }],
  },
  {
    vendorSubdir: 'cn-ads-skills',
    repo: 'https://github.com/linxumoney/cn-ads-skills.git',
    localDirEnv: 'CN_ADS_SKILLS_LOCAL_DIR',
    license: 'See upstream',
    mappings: [{ sourcePath: '.', vendoredSlug: 'mkt-cn-ads-skills' }],
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
      license: pack.license,
      mappings: pack.mappings,
    });
    total += result.count;
  }
  console.log(`${LOG} done skills=${total} → ${VENDOR_ROOT}`);
  console.log(`${LOG} post-vendor: overlay pilotdeck-execution.md + npm run capabilities:gen`);
}

main();
