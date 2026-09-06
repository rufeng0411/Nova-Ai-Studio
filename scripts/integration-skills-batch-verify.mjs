#!/usr/bin/env node
/**
 * Verify skills-mcp batch selections (phases 1–3): disk, catalog, hub, try-prompts.
 * Run: node scripts/integration-skills-batch-verify.mjs
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill, matchesHubFilter } from './lib/capabilityHubTaxonomy.mjs';
import { TRY_PROMPT_ZH } from './lib/capabilityTryPrompts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH_PATH = path.join(ROOT, 'config', 'skills-selection-batch.json');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const I18N_PATH = path.join(ROOT, 'config', 'capabilities.i18n.json');
const SKILLS_ROOT = path.join(ROOT, 'skills');
const REPORT_DIR = path.join(ROOT, 'artifacts', 'capabilities-smoke');
const REPORT_PATH = path.join(REPORT_DIR, 'skills-batch-verify.json');

/** Only phases user committed to install in this batch. */
const INSTALLED_PHASES = new Set(['p1', 'p2', 'p3']);

const SLUG_ALIASES = {
  'fc-firecrawl': ['fc-firecrawl-cli', 'fc-firecrawl-search'],
  'dev-playwright-mcp': ['mcp-playwright'],
};

const HUB_SUBTAG_ALIASES = {
  create_ui: 'create_web',
  dev_testing: 'dev_test',
};

