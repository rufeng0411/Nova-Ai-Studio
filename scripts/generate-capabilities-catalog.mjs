#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { computeHubSortPriority, compareCapabilitiesForHub } from './lib/capabilityHubSort.mjs';
import {
  EDUCATION_BAND_ORDER,
  countEducationBandSkills,
  resolveEducationBands,
} from './lib/educationBands.mjs';
import {
  FLYWHEEL_TASK_GROUPS,
  GEO_TASK_GROUPS,
  GEO_FLYWHEEL_STAGE_IDS,
  GEO_STAGE_LABELS,
  MEDIA_LANE_IDS,
  MEDIA_LANE_LABELS,
  MEDIA_WORKFLOW_STEPS,
  MAJOR_CATEGORIES,
  VIRTUAL_CAPABILITIES,
  applyTaxonomyToSkill,
} from './lib/capabilityHubTaxonomy.mjs';
import { HUB_SKILL_PACKS, hubPackToCatalogEntry } from './lib/capabilityHubPacks.mjs';
import { applyHubPinnedToSkill } from './lib/capabilityHubPinned.mjs';
import { mergeLaunchIntoSkill } from './lib/launchRegistry.mjs';
import {
  CAPABILITY_COPY_PLACEHOLDER,
  coalesceCapabilityCopy,
  isCapabilityCopyPlaceholder,
} from './lib/capabilityCopy.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const CONFIG_DIR = path.join(REPO_ROOT, 'config');
const HUB_ZH_PATH = path.join(CONFIG_DIR, 'capability-hub-zh.json');
const OVERRIDES_PATH = path.join(CONFIG_DIR, 'capabilities.overrides.json');
const RATINGS_PATH = path.join(CONFIG_DIR, 'skills-ecosystem-ratings.json');
const HERMES_META_PATH = path.join(CONFIG_DIR, 'hermes-edu-skills.meta.json');
const OUTPUT_PATH = path.join(CONFIG_DIR, 'capabilities.catalog.json');
const WELCOME_POOL_ZH_PATH = path.join(CONFIG_DIR, 'welcome-prompt-pool.zh-CN.json');

function loadWelcomePromptPoolForCatalog() {
  if (!existsSync(WELCOME_POOL_ZH_PATH)) {
    return { welcome_prompt_pool: [], welcome_prompt_display_count: 5 };
  }
  const parsed = readJson(WELCOME_POOL_ZH_PATH);
  const prompts = Array.isArray(parsed.prompts)
    ? parsed.prompts.filter((item) => typeof item === 'string' && item.trim())
    : [];
  return {
    welcome_prompt_pool: prompts,
    welcome_prompt_display_count: Number(parsed.display_count) > 0 ? Number(parsed.display_count) : 5,
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function loadSkillRatings() {
  if (!existsSync(RATINGS_PATH)) return {};
  try {
    const data = readJson(RATINGS_PATH);
    return data.skills && typeof data.skills === 'object' ? data.skills : {};
  } catch {
    return {};
  }
}

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
  return found.sort((a, b) => a.localeCompare(b));
}

function parseSkillFile(skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)\r?\n---/);
  let frontmatter = {};
  if (match) {
    try {
      frontmatter = parseYaml(match[1]) || {};
    } catch {
      // Some third-party SKILL.md files contain unquoted ":" in description
      // lines, which breaks strict YAML parsers. Keep going with regex
      // fallback so catalog generation never fails.
      const fallbackName = match[1].match(/^name:\s*(.+)$/m)?.[1];
      const fallbackDescription = match[1].match(/^description:\s*(.+)$/m)?.[1];
      frontmatter = {
        name: fallbackName ? fallbackName.trim() : undefined,
        description: fallbackDescription ? fallbackDescription.trim() : undefined,
      };
    }
  }
  const name = typeof frontmatter.name === 'string' && frontmatter.name.trim()
    ? frontmatter.name.trim()
    : path.basename(path.dirname(skillPath));
  const description = typeof frontmatter.description === 'string' && frontmatter.description.trim()
    ? frontmatter.description.trim()
    : CAPABILITY_COPY_PLACEHOLDER;

  return {
    name,
    description,
    frontmatter,
  };
}

