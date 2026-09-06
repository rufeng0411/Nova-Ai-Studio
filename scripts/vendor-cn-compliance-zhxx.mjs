#!/usr/bin/env node
/** @see npm run vendor:cn-compliance:zhxx */
import path from 'node:path';
import os from 'node:os';
import { vendorMappings } from './lib/vendorCnComplianceCore.mjs';

const REUSE = path.join(os.tmpdir(), 'pd-cn-compliance-probe', 'zhxx');

vendorMappings({
  repoUrl: 'https://github.com/zh-xx/legal-assistant-skills.git',
  packLabel: 'zhxx',
  mappings: [
    { sourcePath: 'ad-compliance-review', vendoredSlug: 'zhxx-ad-compliance-review' },
    { sourcePath: 'contract-review', vendoredSlug: 'zhxx-contract-review' },
    { sourcePath: 'contract-gen', vendoredSlug: 'zhxx-contract-gen' },
    { sourcePath: 'food-label-review', vendoredSlug: 'zhxx-food-label-review' },
    { sourcePath: 'legal-risk-visualization', vendoredSlug: 'zhxx-legal-risk-visualization' },
  ],
  cloneDir: REUSE,
});
