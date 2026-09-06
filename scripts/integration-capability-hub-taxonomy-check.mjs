#!/usr/bin/env node
/**
 * 模拟 CapabilityHub 筛选逻辑，验证子类 Pill 与办公/创作/开发 Tab 非空。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyTaxonomyToSkill,
  capabilityMatchesFlywheelTaskGroup,
  FLYWHEEL_TASK_GROUPS,
  matchesHubFilter,
} from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const OUT = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'hub-filter-check.json');

const FLYWHEEL = ['research', 'strategy', 'create', 'activate', 'distribute', 'measure'];

function matchesHubFilterLocal(item, majorCategory, activeStage, activeTaskGroup, activeCategorySubtag) {
  return matchesHubFilter(item, majorCategory, activeStage, '', activeTaskGroup, activeCategorySubtag);
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const capabilities = (catalog.skills || []).map((s) => applyTaxonomyToSkill({ ...s }));

  const failures = [];

  for (const stage of FLYWHEEL) {
    const groups = (FLYWHEEL_TASK_GROUPS[stage] || []).filter((g) => g.id !== 'general');
    for (const group of groups) {
      const count = capabilities.filter((item) =>
        matchesHubFilterLocal(item, 'marketing', stage, group.id, 'all'),
      ).length;
      if (count > 0) continue;
      // geo_only：该 Pill 下能力已全部迁到 GEO Tab，营销飞轮允许空 Pill
      const hasMarketingSkill = capabilities.some(
        (item) =>
          !item.hidden_in_hub
          && item.major_category === 'marketing'
          && capabilityMatchesFlywheelTaskGroup(item, stage, group.id),
      );
      if (!hasMarketingSkill) continue;
      failures.push(`marketing/${stage}/${group.id}=0`);
    }
  }

  for (const major of ['office', 'creation', 'development', 'brainstorming', 'finance']) {
    const total = capabilities.filter((item) => matchesHubFilterLocal(item, major, major, 'all', 'all')).length;
    if (total === 0) failures.push(`${major}/all=0`);
    const subtags = catalog.major_categories?.[major]?.subtags || [];
    const optionalEmpty = new Set(['fin_regtech-compliance-brief']);
    for (const sub of subtags) {
      if (optionalEmpty.has(sub.id)) continue;
      const count = capabilities.filter((item) =>
        matchesHubFilterLocal(item, major, major, 'all', sub.id),
      ).length;
      if (count === 0) failures.push(`${major}/${sub.id}=0`);
    }
    if (major === 'brainstorming') {
      const personas = capabilities.filter((item) => item.slug?.startsWith('persona-'));
      const missingSubtag = personas.filter(
        (item) => !matchesHubFilterLocal(item, 'brainstorming', 'brainstorming', 'all', 'celebrity_mind'),
      ).length;
      if (personas.length < 11) failures.push(`brainstorming/persona-count=${personas.length}`);
      if (missingSubtag > 0) failures.push(`brainstorming/persona-missing-subtag=${missingSubtag}`);
    }
  }

  if (Array.isArray(catalog.media_lanes) && catalog.media_lanes.length >= 2) {
    const mediaTotal = capabilities.filter((item) =>
      matchesHubFilterLocal(item, 'media', 'dig_brief', 'media_digital', 'all'),
    ).length;
    if (mediaTotal === 0) failures.push('media/media_digital/dig_brief=0');
    const oohTotal = capabilities.filter((item) =>
      matchesHubFilterLocal(item, 'media', 'ooh_brief', 'media_ooh', 'all'),
    ).length;
    if (oohTotal === 0) failures.push('media/media_ooh/ooh_brief=0');
  }

  const officeSlides = capabilities
    .filter((item) => matchesHubFilterLocal(item, 'office', 'office', 'all', 'office_slides'))
    .sort((a, b) => (a.hub_sort ?? 999) - (b.hub_sort ?? 999));
  if (officeSlides[0]?.slug !== 'nova-bento-slides') {
    failures.push(`office/office_slides/first=${officeSlides[0]?.slug ?? 'none'}`);
  }

  const ok = failures.length === 0;
  const report = { generatedAt: new Date().toISOString(), ok, failures };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[hub-filter-check] ok=${ok} failures=${failures.length}`);
  if (failures.length) console.log(failures.slice(0, 20).join('\n'));
  console.log(`[hub-filter-check] report=${OUT}`);
  if (!ok) process.exitCode = 1;
}

main();