function discoverSkillDir(slug) {
  const stack = [SKILLS_ROOT];
  while (stack.length) {
    const dir = stack.pop();
    if (path.basename(dir) === slug && existsSync(path.join(dir, 'SKILL.md'))) {
      return path.relative(ROOT, dir).replace(/\\/g, '/');
    }
    try {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) stack.push(path.join(dir, e.name));
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  return null;
}

function resolveSlugs(item, catalogSlugs) {
  if (item.slug && SLUG_ALIASES[item.slug]) return SLUG_ALIASES[item.slug];
  if (item.catalogSlug && SLUG_ALIASES[item.catalogSlug]) return SLUG_ALIASES[item.catalogSlug];
  if (Array.isArray(item.slugs)) {
    return item.slugs.flatMap((s) => SLUG_ALIASES[s] || [s]);
  }
  if (item.slug) return [item.slug];
  if (item.catalogSlug) return [item.catalogSlug];
  if (item.existingSlug) return [item.existingSlug];
  if (item.slugPrefix && item.hiddenInHub) {
    return catalogSlugs.filter((slug) => slug.startsWith('legal-lav-')).slice(0, 2);
  }
  if (item.slugPrefix && item.action === 'upgrade') {
    return [];
  }
  if (item.slugPrefix) {
    return catalogSlugs.filter((slug) => slug.startsWith(item.slugPrefix));
  }
  return [];
}

const HUB_MAJOR_ALIASES = {
  brainstorm: 'brainstorming',
};

function parseHubTarget(hub) {
  if (!hub) return null;
  const [majorRaw, subRaw] = hub.split('.');
  const major = HUB_MAJOR_ALIASES[majorRaw] || majorRaw;
  const sub = HUB_SUBTAG_ALIASES[subRaw] || subRaw;
  return { major, sub };
}

function isVisibleInHub(skill) {
  const item = applyTaxonomyToSkill({ ...skill });
  if (item.hidden_in_hub) return false;
  if (item.integration_level === 'hidden') return false;
  return true;
}

function hubMatches(skill, hubTarget) {
  if (!hubTarget) return true;
  const item = applyTaxonomyToSkill({ ...skill });
  const { major, sub } = hubTarget;

  if (major === 'marketing') {
    const taskGroupMap = {
      web_fetch: { stage: 'research', taskGroup: 'web_fetch' },
      sales_enablement: { stage: 'activate', taskGroup: 'sales_enablement' },
    };
    const mapped = taskGroupMap[sub] || { stage: 'research', taskGroup: sub };
    return matchesHubFilter(item, 'marketing', mapped.stage, '', mapped.taskGroup, 'all');
  }
  if (major === 'office' || major === 'creation' || major === 'development' || major === 'brainstorming') {
    return matchesHubFilter(item, major, major, '', 'all', sub || 'all');
  }
  if (major === 'education') {
    return item.stage === 'education' && (item.education_bands || []).includes(sub);
  }
  return item.major_category === major || item.stage === major;
}

function isCatalogOnlySkill(skill) {
  const source = String(skill?.source || '');
  return source.startsWith('virtual:') || source.startsWith('builtin:') || source.startsWith('mcp:');
}

function installedSelectionIds(batch) {
  const ids = new Set();
  for (const phase of batch.phases || []) {
    if (!INSTALLED_PHASES.has(phase.id)) continue;
    for (const taskId of phase.tasks || []) ids.add(taskId);
  }
  return ids;
}

function main() {
  const batch = JSON.parse(readFileSync(BATCH_PATH, 'utf8'));
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
  const catalogSlugs = (catalog.skills || []).map((s) => s.slug);
  const bySlug = new Map((catalog.skills || []).map((s) => [s.slug, s]));
  const installedIds = installedSelectionIds(batch);

  const checks = [];
  const failures = [];

  const actionable = (batch.selections || []).filter((item) =>
    installedIds.has(item.id) && ['install', 'upgrade', 'mcp_connect', 'reclassify'].includes(item.action),
  );

  for (const item of actionable) {
    const slugs = resolveSlugs(item, catalogSlugs);
    const expectHidden = Boolean(item.hiddenInHub);
    const isUpgradePrefix = item.action === 'upgrade' && item.slugPrefix && !item.slug;

    if (isUpgradePrefix) {
      checks.push({ id: item.id, action: item.action, ok: true, note: 'upgrade_prefix_skipped' });
      continue;
    }

    for (const slug of slugs) {
      const row = { id: item.id, action: item.action, slug, ok: true, issues: [] };
      const catalogEntry = bySlug.get(slug);
      const hubTarget = parseHubTarget(item.hub);
      const isMcpVirtual = item.action === 'mcp_connect';

      if (!catalogEntry) {
        row.ok = false;
        row.issues.push('missing_in_catalog');
      } else {
        const skillPath = discoverSkillDir(slug);
        if (!isMcpVirtual && !isCatalogOnlySkill(catalogEntry) && !skillPath && !expectHidden) {
          if (item.action === 'install' || item.slug || item.existingSlug) {
            row.ok = false;
            row.issues.push('skill_dir_missing');
          }
        } else if (skillPath) {
          row.skill_path = skillPath;
        }

        const visible = isVisibleInHub(catalogEntry);
        row.visible_in_hub = visible;
        row.hidden_in_hub = Boolean(applyTaxonomyToSkill({ ...catalogEntry }).hidden_in_hub);

        if (expectHidden && visible) row.issues.push('expected_hidden_but_visible');
        if (!expectHidden && item.hub && visible && !hubMatches(catalogEntry, hubTarget)) {
          row.issues.push('hub_filter_mismatch');
        }

        if (visible && !expectHidden && (item.action === 'install' || item.action === 'mcp_connect' || item.action === 'reclassify')) {
          const prompt = TRY_PROMPT_ZH[slug];
          const example = i18n.skills?.[slug]?.['zh-CN']?.examples?.[0];
          if (!prompt) row.issues.push('missing_try_prompt');
          if (!example) row.issues.push('missing_i18n_example');
          if (prompt && example && prompt !== example) row.issues.push('try_prompt_i18n_mismatch');
        }
      }

      if (row.issues.length) {
        row.ok = false;
        failures.push(`${item.id}/${slug}: ${row.issues.join(',')}`);
      }
      checks.push(row);
    }
  }

  for (const pill of batch.newTaxonomyPills || []) {
    const seedSlugs = pill.seedSlugs || pill.hubVisibleSlugs || [];
    for (const slug of seedSlugs) {
      const entry = bySlug.get(slug);
      if (!entry) {
        failures.push(`pill/${pill.id}/${slug}: missing_in_catalog`);
        checks.push({ pill: pill.id, slug, ok: false, issues: ['missing_in_catalog'] });
        continue;
      }
      const taxed = applyTaxonomyToSkill({ ...entry });
      let visibleOk = isVisibleInHub(entry);
      if (pill.tab === 'marketing' && pill.id === 'sales_enablement') {
        visibleOk = matchesHubFilter(taxed, 'marketing', 'activate', '', 'sales_enablement', 'all');
      }
      if (!visibleOk) {
        failures.push(`pill/${pill.id}/${slug}: hub_placement_miss`);
        checks.push({ pill: pill.id, slug, ok: false, issues: ['hub_placement_miss'] });
      } else {
        checks.push({ pill: pill.id, slug, ok: true, issues: [] });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: failures.length === 0,
    phases: [...INSTALLED_PHASES],
    total_checks: checks.length,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
    failures,
    checks,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[batch-verify] ok=${report.ok} passed=${report.passed}/${report.total_checks}`);
  console.log(`[batch-verify] report=${REPORT_PATH}`);
  if (failures.length) {
    for (const f of failures.slice(0, 40)) console.error(`[batch-verify] ${f}`);
    process.exitCode = 1;
  }
}

main();
