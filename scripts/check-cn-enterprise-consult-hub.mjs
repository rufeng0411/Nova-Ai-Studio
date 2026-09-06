#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 脑爆「企业咨询」六顾问 Hub 结构验收
 */
import fs from 'node:fs';
import path from 'node:path';
import { ENTERPRISE_CONSULT_BINDS } from './lib/enterpriseConsultHubTaxonomy.mjs';
import { CN_ENTERPRISE_CONSULT_TRY_PROMPTS } from './lib/cnEnterpriseConsultTryPrompts.mjs';

const root = process.cwd();
const failures = [];
const SLUGS = Object.keys(ENTERPRISE_CONSULT_BINDS);

const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'config/capabilities.catalog.json'), 'utf8'),
);
const caps = catalog.skills || [];
const bySlug = new Map(caps.map((c) => [c.slug, c]));

const majors = catalog.major_categories || {};
const brain = majors.brainstorming;
const subIds = (brain?.subtags || []).map((s) => s.id);
if (!subIds.includes('enterprise_consult')) {
  failures.push('missing_pill:enterprise_consult');
}

for (const slug of SLUGS) {
  const item = bySlug.get(slug);
  if (!item) failures.push(`missing_catalog:${slug}`);
  else {
    if (item.major_category !== 'brainstorming') failures.push(`wrong_major:${slug}`);
    if (item.category_subtag !== 'enterprise_consult') failures.push(`wrong_subtag:${slug}`);
    if (item.hidden_in_hub) failures.push(`hidden:${slug}`);
  }
  const skillPath = path.join(root, 'skills/vendor/cn-enterprise-consult', slug, 'SKILL.md');
  if (!fs.existsSync(skillPath)) failures.push(`missing_skill:${slug}`);
  const tryPrompt = CN_ENTERPRISE_CONSULT_TRY_PROMPTS[slug];
  if (!tryPrompt) failures.push(`missing_try:${slug}`);
  else if (/须交付/.test(tryPrompt)) failures.push(`try_has_deliverable:${slug}`);
}

const label = majors.enterprise_compliance?.label;
if (label === '企业合规') failures.push('label_still_enterprise_compliance_zh');

const out = { ok: failures.length === 0, failures, slugs: SLUGS.length };
console.log(JSON.stringify(out, null, 2));
if (failures.length) process.exit(1);
console.log('check:cn-enterprise-consult:hub passed');
