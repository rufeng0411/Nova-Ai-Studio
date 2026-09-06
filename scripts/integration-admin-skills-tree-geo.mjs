#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 后台技能树与能力中心 GEO 分类对齐门禁
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill, GEO_FLYWHEEL_STAGE_IDS } from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'config', 'capabilities.catalog.json');

function loadCapabilities() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  return (catalog.skills || []).map((skill) => applyTaxonomyToSkill({ ...skill }));
}

function buildGeoBranchLikeTree(caps) {
  const geoCaps = caps.filter((c) => c.major_category === 'geo');
  const stages = [];
  for (const stageId of GEO_FLYWHEEL_STAGE_IDS) {
    const count = geoCaps.filter((c) => c.geo_stage === stageId).length;
    if (count > 0) stages.push({ id: stageId, count });
  }
  return { geoTotal: geoCaps.length, stages };
}

function main() {
  const errors = [];
  const caps = loadCapabilities();
  const { geoTotal, stages } = buildGeoBranchLikeTree(caps);

  if (geoTotal < 30) errors.push(`geo skills too few (${geoTotal})`);
  if (stages.length < 6) errors.push(`geo stages in tree ${stages.length}, need 6`);

  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  if (!Array.isArray(catalog.geo_flywheel_stages) || catalog.geo_flywheel_stages.length !== 6) {
    errors.push('catalog.geo_flywheel_stages must have 6 entries');
  }
  if (!catalog.major_categories?.geo) {
    errors.push('catalog.major_categories.geo missing');
  }

  const ok = errors.length === 0;
  console.log(`[smoke:admin-skills-tree-geo] ok=${ok} geo=${geoTotal} stages=${stages.length}`);
  if (!ok) {
    for (const e of errors) console.log(`  - ${e}`);
    process.exitCode = 1;
  }
}

main();
