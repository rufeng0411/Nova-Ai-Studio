#!/usr/bin/env node
// PD-SAAS-FORK: batch_media_planning — tribo OOH + produce-ooh（仅户外，无 programmatic/DSP）
/** @see npm run vendor:ooh-media */
import path from 'node:path';
import { REPO_ROOT, vendorSkillMappings } from './lib/vendorSkillPackCore.mjs';

const VENDOR_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'ooh-media');
const LOG = '[vendor-ooh-media]';

const PACKS = [
  {
    vendorSubdir: 'tribo-ooh',
    repo: 'https://github.com/dmend3z/tribo-skills.git',
    localDirEnv: 'TRIBO_SKILLS_LOCAL_DIR',
    sparsePaths: ['plugins/out-of-home-digital-advertising'],
    license: 'See upstream',
    mappings: [{
      sourcePath: 'plugins/out-of-home-digital-advertising',
      vendoredSlug: 'mkt-ooh-strategy',
    }],
  },
  {
    vendorSubdir: 'produce-ooh',
    repo: 'https://github.com/ClaudSkills/produce-ooh.git',
    localDirEnv: 'PRODUCE_OOH_LOCAL_DIR',
    license: 'SPDX review required before production',
    mappings: [{ sourcePath: '.', vendoredSlug: 'mkt-produce-ooh' }],
  },
];

function main() {
  let total = 0;
  for (const pack of PACKS) {
    const root = path.join(VENDOR_ROOT, pack.vendorSubdir);
    try {
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
    } catch (error) {
      console.warn(`${LOG} skip ${pack.vendorSubdir}: ${error.message}`);
    }
  }
  console.log(`${LOG} done skills=${total} → ${VENDOR_ROOT}`);
}

main();