function pickRule(skillSlug, rules, sourcePath = '') {
  const normalizedSource = String(sourcePath).replace(/\\/g, '/');
  for (const rule of rules || []) {
    if (rule.matchSourceIncludes && normalizedSource.includes(rule.matchSourceIncludes)) {
      return rule;
    }
    if (rule.matchSlug && rule.matchSlug === skillSlug) return rule;
    if (rule.matchPrefix && skillSlug.startsWith(rule.matchPrefix)) return rule;
    if (rule.matchContains && skillSlug.includes(rule.matchContains)) return rule;
  }
  return null;
}

function loadHermesMeta() {
  if (!existsSync(HERMES_META_PATH)) {
    return { skills: {} };
  }
  try {
    const raw = readJson(HERMES_META_PATH);
    return { skills: raw.skills || {} };
  } catch (error) {
    console.warn(
      '[capabilities-catalog] failed to load hermes meta:',
      error instanceof Error ? error.message : error,
    );
    return { skills: {} };
  }
}

function uniqStrings(values) {
  return Array.from(new Set((values || []).filter((value) => typeof value === 'string' && value.trim())));
}

function loadHubZhMeta() {
  if (!existsSync(HUB_ZH_PATH)) return {};
  try {
    return readJson(HUB_ZH_PATH).skills || {};
  } catch {
    return {};
  }
}

function enrichFromZhMeta(skill, zhMeta) {
  const entry = zhMeta[skill.slug];
  if (!entry) return skill;
  const zh = entry['zh-CN'] || entry;
  return {
    ...skill,
    display_name: zh.display_name || skill.display_name,
    task_summary: zh.task_summary || skill.task_summary,
    description: zh.description || skill.description,
    setup_hint: zh.setup_hint || skill.setup_hint,
    examples: Array.isArray(zh.examples) && zh.examples.length > 0 ? zh.examples : skill.examples,
  };
}

function dedupeSkillsBySlug(skills, skillOverrides = {}) {
  /** @type {Map<string, typeof skills[number]>} */
  const bySlug = new Map();
  const score = (skill) => {
    let s = 0;
    if (skillOverrides[skill.slug]) s += 100;
    if (typeof skill.rating === 'number') s += skill.rating;
    if (skill.source?.includes('anthropics-skills')) s += 1;
    if (skill.source?.includes('academic-research')) s += 0.5;
    return s;
  };
  for (const skill of skills) {
    const existing = bySlug.get(skill.slug);
    if (!existing || score(skill) > score(existing)) {
      bySlug.set(skill.slug, skill);
    }
  }
  return [...bySlug.values()];
}

