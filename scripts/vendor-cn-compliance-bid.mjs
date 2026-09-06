#!/usr/bin/env node
/** @see npm run vendor:cn-compliance:bid */
import path from 'node:path';
import os from 'node:os';
import { vendorMappings } from './lib/vendorCnComplianceCore.mjs';

const BID = path.join(os.tmpdir(), 'pd-cn-compliance-probe', 'bidsmart');
const BIAO = path.join(os.tmpdir(), 'pd-cn-compliance-probe', 'biaoshu');

vendorMappings({
  repoUrl: 'https://github.com/youyouhe/bidsmart-claude-skills.git',
  packLabel: 'bidsmart',
  mappings: [
    { sourcePath: 'skills/bid-analysis', vendoredSlug: 'bid-analysis' },
    { sourcePath: 'skills/bid-requirements', vendoredSlug: 'bid-requirements' },
    { sourcePath: 'skills/bid-commercial-proposal', vendoredSlug: 'bid-commercial-proposal' },
    { sourcePath: 'skills/bid-tech-proposal', vendoredSlug: 'bid-tech-proposal' },
    { sourcePath: 'skills/bid-evaluation', vendoredSlug: 'bid-evaluation' },
    { sourcePath: 'skills/bid-assembly', vendoredSlug: 'bid-assembly' },
    { sourcePath: 'skills/bid-audit', vendoredSlug: 'bid-audit' },
  ],
  cloneDir: BID,
});

vendorMappings({
  repoUrl: 'https://github.com/Get00/BiaoShu-SKILL.git',
  packLabel: 'biaoshu',
  mappings: [{ sourcePath: 'BiaoShu-writer-pro', vendoredSlug: 'biaoshu-writer-pro' }],
  cloneDir: BIAO,
});
