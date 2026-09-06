#!/usr/bin/env node
/** @see npm run vendor:cn-compliance:zhou */
import path from 'node:path';
import os from 'node:os';
import { vendorMappings } from './lib/vendorCnComplianceCore.mjs';

const REUSE = path.join(os.tmpdir(), 'pd-cn-compliance-probe', 'zhou');

const MAPPINGS = [
  { sourcePath: 'employment-legal/skills/hiring-review', vendoredSlug: 'zh-hiring-review' },
  { sourcePath: 'employment-legal/skills/termination-review', vendoredSlug: 'zh-termination-review' },
  { sourcePath: 'employment-legal/skills/worker-classification', vendoredSlug: 'zh-worker-classification' },
  { sourcePath: 'employment-legal/skills/wage-hour-qa', vendoredSlug: 'zh-wage-hour-qa' },
  { sourcePath: 'employment-legal/skills/handbook-updates', vendoredSlug: 'zh-handbook-updates' },
  { sourcePath: 'employment-legal/skills/policy-drafting', vendoredSlug: 'zh-policy-drafting' },
  { sourcePath: 'commercial-legal/skills/nda-review', vendoredSlug: 'zh-nda-review' },
  { sourcePath: 'commercial-legal/skills/vendor-agreement-review', vendoredSlug: 'zh-vendor-agreement-review' },
  { sourcePath: 'commercial-legal/skills/saas-msa-review', vendoredSlug: 'zh-saas-msa-review' },
  { sourcePath: 'commercial-legal/skills/review', vendoredSlug: 'zh-contract-review' },
  { sourcePath: 'corporate-legal/skills/entity-compliance', vendoredSlug: 'zh-entity-compliance' },
  { sourcePath: 'corporate-legal/skills/diligence-issue-extraction', vendoredSlug: 'zh-diligence-issue-extraction' },
  { sourcePath: 'corporate-legal/skills/tabular-review', vendoredSlug: 'zh-tabular-review' },
  { sourcePath: 'corporate-legal/skills/board-minutes', vendoredSlug: 'zh-board-minutes' },
  { sourcePath: 'privacy-legal/skills/pia-generation', vendoredSlug: 'zh-pia-generation' },
  { sourcePath: 'privacy-legal/skills/dsar-response', vendoredSlug: 'zh-dsar-response' },
  { sourcePath: 'privacy-legal/skills/dpa-review', vendoredSlug: 'zh-dpa-review' },
  { sourcePath: 'privacy-legal/skills/reg-gap-analysis', vendoredSlug: 'zh-privacy-reg-gap' },
  { sourcePath: 'product-legal/skills/marketing-claims-review', vendoredSlug: 'zh-marketing-claims-review' },
  { sourcePath: 'product-legal/skills/launch-review', vendoredSlug: 'zh-launch-review' },
  { sourcePath: 'product-legal/skills/feature-risk-assessment', vendoredSlug: 'zh-feature-risk-assessment' },
  { sourcePath: 'product-legal/skills/is-this-a-problem', vendoredSlug: 'zh-is-this-a-problem' },
  { sourcePath: 'regulatory-legal/skills/gap-surfacer', vendoredSlug: 'zh-reg-gap-surfacer' },
  { sourcePath: 'regulatory-legal/skills/policy-redraft', vendoredSlug: 'zh-reg-policy-redraft' },
  { sourcePath: 'regulatory-legal/skills/gaps', vendoredSlug: 'zh-reg-gaps' },
];

vendorMappings({
  repoUrl: 'https://github.com/zhou210712/claude-for-legal-ZH.git',
  packLabel: 'zhou',
  mappings: MAPPINGS,
  cloneDir: REUSE,
});
