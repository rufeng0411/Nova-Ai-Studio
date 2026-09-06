#!/usr/bin/env node
/**
 * PD-SAAS-FORK: vivy tax 择装。
 * 默认 LICENSE 门禁；用户明示忽略时设 PILOTDECK_CN_COMPLIANCE_IGNORE_LICENSE=1 或 --force-no-license。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { cloneRepo, vendorMappings } from './lib/vendorCnComplianceCore.mjs';

const REPO = 'https://github.com/vivy-yi/Greater-China-Legal.git';
const reuse = path.join(os.tmpdir(), 'pd-cn-compliance-probe', 'vivy');
let cloneDir = reuse;

const forceNoLicense =
  process.argv.includes('--force-no-license')
  || process.env.PILOTDECK_CN_COMPLIANCE_IGNORE_LICENSE === '1';

if (!existsSync(path.join(reuse, 'README.md'))) {
  const temp = path.join(os.tmpdir(), `pilotdeck-vivy-tax-${Date.now()}`, 'repo');
  cloneRepo(REPO, temp);
  cloneDir = temp;
}

const hasLicense = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((f) =>
  existsSync(path.join(cloneDir, f)),
);

if (!hasLicense && !forceNoLicense) {
  console.error(
    '[vendor-cn-compliance:vivy-tax] BLOCKED: no LICENSE file (set PILOTDECK_CN_COMPLIANCE_IGNORE_LICENSE=1 or --force-no-license to override).',
  );
  process.exit(2);
}

if (!hasLicense && forceNoLicense) {
  console.warn(
    '[vendor-cn-compliance:vivy-tax] WARN: no LICENSE — proceeding under explicit operator override (user authorized).',
  );
}

vendorMappings({
  repoUrl: REPO,
  packLabel: 'vivy-tax',
  mappings: [
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/invoice-compliance-checker',
      vendoredSlug: 'tax-invoice-compliance-checker',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/vat-rate-classification-advisor',
      vendoredSlug: 'tax-vat-rate-classification',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/vat-credit-calculator',
      vendoredSlug: 'tax-vat-credit-calculator',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/input-tax-credit-checker',
      vendoredSlug: 'tax-input-tax-credit-checker',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/eit-return-reviewer',
      vendoredSlug: 'tax-eit-return-reviewer',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/tax-preference-application-advisor',
      vendoredSlug: 'tax-preference-application-advisor',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/deduction-compliance-checker',
      vendoredSlug: 'tax-deduction-compliance-checker',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/tax-type-classifier',
      vendoredSlug: 'tax-type-classifier',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/individual-income-tax-planner',
      vendoredSlug: 'tax-individual-income-planner',
    },
    {
      sourcePath: 'plugins/legal-scenes/tax-compliance/skills/consumption-tax-compliance',
      vendoredSlug: 'tax-consumption-tax-compliance',
    },
  ],
  cloneDir,
});