function buildCatalog(overrides) {
  const skillDirs = discoverSkillDirs(SKILLS_ROOT);
  const stageMap = new Map((overrides.stages || []).map((stage) => [stage.id, stage]));
  const defaults = overrides.defaults || {};
  const rules = overrides.rules || [];
  const skillOverrides = overrides.skills || {};
  const hermesMeta = loadHermesMeta();
  const zhMeta = loadHubZhMeta();
  const skillRatings = loadSkillRatings();

  const skills = [];
  let enhancedCount = 0;
  let fallbackCount = 0;
  let uncategorizedCount = 0;

  for (const skillDir of skillDirs) {
    const slug = path.basename(skillDir);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const source = path.relative(REPO_ROOT, skillDir).replace(/\\/g, '/');
    const parsed = parseSkillFile(skillFile);
    const hermes = hermesMeta.skills[slug] || {};
    const explicit = { ...hermes, ...skillOverrides[slug] };
    const rule = pickRule(slug, rules, source) || {};

    const stage = explicit.stage || rule.stage || defaults.stage || 'uncategorized';
    const stageMeta = stageMap.get(stage) || stageMap.get('uncategorized');
    const secondaryStages = uniqStrings(explicit.secondary_stages || rule.secondary_stages || []);
    const audience = uniqStrings(explicit.audience || rule.audience || defaults.audience || []);
    const integrationLevel = explicit.integration_level || rule.integration_level || defaults.integration_level || 'L1';
    const displayName = explicit.display_name || explicit.name || parsed.name;

    const rawTaskSummary = explicit.task_summary || hermes.task_summary || parsed.description;
    const rawDescription = explicit.description || hermes.description || parsed.description;
    const coalesced = coalesceCapabilityCopy({
      description: rawDescription,
      taskSummary: rawTaskSummary,
      displayName,
      slug,
      name: parsed.name,
    });
    const taskSummary = coalesced.task_summary;
    const description = coalesced.description;
    const examples = uniqStrings(explicit.examples || overrides.welcome_examples?.[stage] || []);
    const hubSortOverride = typeof explicit.hub_sort === 'number' ? explicit.hub_sort : undefined;

    const isEnhanced = Boolean(skillOverrides[slug] || rule || hermes.slug);
    if (isEnhanced) enhancedCount += 1;
    else fallbackCount += 1;
    if (stage === 'uncategorized') uncategorizedCount += 1;

    const hubSort = hubSortOverride ?? computeHubSortPriority(slug, stage, { integration_level: integrationLevel });

    const educationBands =
      stage === 'education'
        ? resolveEducationBands(slug, parsed.frontmatter, explicit.education_bands)
        : [];

    let skillEntry = {
      slug,
      name: parsed.name,
      display_name: displayName,
      description,
      task_summary: taskSummary,
      stage,
      stage_label: stageMeta?.label || '待归类',
      stage_order: stageMeta?.stage_order ?? 7,
      secondary_stages: secondaryStages,
      secondary_task_groups: uniqStrings(explicit.secondary_task_groups || []),
      education_bands: educationBands,
      audience,
      integration_level: integrationLevel,
      hub_sort: hubSort,
      examples,
      source: path.relative(REPO_ROOT, skillDir).replace(/\\/g, '/'),
      secondary_categories: uniqStrings(explicit.secondary_categories || []),
      availability: explicit.availability || 'available',
      setup_hint: explicit.setup_hint || '',
      task_group: explicit.task_group || undefined,
      major_category: explicit.major_category || undefined,
      category_subtag: explicit.category_subtag || undefined,
      hidden_in_hub: Boolean(explicit.hidden_in_hub),
    };

    skillEntry = applyTaxonomyToSkill(skillEntry);
    if (skillEntry.stage === 'education' && explicit.education_bands) {
      skillEntry.education_bands = resolveEducationBands(slug, parsed.frontmatter, explicit.education_bands);
    }
    skillEntry = applyHubPinnedToSkill(skillEntry);
    skillEntry = enrichFromZhMeta(skillEntry, zhMeta);
    const rating = typeof explicit.rating === 'number' ? explicit.rating : skillRatings[slug];
    if (typeof rating === 'number' && rating > 0) {
      skillEntry.rating = rating;
    }
    skills.push(mergeLaunchIntoSkill(skillEntry));
  }

  const deduped = dedupeSkillsBySlug(skills, skillOverrides);
  skills.length = 0;
  skills.push(...deduped);

  const runtimeSlugs = new Set(skills.map((s) => s.slug));

  for (const pack of HUB_SKILL_PACKS) {
    if (runtimeSlugs.has(pack.slug)) continue;
    let skillEntry = applyTaxonomyToSkill(hubPackToCatalogEntry(pack, stageMap));
    skillEntry = enrichFromZhMeta(skillEntry, zhMeta);
    const pr = skillRatings[pack.slug];
    if (typeof pr === 'number' && pr > 0) skillEntry.rating = pr;
    skills.push(mergeLaunchIntoSkill(skillEntry));
    runtimeSlugs.add(pack.slug);
  }

  for (const virtual of VIRTUAL_CAPABILITIES) {
    if (runtimeSlugs.has(virtual.slug)) continue;
    const stageMeta = stageMap.get(virtual.stage) || stageMap.get('uncategorized');
    let skillEntry = applyTaxonomyToSkill({
      slug: virtual.slug,
      name: virtual.slug,
      display_name: virtual.display_name,
      description: virtual.description,
      task_summary: virtual.task_summary,
      stage: virtual.stage,
      stage_label: stageMeta?.label || '待归类',
      stage_order: stageMeta?.stage_order ?? 7,
      secondary_stages: [],
      secondary_task_groups: virtual.secondary_task_groups || [],
      education_bands: [],
      audience: defaults.audience || [],
      integration_level: virtual.integration_level || 'L1',
      hub_sort: virtual.hub_sort ?? 500,
      examples: virtual.examples || [],
      source: virtual.source || 'virtual',
      secondary_categories: virtual.secondary_categories || [],
      availability: virtual.availability || 'pending',
      setup_hint: virtual.setup_hint || '',
      task_group: virtual.task_group,
      major_category: virtual.major_category,
      category_subtag: virtual.category_subtag,
      hidden_in_hub: false,
      // PD-SAAS-FORK: 企业合规等 virtual 卡声明绑定原子 skill，供验收/read_skill
      ...(Array.isArray(virtual.skill_binds) ? { skill_binds: virtual.skill_binds } : {}),
    });
    skillEntry = enrichFromZhMeta(skillEntry, zhMeta);
    const vr = skillRatings[virtual.slug];
    if (typeof vr === 'number' && vr > 0) skillEntry.rating = vr;
    skills.push(mergeLaunchIntoSkill(skillEntry));
  }

  for (let i = 0; i < skills.length; i += 1) {
    skills[i] = applyHubPinnedToSkill(skills[i]);
  }

  skills.sort(compareCapabilitiesForHub);

  const stageCounts = {};
  for (const stage of overrides.stages || []) {
    stageCounts[stage.id] = 0;
  }
  for (const skill of skills) {
    stageCounts[skill.stage] = (stageCounts[skill.stage] || 0) + 1;
  }

  const educationBandCounts = countEducationBandSkills(skills);
  const educationBandMeta = (overrides.education_bands || []).map((band) => ({
    ...band,
    count: educationBandCounts[band.id] || 0,
  }));

  const welcomePool = loadWelcomePromptPoolForCatalog();

  const geoFlywheelStages = GEO_FLYWHEEL_STAGE_IDS.map((id) => ({
    id,
    ...GEO_STAGE_LABELS[id],
  }));

  const mediaLanes = MEDIA_LANE_IDS.map((id) => ({
    id,
    ...MEDIA_LANE_LABELS[id],
  }));

  return {
    generated_at: new Date().toISOString(),
    version: 2,
    stages: overrides.stages || [],
    education_bands: educationBandMeta,
    flywheel_task_groups: FLYWHEEL_TASK_GROUPS,
    geo_task_groups: GEO_TASK_GROUPS,
    geo_flywheel_stages: geoFlywheelStages,
    media_lanes: mediaLanes,
    media_workflow_steps: MEDIA_WORKFLOW_STEPS,
    major_categories: MAJOR_CATEGORIES,
    welcome_examples: overrides.welcome_examples || {},
    welcome_prompt_pool: welcomePool.welcome_prompt_pool,
    welcome_prompt_display_count: welcomePool.welcome_prompt_display_count,
    report: {
      total_skills: skills.length,
      enhanced_skills: enhancedCount,
      fallback_skills: fallbackCount,
      uncategorized_skills: uncategorizedCount,
      missing_skills: 0,
      stage_counts: stageCounts,
      education_band_counts: educationBandCounts,
    },
    skills,
  };
}

