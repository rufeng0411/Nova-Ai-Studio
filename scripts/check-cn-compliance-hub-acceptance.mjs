#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 企业 Hub 结构验收（L0/L1/L3-shadow，非 Gateway 九案）
 * 含合规 P0 + 公关 P0/P1 virtual 卡
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const failures = [];

const P0_SLUGS = [
  'comp-entity-compliance',
  'comp-data-privacy',
  'comp-ad-product',
  'comp-regulatory-lite',
  'comp-contract-review',
  'comp-bid-analyze',
  'comp-bid-write',
  'comp-labor-hire',
  'comp-termination',
  'comp-handbook-compete',
  'comp-corp-governance',
  'comp-policy-search',
  'comp-zjtx-tech-sme',
  'comp-local-subsidy',
  'comp-subsidy-checklist',
  'comp-cashier-ops',
  'comp-invoice-vat',
  'comp-cit-basics',
  'comp-bookkeeping-xlsx',
  'comp-tax-sme-hnte',
  'comp-rd-super-deduction',
];

/** 企业·公关 Pill 前台卡（与 taxonomy / try-prompts 同步） */
const PR_SLUGS = [
  'comp-pr-press-release',
  'comp-pr-media-pitch',
  'comp-pr-digital-campaign',
  'comp-pr-crisis-response',
  'comp-pr-reputation',
  'comp-pr-spokesperson-qa',
  'comp-pr-sentiment-brief',
  'comp-pr-internal-comms',
  'comp-pr-media-day-kit',
  'comp-pr-thought-leadership',
  'comp-pr-esg-narrative',
  'comp-pr-ir-messaging',
];

const PR_ATOM_SLUGS = [
  'mkt-dmp-crisis-response',
  'mkt-dmp-digital-pr',
  'mkt-dmp-pr-pitch',
  'mkt-dmp-reputation-management',
];

const SUBTAGS = [
  'comp_ops_reg',
  'comp_contract_bid',
  'comp_tax_accounting',
  'comp_hr_labor',
  'comp_corp_legal',
  'comp_tax_planning',
  'comp_policy_subsidy',
  'comp_pr_comms',
];

const SKILL_BIND_ROOTS = [
  path.join(root, 'skills/vendor/cn-compliance'),
  path.join(root, 'skills/vendor/marketing-ecosystem'),
  path.join(root, 'skills/vendor/marketing-hub'),
  path.join(root, 'skills/vendor/anthropics-skills'),
  path.join(root, 'skills/vendor/marketingskills'),
  path.join(root, 'skills'),
];

function skillBindExists(bindSlug) {
  for (const base of SKILL_BIND_ROOTS) {
    const p = path.join(base, bindSlug, 'SKILL.md');
    if (fs.existsSync(p)) return true;
  }
  // shallow vendor scan (one level under vendor/*)
  const vendorRoot = path.join(root, 'skills/vendor');
  if (!fs.existsSync(vendorRoot)) return false;
  for (const ent of fs.readdirSync(vendorRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const p = path.join(vendorRoot, ent.name, bindSlug, 'SKILL.md');
    if (fs.existsSync(p)) return true;
  }
  return false;
}

const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'config/capabilities.catalog.json'), 'utf8'),
);
const caps = catalog.skills || catalog.capabilities || catalog.items || [];
const bySlug = new Map(caps.map((c) => [c.slug, c]));

const FRONT_SLUGS = [...P0_SLUGS, ...PR_SLUGS];

for (const slug of FRONT_SLUGS) {
  const item = bySlug.get(slug);
  if (!item) failures.push(`missing_catalog:${slug}`);
  else if (item.major_category !== 'enterprise_compliance') {
    failures.push(`wrong_major:${slug}`);
  } else if (item.hidden_in_hub) {
    failures.push(`front_hidden:${slug}`);
  }
}

