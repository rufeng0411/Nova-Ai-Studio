#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill, capabilityMatchesFlywheelTaskGroup } from './lib/capabilityHubTaxonomy.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'capabilities-smoke');
const REPORT_PATH = path.join(ARTIFACT_DIR, 'report.json');

function discoverSkillDirs(skillsRoot) {
  if (!existsSync(skillsRoot)) return [];
  const found = [];
  const stack = [skillsRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && /^skill\.md$/i.test(entry.name))) {
      found.push(current);
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
      }
    }
  }
  return found;
}

function asSlugSet(paths) {
  return new Set(paths.map((item) => path.basename(item)));
}

function setDiff(left, right) {
  const missing = [];
  for (const item of left) {
    if (!right.has(item)) {
      missing.push(item);
    }
  }
  return missing.sort((a, b) => a.localeCompare(b));
}

function isCatalogOnlySkill(skill) {
  const source = String(skill?.source || '');
  return source.startsWith('virtual:') || source.startsWith('builtin:') || source.startsWith('mcp:')
    || source.startsWith('hub-pack') || skill.slug?.startsWith('hub-pack-');
}

function main() {
  if (!existsSync(CATALOG_PATH)) {
    throw new Error(`Catalog not found: ${CATALOG_PATH}. Run scripts/generate-capabilities-catalog.mjs first.`);
  }

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const catalogSlugs = new Set((catalog.skills || []).map((item) => item.slug));

  const includeUserSkills = process.env.CAPABILITIES_SMOKE_INCLUDE_USER_SKILLS === '1';
  const repoSkillsRoot = path.join(REPO_ROOT, 'skills');
  const runtimeSkillDirs = includeUserSkills
    ? [
        ...discoverSkillDirs(path.join(os.homedir(), '.pilotdeck', 'skills')),
        ...discoverSkillDirs(path.join(REPO_ROOT, '.pilotdeck', 'skills')),
        ...discoverSkillDirs(repoSkillsRoot),
      ]
    : discoverSkillDirs(repoSkillsRoot);
  const runtimeSlugs = asSlugSet(runtimeSkillDirs);

  const catalogBySlug = new Map((catalog.skills || []).map((item) => [item.slug, item]));
  const missingInCatalog = setDiff(runtimeSlugs, catalogSlugs);
  const staleInCatalog = setDiff(catalogSlugs, runtimeSlugs).filter((slug) => {
    const item = catalogBySlug.get(slug);
    if (!item) return true;
    if (isCatalogOnlySkill(item)) return false;
    if (item.availability === 'pending') return false;
    return true;
  });

  const stageCounts = {};
  for (const item of catalog.skills || []) {
    const stage = item.stage || 'uncategorized';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }

  const requiredStages = ['research', 'strategy', 'create', 'activate', 'distribute', 'measure'];
  const emptyStages = requiredStages.filter((stage) => (stageCounts[stage] || 0) === 0);

  const catalogSkills = (catalog.skills || []).map((s) => applyTaxonomyToSkill({ ...s }));
  const flywheelTaskGroups = catalog.flywheel_task_groups || {};
  const taskGroupCoverage = {};
  for (const stage of requiredStages) {
    const groups = flywheelTaskGroups[stage] || [];
    const visible = catalogSkills.filter((s) => !s.hidden_in_hub);
    taskGroupCoverage[stage] = groups.map((g) => ({
      id: g.id,
      count: visible.filter((s) => capabilityMatchesFlywheelTaskGroup(s, stage, g.id)).length,
    }));
  }
  const emptyTaskGroups = Object.entries(taskGroupCoverage).flatMap(([stage, groups]) =>
    groups.filter((g) => g.id !== 'general' && g.count === 0).map((g) => `${stage}/${g.id}`),
  );

  const ok =
    missingInCatalog.length === 0 &&
    staleInCatalog.length === 0 &&
    emptyStages.length === 0 &&
    emptyTaskGroups.length === 0;
  const report = {
    generatedAt: new Date().toISOString(),
    ok,
    runtimeCount: runtimeSlugs.size,
    catalogCount: catalogSlugs.size,
    missingInCatalog,
    staleInCatalog,
    emptyStages,
    emptyTaskGroups,
    taskGroupCoverage,
    stageCounts,
  };

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[capabilities-smoke] ok=${ok}`);
  console.log(`[capabilities-smoke] runtime=${report.runtimeCount} catalog=${report.catalogCount}`);
  console.log(`[capabilities-smoke] missingInCatalog=${missingInCatalog.length}`);
  console.log(`[capabilities-smoke] staleInCatalog=${staleInCatalog.length}`);
  console.log(`[capabilities-smoke] emptyStages=${emptyStages.length}`);
  console.log(`[capabilities-smoke] emptyTaskGroups=${emptyTaskGroups.length}`);
  console.log(`[capabilities-smoke] report=${REPORT_PATH}`);

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
