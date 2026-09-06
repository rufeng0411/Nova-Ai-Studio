#!/usr/bin/env node
/**
 * Runtime verification: batch skills in pilot home, PluginRuntime load, Hub filters, binding prompts.
 * Run: npx tsx scripts/integration-skills-batch-runtime.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill, matchesHubFilter } from './lib/capabilityHubTaxonomy.mjs';
import { TRY_PROMPT_ZH } from './lib/capabilityTryPrompts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const I18N_PATH = path.join(ROOT, 'config', 'capabilities.i18n.json');
const REPORT_DIR = path.join(ROOT, 'artifacts', 'capabilities-smoke');
const REPORT_PATH = path.join(REPORT_DIR, 'skills-batch-runtime.json');

const RUNTIME_SLUGS = [
  'html-ppt',
  'fc-firecrawl-cli',
  'fc-firecrawl-search',
  'web-just-scrape',
  'create-frontend-design',
  'create-ui-ux-pro-max',
  'create-ai-video-gen',
  'edu-fun-caveman',
  'legal-risk-assessment',
  'legal-response',
  'brainstorm-structured',
  'remotion-best-practices',
  'mcp-firecrawl',
  'mcp-playwright',
];

const HUB_SPOT_CHECKS = [
  { slug: 'web-just-scrape', major: 'marketing', stage: 'research', taskGroup: 'web_fetch' },
  { slug: 'fc-firecrawl-cli', major: 'marketing', stage: 'research', taskGroup: 'web_fetch' },
  { slug: 'create-ui-ux-pro-max', major: 'creation', stage: 'creation', subtag: 'create_web' },
  { slug: 'create-ai-video-gen', major: 'creation', stage: 'creation', subtag: 'create_video' },
  { slug: 'edu-fun-caveman', major: 'education', stage: 'education', band: 'edu_fun' },
  { slug: 'legal-risk-assessment', major: 'office', stage: 'office', subtag: 'legal_compliance' },
  { slug: 'mcp-playwright', major: 'development', stage: 'development', subtag: 'dev_test' },
  { slug: 'mkt-sales-enablement', major: 'marketing', stage: 'activate', taskGroup: 'sales_enablement' },
];

function buildBindingPrompt(slug, displayName) {
  return [
    '<capability-binding>',
    `用户在能力中心选择了能力「${displayName}」（skill: ${slug}）。`,
    '必须先 read_skill 加载该技能并按其执行，不要改用其他无关技能。',
    '无需重复说明任务来源；缺关键输入时再提问；产出文件后在对话中给出可点击路径。',
    '</capability-binding>',
  ].join('');
}

function pilotHome() {
  return process.env.PILOT_HOME || path.join(homedir(), '.pilotdeck');
}

function hubVisible(skill) {
  if (skill.hidden_in_hub) return false;
  if (skill.integration_level === 'hidden') return false;
  return true;
}

async function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
  const bySlug = new Map((catalog.skills || []).map((s) => [s.slug, s]));

  let PluginRuntime;
  try {
    ({ PluginRuntime } = await import('../src/extension/plugins/runtime/PluginRuntime.js'));
  } catch {
    try {
      ({ PluginRuntime } = await import('../dist/extension/plugins/runtime/PluginRuntime.js'));
    } catch (e) {
      console.warn('[batch-runtime] PluginRuntime unavailable:', e.message);
    }
  }

  let runtime;
  if (PluginRuntime) {
    runtime = new PluginRuntime({ projectRoot: ROOT, pilotHome: pilotHome() });
    await runtime.refresh();
  }

  const checks = [];
  const failures = [];

  for (const slug of RUNTIME_SLUGS) {
    const row = { slug, ok: true, issues: [] };
    const catalogEntry = bySlug.get(slug);
    const isVirtual = String(catalogEntry?.source || '').startsWith('mcp:');

    if (!catalogEntry) {
      row.issues.push('missing_catalog');
    } else {
      const taxed = applyTaxonomyToSkill({ ...catalogEntry });
      row.hub_visible = hubVisible(taxed);
      if (row.hub_visible) {
        if (!TRY_PROMPT_ZH[slug]) row.issues.push('missing_try_prompt');
        if (!i18n.skills?.[slug]?.['zh-CN']?.examples?.[0]) row.issues.push('missing_i18n_example');
        const displayName = i18n.skills?.[slug]?.['zh-CN']?.display_name || catalogEntry.display_name || slug;
        const binding = buildBindingPrompt(slug, displayName);
        if (!binding.includes(slug) || !binding.includes('<capability-binding>')) {
          row.issues.push('binding_bad');
        }
      }
    }

    if (!isVirtual) {
      const skillMd = path.join(pilotHome(), 'skills', slug, 'SKILL.md');
      if (!existsSync(skillMd)) row.issues.push('missing_pilot_home');
      else row.pilot_home_skill = true;

      if (runtime) {
        const dir = runtime.resolveSkillDirectory(slug);
        if (!dir) row.issues.push('plugin_runtime_unresolved');
        else {
          row.plugin_runtime_dir = true;
          const prompt = await runtime.loadSkillPrompt(slug);
          if (!prompt || prompt.length < 40) row.issues.push('loadSkillPrompt_empty');
          else row.read_skill_chars = prompt.length;
        }
      }
    } else {
      row.virtual_mcp = true;
    }

    if (row.issues.length) {
      row.ok = false;
      failures.push(`${slug}: ${row.issues.join(',')}`);
    }
    checks.push(row);
  }

  for (const spot of HUB_SPOT_CHECKS) {
    const entry = bySlug.get(spot.slug);
    if (!entry) {
      failures.push(`hub/${spot.slug}: missing_catalog`);
      checks.push({ slug: spot.slug, hub_filter: false, ok: false });
      continue;
    }
    const item = applyTaxonomyToSkill({ ...entry });
    if (!hubVisible(item)) {
      failures.push(`hub/${spot.slug}: not_visible`);
      checks.push({ slug: spot.slug, hub_filter: false, ok: false });
      continue;
    }
    let matches = false;
    if (spot.major === 'education') {
      matches = item.stage === 'education' && (item.education_bands || []).includes(spot.band);
    } else if (spot.major === 'marketing') {
      matches = matchesHubFilter(item, 'marketing', spot.stage, '', spot.taskGroup, 'all');
    } else {
      matches = matchesHubFilter(item, spot.major, spot.stage, '', 'all', spot.subtag || 'all');
    }
    if (!matches) failures.push(`hub/${spot.slug}: filter_miss`);
    checks.push({ slug: spot.slug, hub_filter: matches, ok: matches });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    ok: failures.length === 0,
    pilot_home: pilotHome(),
    plugin_runtime: Boolean(runtime),
    failures,
    checks,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[batch-runtime] ok=${report.ok} failures=${failures.length}`);
  console.log(`[batch-runtime] report=${REPORT_PATH}`);
  if (failures.length) {
    for (const f of failures) console.error(`[batch-runtime] ${f}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('[batch-runtime] fatal:', e);
  process.exitCode = 1;
});
