#!/usr/bin/env node
/** Smoke: ppt-master + timesfm bump + last30days sync */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill } from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const REPORT = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'ppt-timesfm-batch-smoke.json');

const CHECKS = [
  { slug: 'ppt-master', rel: 'skills/vendor/ppt-master/SKILL.md', hubMajor: 'marketing', taskGroup: 'deck_report', hidden: false },
  { slug: 'edu-sci-timesfm-forecasting', rel: 'skills/vendor/education-ecosystem/edu-sci-timesfm-forecasting/SKILL.md', hubMajor: 'office', hidden: false },
  { slug: 'mkt-last30days', rel: 'skills/vendor/marketing-ecosystem/mkt-last30days/SKILL.md', hubMajor: 'marketing', taskGroup: 'brand_sentiment', hidden: false },
];

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const bySlug = new Map((catalog.skills || []).map((s) => [s.slug, s]));
const results = [];

for (const c of CHECKS) {
  const skillPath = path.join(ROOT, c.rel);
  const cat = bySlug.get(c.slug);
  const md = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : '';
  const versionMatch = md.match(/^version:\s*["']?([^"'\n]+)/m);
  const nameMatch = md.match(/^name:\s*([^\n]+)/m);
  results.push({
    slug: c.slug,
    disk: existsSync(skillPath),
    catalog: !!cat,
    hidden_in_hub: cat?.hidden_in_hub,
    major_category: cat?.major_category,
    task_group: cat?.task_group,
    availability: cat?.availability,
    rating: cat?.rating,
    skill_name: nameMatch?.[1]?.trim(),
    skill_version: versionMatch?.[1]?.trim() || null,
    hubMajorOk: cat?.major_category === c.hubMajor,
    hiddenOk: cat?.hidden_in_hub === c.hidden,
    taskGroupOk: c.taskGroup ? cat?.task_group === c.taskGroup : true,
  });
}

const ok = results.every((r) => r.disk && r.catalog && r.hiddenOk && r.hubMajorOk && r.taskGroupOk);
mkdirSync(path.dirname(REPORT), { recursive: true });
writeFileSync(REPORT, `${JSON.stringify({ ok, results, generatedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`[ppt-timesfm-smoke] ok=${ok} → ${REPORT}`);
for (const r of results) {
  console.log(`  ${r.slug}: disk=${r.disk} hub=${r.major_category}/${r.task_group} hidden=${r.hidden_in_hub} rating=${r.rating}`);
}
process.exit(ok ? 0 : 1);
