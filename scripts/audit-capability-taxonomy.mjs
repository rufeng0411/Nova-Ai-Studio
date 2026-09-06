#!/usr/bin/env node
/**
 * 深度校验能力中心分类：飞轮子类、办公/创作/开发、学术迁出。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill, FLYWHEEL_TASK_GROUPS, capabilityMatchesFlywheelTaskGroup, matchesMajorCategory } from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const OUT = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'taxonomy-audit.json');

const FLYWHEEL = ['research', 'strategy', 'create', 'activate', 'distribute', 'measure'];
const MAJORS = ['office', 'creation', 'development', 'brainstorming', 'enterprise_compliance'];

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const skills = (catalog.skills || []).map((s) => applyTaxonomyToSkill({ ...s }));
  const visible = skills.filter((s) => !s.hidden_in_hub);

  const flywheelCoverage = {};
  const flywheelEmpty = [];
  for (const stage of FLYWHEEL) {
    const groups = FLYWHEEL_TASK_GROUPS[stage] || [];
    flywheelCoverage[stage] = groups.map((g) => {
      const count = visible.filter(
        (s) => capabilityMatchesFlywheelTaskGroup(s, stage, g.id),
      ).length;
      if (g.id !== 'general' && count === 0) flywheelEmpty.push(`${stage}/${g.id}`);
      return { id: g.id, label: g.label, count };
    });
  }

  const majorCoverage = {};
  const majorEmptySubtags = [];
  for (const major of MAJORS) {
    const items = visible.filter((s) => matchesMajorCategory(major, s));
    const meta = catalog.major_categories?.[major];
    const subtagCounts = {};
    for (const item of items) {
      const tag = item.category_subtag || 'general';
      subtagCounts[tag] = (subtagCounts[tag] || 0) + 1;
    }
    for (const sub of meta?.subtags || []) {
      if ((subtagCounts[sub.id] || 0) === 0) majorEmptySubtags.push(`${major}/${sub.id}`);
    }
    majorCoverage[major] = { total: items.length, subtagCounts };
  }

  const academic = visible.filter(
    (s) => s.stage === 'education' && (s.education_bands || []).includes('academic_research'),
  );

  const marketingInWrongMajor = visible.filter(
    (s) =>
      FLYWHEEL.includes(s.stage) &&
      s.major_category &&
      s.major_category !== 'marketing' &&
      !MAJORS.includes(s.major_category),
  );

  const OPTIONAL_EMPTY_SUBTAGS = new Set([]);
  const majorEmptyRequired = majorEmptySubtags.filter((id) => !OPTIONAL_EMPTY_SUBTAGS.has(id));

  const ok =
    flywheelEmpty.length === 0 &&
    majorEmptyRequired.length === 0 &&
    majorCoverage.office.total > 0 &&
    majorCoverage.creation.total > 0 &&
    majorCoverage.development.total > 0 &&
    academic.length >= 4;

  const report = {
    generatedAt: new Date().toISOString(),
    ok,
    flywheelEmpty,
    majorEmptySubtags,
    majorCoverage,
    flywheelCoverage,
    academic_research_count: academic.length,
    marketingInWrongMajor: marketingInWrongMajor.map((s) => s.slug),
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[taxonomy-audit] ok=${ok}`);
  console.log(`[taxonomy-audit] office=${majorCoverage.office.total} creation=${majorCoverage.creation.total} dev=${majorCoverage.development.total}`);
  console.log(`[taxonomy-audit] academic=${academic.length} flywheelEmpty=${flywheelEmpty.length} majorEmptySubtags=${majorEmptySubtags.length}`);
  console.log(`[taxonomy-audit] report=${OUT}`);
  if (!ok) process.exitCode = 1;
}

main();
