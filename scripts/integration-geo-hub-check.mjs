#!/usr/bin/env node
/**
 * PD-SAAS-FORK: GEO 独立 Tab taxonomy 门禁
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLYWHEEL_TASK_GROUPS,
  GEO_FLYWHEEL_STAGE_IDS,
  MAJOR_CATEGORY_ORDER,
  applyTaxonomyToSkill,
  capabilityMatchesFlywheelTaskGroup,
} from './lib/capabilityHubTaxonomy.mjs';
import { isCapabilityCopyPlaceholder } from './lib/capabilityCopy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'config', 'capabilities.catalog.json');

function main() {
  if (!existsSync(CATALOG)) throw new Error('Run npm run capabilities:gen first');
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const skills = (catalog.skills || []).map((s) => applyTaxonomyToSkill({ ...s }));
  const visible = skills.filter((s) => !s.hidden_in_hub);
  const errors = [];

  if (!MAJOR_CATEGORY_ORDER.includes('geo')) {
    errors.push('MAJOR_CATEGORY_ORDER missing geo');
  }
  if (!Array.isArray(catalog.geo_flywheel_stages) || catalog.geo_flywheel_stages.length !== 6) {
    errors.push('geo_flywheel_stages must have 6 entries');
  }

  for (const stage of Object.keys(FLYWHEEL_TASK_GROUPS)) {
    const pills = FLYWHEEL_TASK_GROUPS[stage] || [];
    if (pills.some((p) => p.id === 'ai_search')) {
      errors.push(`marketing stage ${stage} still has ai_search Pill`);
    }
    const aiCount = visible.filter((s) => capabilityMatchesFlywheelTaskGroup(s, stage, 'ai_search')).length;
    if (aiCount > 0) {
      errors.push(`marketing ${stage} still shows ${aiCount} ai_search capabilities`);
    }
  }

  for (const geoStage of GEO_FLYWHEEL_STAGE_IDS) {
    const count = visible.filter((s) => s.major_category === 'geo' && s.geo_stage === geoStage).length;
    if (count < 2) errors.push(`geo_stage ${geoStage} has only ${count} visible capabilities (need ≥2)`);
  }

  const pdGeo = skills.find((s) => s.slug === 'pd-geo');
  if (!pdGeo || pdGeo.major_category !== 'geo' || pdGeo.geo_stage !== 'geo_strategy') {
    errors.push('pd-geo must be major_category=geo geo_stage=geo_strategy');
  }
  if ((pdGeo?.secondary_task_groups || []).includes('ai_search')) {
    errors.push('pd-geo must not have secondary_task_groups ai_search');
  }

  const monitorSlugs = ['geo-monitor-hub', 'geo-monitor-report', 'geo-visibility-probe'];
  for (const slug of monitorSlugs) {
    const item = skills.find((s) => s.slug === slug);
    if (!item) errors.push(`missing skill ${slug}`);
    else if (item.geo_stage !== 'geo_monitor') errors.push(`${slug} must be geo_monitor`);
  }

  for (const skill of visible.filter((s) => s.major_category === 'geo')) {
    if (isCapabilityCopyPlaceholder(skill.task_summary)) {
      errors.push(`geo hub skill ${skill.slug} missing task_summary (placeholder)`);
    }
    if (isCapabilityCopyPlaceholder(skill.description)) {
      errors.push(`geo hub skill ${skill.slug} missing description (placeholder)`);
    }
    const label = skill.display_name || skill.name || '';
    if (!label || label === skill.slug || !/[\u4e00-\u9fff]/.test(label)) {
      errors.push(`geo hub skill ${skill.slug} missing Chinese display_name`);
    }
  }

  const ok = errors.length === 0;
  console.log(`[smoke:geo-hub] ok=${ok}`);
  if (errors.length) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
