#!/usr/bin/env node
/** Smoke: video planning skills batch (9 vendor + 2 hub expose) */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesHubFilter } from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const I18N_PATH = path.join(ROOT, 'ui', 'src', 'generated', 'capabilities.i18n.json');
const REPORT = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'video-planning-smoke.json');

const NEW_VENDOR = [
  { slug: 'create-vid-scriptwriting', rel: 'skills/vendor/creation-ecosystem/create-vid-scriptwriting/SKILL.md' },
  { slug: 'create-vid-saas-demo-script', rel: 'skills/vendor/creation-ecosystem/create-vid-saas-demo-script/SKILL.md' },
  { slug: 'create-vid-seedance-prompt', rel: 'skills/vendor/creation-ecosystem/create-vid-seedance-prompt/SKILL.md' },
  { slug: 'create-vid-seedance-codec', rel: 'skills/vendor/creation-ecosystem/create-vid-seedance-codec/SKILL.md' },
  { slug: 'create-vid-visual-prompt', rel: 'skills/vendor/creation-ecosystem/create-vid-visual-prompt/SKILL.md' },
  { slug: 'create-vid-director', rel: 'skills/vendor/creation-ecosystem/create-vid-director/SKILL.md' },
  { slug: 'create-vid-storyboard-pack', rel: 'skills/vendor/creation-ecosystem/create-vid-storyboard-pack/SKILL.md' },
  { slug: 'create-vid-seedance-series', rel: 'skills/vendor/creation-ecosystem/create-vid-seedance-series/SKILL.md' },
  { slug: 'create-vid-viral-copy', rel: 'skills/vendor/creation-ecosystem/create-vid-viral-copy/SKILL.md' },
];

const EXPOSED = [
  { slug: 'mkt-dmp-video-script', creation: true, marketing: true },
  { slug: 'mkt-brand-video', creation: true, marketing: true },
];

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
const bySlug = new Map((catalog.skills || []).map((s) => [s.slug, s]));
const results = [];

for (const c of NEW_VENDOR) {
  const cat = bySlug.get(c.slug);
  const zh = i18n.skills?.[c.slug]?.['zh-CN'];
  const en = i18n.skills?.[c.slug]?.en;
  const disk = existsSync(path.join(ROOT, c.rel));
  const inCreation = cat
    ? matchesHubFilter(cat, 'creation', 'creation', null, 'all', 'create_video')
    : false;
  results.push({
    slug: c.slug,
    kind: 'vendor',
    disk,
    catalog: !!cat,
    hidden_in_hub: cat?.hidden_in_hub,
    category_subtag: cat?.category_subtag,
    major_category: cat?.major_category,
    creationVideoOk: inCreation,
    zhDisplayOk: /[\u4e00-\u9fff]/.test(zh?.display_name || ''),
    enDisplayOk: !!(en?.display_name && !/[\u4e00-\u9fff]/.test(en.display_name)),
  });
}

for (const c of EXPOSED) {
  const cat = bySlug.get(c.slug);
  const zh = i18n.skills?.[c.slug]?.['zh-CN'];
  const en = i18n.skills?.[c.slug]?.en;
  const inCreation = cat
    ? matchesHubFilter(cat, 'creation', 'creation', null, 'all', 'create_video')
    : false;
  const inMarketing = cat
    ? matchesHubFilter(cat, 'marketing', cat.stage || 'create', null, cat.task_group || 'all', 'all')
    : false;
  results.push({
    slug: c.slug,
    kind: 'expose',
    catalog: !!cat,
    hidden_in_hub: cat?.hidden_in_hub,
    secondary_categories: cat?.secondary_categories,
    creationVideoOk: inCreation,
    marketingOk: inMarketing,
    zhDisplayOk: /[\u4e00-\u9fff]/.test(zh?.display_name || ''),
    enDisplayOk: !!(en?.display_name && !/[\u4e00-\u9fff]/.test(en.display_name)),
  });
}

const ok = results.every((r) => {
  if (r.kind === 'vendor') {
    return r.disk && r.catalog && !r.hidden_in_hub && r.creationVideoOk && r.zhDisplayOk && r.enDisplayOk;
  }
  return r.catalog && !r.hidden_in_hub && r.creationVideoOk && r.marketingOk && r.zhDisplayOk && r.enDisplayOk;
});

mkdirSync(path.dirname(REPORT), { recursive: true });
writeFileSync(REPORT, `${JSON.stringify({ ok, results, generatedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`[video-planning-smoke] ok=${ok} → ${REPORT}`);
for (const r of results) {
  console.log(`  ${r.slug}: ${JSON.stringify(r)}`);
}
process.exit(ok ? 0 : 1);