function main() {
  if (!existsSync(OVERRIDES_PATH)) {
    throw new Error(`overrides file not found: ${OVERRIDES_PATH}`);
  }

  const overrides = readJson(OVERRIDES_PATH);
  const catalog = buildCatalog(overrides);

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

  const uiGeneratedDir = path.join(REPO_ROOT, 'ui', 'src', 'generated');
  mkdirSync(uiGeneratedDir, { recursive: true });
  const uiCatalogPath = path.join(uiGeneratedDir, 'capabilities.catalog.json');
  writeFileSync(uiCatalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  const launchRegistryPath = path.join(REPO_ROOT, 'config', 'launch-registry.json');
  if (existsSync(launchRegistryPath)) {
    writeFileSync(
      path.join(uiGeneratedDir, 'launch-registry.json'),
      `${readFileSync(launchRegistryPath, 'utf8').trim()}\n`,
      'utf8',
    );
  }
  if (existsSync(WELCOME_POOL_ZH_PATH)) {
    writeFileSync(
      path.join(uiGeneratedDir, 'welcome-prompt-pool.json'),
      `${readFileSync(WELCOME_POOL_ZH_PATH, 'utf8').trim()}\n`,
      'utf8',
    );
  }

  const report = catalog.report;
  console.log('[capabilities-catalog] generated');
  console.log(`[capabilities-catalog] total=${report.total_skills}`);
  console.log(`[capabilities-catalog] enhanced=${report.enhanced_skills}`);
  console.log(`[capabilities-catalog] fallback=${report.fallback_skills}`);
  console.log(`[capabilities-catalog] uncategorized=${report.uncategorized_skills}`);
  console.log(`[capabilities-catalog] missing=${report.missing_skills}`);
  console.log(`[capabilities-catalog] output=${OUTPUT_PATH}`);
}

main();