for (const slug of PR_SLUGS) {
  const item = bySlug.get(slug);
  if (item && item.category_subtag !== 'comp_pr_comms') {
    failures.push(`wrong_pr_subtag:${slug}->${item.category_subtag}`);
  }
  const ex = item?.examples?.[0] || '';
  if (ex && (!ex.includes('【你在做什么】') || !ex.includes('须交付：') || !ex.includes('写入系统分配任务目录'))) {
    failures.push(`pr_try_shape:${slug}`);
  }
  if (ex && /直接开始做|做完告诉我/.test(ex)) {
    failures.push(`pr_try_forbidden:${slug}`);
  }
}

const mcp = bySlug.get('mcp-cn-central-policy');
if (!mcp) failures.push('missing_catalog:mcp-cn-central-policy');
else if (mcp.availability !== 'needs_config') failures.push('mcp_availability');

const atoms = fs
  .readdirSync(path.join(root, 'skills/vendor/cn-compliance'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
for (const slug of atoms) {
  const item = bySlug.get(slug);
  if (item && item.hidden_in_hub !== true) failures.push(`atom_visible:${slug}`);
}

for (const slug of PR_ATOM_SLUGS) {
  const item = bySlug.get(slug);
  if (!item) failures.push(`missing_pr_atom:${slug}`);
  else if (item.hidden_in_hub !== true) failures.push(`pr_atom_visible:${slug}`);
  else if (item.major_category !== 'enterprise_compliance') {
    failures.push(`pr_atom_major:${slug}`);
  }
}

const vis = JSON.parse(fs.readFileSync(path.join(root, 'config/hub-visibility.json'), 'utf8'));
if (vis.categories?.enterprise_compliance !== false) {
  failures.push('visibility_not_shadow');
}

const major = catalog.major_categories?.enterprise_compliance;
if (!major?.subtags?.length) failures.push('missing_subtags');
else {
  for (const id of SUBTAGS) {
    if (!major.subtags.some((s) => s.id === id)) failures.push(`missing_subtag:${id}`);
  }
  const prPill = major.subtags.find((s) => s.id === 'comp_pr_comms');
  if (prPill && prPill.label !== '公关') failures.push(`pr_pill_label:${prPill.label}`);
}

const subtagHits = Object.fromEntries(SUBTAGS.map((id) => [id, 0]));
for (const item of caps) {
  if (item.major_category !== 'enterprise_compliance' || item.hidden_in_hub) continue;
  if (item.category_subtag && subtagHits[item.category_subtag] != null) {
    subtagHits[item.category_subtag] += 1;
  }
}
for (const [id, n] of Object.entries(subtagHits)) {
  if (n < 1) failures.push(`empty_pill:${id}`);
}

// skill_binds on disk（合规 cn-compliance + 公关跨 vendor）
for (const slug of FRONT_SLUGS) {
  const item = bySlug.get(slug);
  const binds = item?.skill_binds;
  if (!Array.isArray(binds)) continue;
  for (const b of binds) {
    if (!skillBindExists(b)) failures.push(`bind_missing:${slug}->${b}`);
  }
}

// profiles via TS (optional)
try {
  const { resolveProfile } = await import(
    path.join(root, 'dist/saas/deliverableCapabilityProfiles.js').replace(/\\/g, '/')
  ).catch(() => ({ resolveProfile: null }));
  if (!resolveProfile) {
    // soft: use tsx path via require of compiled not available — skip
  } else {
    for (const slug of ['comp-contract-review', 'comp-bid-write', 'comp-policy-search']) {
      const p = resolveProfile(slug, 'enterprise_compliance', `须交付：合同审查意见书.md`);
      if (!String(p?.id || '').startsWith('cn-compliance')) {
        failures.push(`profile:${slug}->${p?.id}`);
      }
    }
  }
} catch {
  /* ignore profile runtime if dist missing */
}

const example = fs.readFileSync(
  path.join(root, 'products/_example/config/mcp.json.example'),
  'utf8',
);
if (!example.includes('cn-central-policy')) failures.push('mcp_example');

const report = {
  ok: failures.length === 0,
  failures,
  p0: P0_SLUGS.length,
  pr: PR_SLUGS.length,
  atoms: atoms.length,
  subtagHits,
  visibility: vis.categories?.enterprise_compliance,
};
const out = path.join(root, 'artifacts/capabilities-smoke/cn-compliance-hub-acceptance.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('check:cn-compliance:hub-acceptance passed');
