#!/usr/bin/env node
/**
 * Deep per-skill evaluation: stars, reasons, system fit, alternatives.
 * Output: artifacts/capabilities-smoke/skills-deep-rating.json
 *         docs/skills-deep-rating-report-2026-06-10.zh-CN.md
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLYWHEEL_STAGE_IDS,
  FLYWHEEL_TASK_GROUPS,
  MAJOR_CATEGORIES,
  applyTaxonomyToSkill,
} from './lib/capabilityHubTaxonomy.mjs';
import { buildDeepEvaluation, starsLabel } from './lib/skillDeepEval.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const I18N_PATH = path.join(ROOT, 'config', 'capabilities.i18n.json');
const HUB_ZH_PATH = path.join(ROOT, 'config', 'capability-hub-zh.json');
const MANUAL_RATINGS_PATH = path.join(ROOT, 'config', 'skills-ecosystem-ratings.json');
const SKILLS_ROOT = path.join(ROOT, 'skills');
const OUT_JSON = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'skills-deep-rating.json');
const OUT_MD = path.join(ROOT, 'docs', 'skills-deep-rating-report-2026-06-10.zh-CN.md');

const STAGE_LABELS = {
  research: '调研',
  strategy: '策划',
  create: '创意',
  activate: '触达',
  distribute: '发布',
  measure: '监测',
};

const RISK_PATTERNS = [
  { id: 'read_file_skills', re: /read_file[`\s→]*[`\s]*skills\//gi, severity: 'high' },
  { id: 'python_skills', re: /python\s+skills\//gi, severity: 'high' },
  { id: 'node_scripts', re: /node\s+scripts\/[\w.-]+\.mjs/gi, severity: 'medium' },
  { id: 'bash_curl', re: /\b(bash|curl|grep|findstr)\b/gi, severity: 'medium' },
];

const VERIFIED_SLUGS = new Set([
  'anth-docx', 'pd-document-export', 'tool-compose-images-to-document', 'tool-ocr-to-editable-pptx',
  'nova-ppt-aesthetic-slides', 'nova-customer-acquisition-leads', 'nova-research-general',
  'yixiaoer', 'social-creative-matrix', 'pd-geo', 'geo-rank-track', 'geo-aeo-audit',
  'hf-hyperframes', 'hf-website-to-video', 'frontend-slides', 'remotion-video',
  'tool-generate-video', 'tool-generate-image', 'tool-render-html-video', 'tool-web-search',
  'humanizer', 'unslop', 'mkt-brand-video', 'mkt-dmp-video-script',
  'create-vid-scriptwriting', 'create-vid-saas-demo-script', 'create-vid-seedance-prompt',
  'create-vid-director', 'create-vid-visual-prompt', 'create-vid-storyboard-pack',
  'create-vid-seedance-series', 'create-vid-seedance-codec', 'create-vid-viral-copy',
  'open-design', 'od-pricing-page', 'od-data-report',
]);

function walkSkillMd(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkSkillMd(full, out);
    else if (e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

function buildRiskIndex(skillMdFiles) {
  const byRelSource = new Map();
  for (const file of skillMdFiles) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const text = readFileSync(file, 'utf8');
    const flags = { high: 0, medium: 0 };
    for (const pat of RISK_PATTERNS) {
      for (const line of text.split('\n')) {
        if (!pat.re.test(line)) continue;
        if (pat.id === 'read_file_skills' && /禁止|勿|不要|do not/i.test(line)) continue;
        flags[pat.severity] += 1;
      }
      pat.re.lastIndex = 0;
    }
    byRelSource.set(rel.replace(/\/SKILL\.md$/, ''), flags);
    byRelSource.set(`skills/${path.basename(path.dirname(file))}`, flags);
  }
  return byRelSource;
}

function getHubBucket(skill) {
  const item = applyTaxonomyToSkill({ ...skill });
  const major = item.major_category || 'marketing';
  if (major === 'marketing' && FLYWHEEL_STAGE_IDS.includes(item.stage || '')) {
    const stage = item.stage || 'research';
    const tg = item.task_group || 'general';
    const groups = FLYWHEEL_TASK_GROUPS[stage] || [];
    const tgMeta = groups.find((g) => g.id === tg) || { label: tg, group_order: 99 };
    return {
      sortKey: `1-marketing-${FLYWHEEL_STAGE_IDS.indexOf(stage)}-${String(tgMeta.group_order).padStart(2, '0')}-${item.hub_sort ?? 999}-${item.slug}`,
      section: `营销飞轮 · ${STAGE_LABELS[stage] || stage} · ${tgMeta.label}`,
      major: 'marketing',
    };
  }
  if (major === 'education' || item.stage === 'education') {
    const band = (item.education_bands || [])[0] || 'general';
    return {
      sortKey: `6-education-${band}-${item.hub_sort ?? 999}-${item.slug}`,
      section: `教育学习 · ${band}`,
      major: 'education',
    };
  }
  if (major === 'brainstorming' || item.stage === 'brainstorming') {
    const sub = item.category_subtag || 'general';
    return {
      sortKey: `5-brainstorming-${sub}-${item.hub_sort ?? 999}-${item.slug}`,
      section: `脑暴 · ${sub}`,
      major: 'brainstorming',
    };
  }
  const meta = MAJOR_CATEGORIES[major];
  const subtags = meta?.subtags || [];
  const sub = item.category_subtag || 'general';
  const subLabel = subtags.find((s) => s.id === sub)?.label || sub;
  const order = { office: 2, creation: 3, development: 4 }[major] || 9;
  return {
    sortKey: `${order}-${major}-${sub}-${item.hub_sort ?? 999}-${item.slug}`,
    section: `${meta?.label || major} · ${subLabel}`,
    major,
  };
}

function resolveZhName(skill, hubZh, i18n) {
  return hubZh[skill.slug]?.['zh-CN']?.display_name
    || hubZh[skill.slug]?.display_name
    || i18n[skill.slug]?.['zh-CN']?.display_name
    || skill.display_name
    || skill.slug;
}

function escapeCell(value) {
  return String(value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '—';
}

function formatAlternativesShort(alts) {
  if (!alts?.length) return '—';
  return alts.map((a) => `\`${a.slug}\``).join('、');
}

function formatReasonsShort(reasons) {
  if (!reasons?.length) return '—';
  return reasons.slice(0, 5).join('；');
}

function sortForTable(rows) {
  const sectionOrder = [];
  const seen = new Set();
  for (const r of rows) {
    if (!seen.has(r.section)) {
      seen.add(r.section);
      sectionOrder.push(r.section);
    }
  }
  const bySection = new Map(sectionOrder.map((s) => [s, []]));
  for (const r of rows) bySection.get(r.section)?.push(r);
  const out = [];
  for (const section of sectionOrder) {
    const items = bySection.get(section) || [];
    items.sort(
      (a, b) =>
        b.stars - a.stars
        || b.score - a.score
        || (a.hub_sort ?? 999) - (b.hub_sort ?? 999)
        || a.display_name.localeCompare(b.display_name, 'zh-CN'),
    );
    out.push(...items);
  }
  return out;
}

function tableRow(r) {
  const fitLabel = { high: '高', medium: '中', low: '低' }[r.system_fit] || r.system_fit;
  const hub = r.hidden_in_hub ? '隐藏' : '可见';
  const level = `${r.integration_level || 'L1'}`;
  const avail =
    r.availability === 'needs_config' ? '需配置' : r.availability === 'ready' ? '待确认' : '可用';
  return [
    escapeCell(r.section),
    starsLabel(r.stars),
    escapeCell(r.display_name),
    `\`${r.slug}\``,
    level,
    hub,
    fitLabel,
    escapeCell(r.usage_label),
    formatAlternativesShort(r.alternatives),
    escapeCell(formatReasonsShort(r.reasons)),
    escapeCell(r.misalignments?.join('；') || '—'),
  ].join(' | ');
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8')).skills || {};
  const hubZh = (existsSync(HUB_ZH_PATH) ? JSON.parse(readFileSync(HUB_ZH_PATH, 'utf8')).skills : {}) || {};
  const manualRatings = (existsSync(MANUAL_RATINGS_PATH)
    ? JSON.parse(readFileSync(MANUAL_RATINGS_PATH, 'utf8')).skills
    : {}) || {};

  const skillMdFiles = walkSkillMd(SKILLS_ROOT);
  const riskBySource = buildRiskIndex(skillMdFiles);

  const displayBySlug = new Map();
  for (const skill of catalog.skills || []) {
    displayBySlug.set(skill.slug, resolveZhName(skill, hubZh, i18n));
  }

  const ctx = {
    i18n,
    hubZh,
    manualRatings,
    riskBySource,
    verified: VERIFIED_SLUGS,
    skillsRoot: SKILLS_ROOT,
    repoRoot: ROOT,
    displayBySlug,
  };

  const rated = (catalog.skills || []).map((skill) => {
    const bucket = getHubBucket(skill);
    const display_name = resolveZhName(skill, hubZh, i18n);
    const evaluation = buildDeepEvaluation({ ...skill, display_name }, ctx);
    return {
      slug: skill.slug,
      display_name,
      section: bucket.section,
      sortKey: bucket.sortKey,
      major: bucket.major,
      stage: skill.stage,
      task_group: skill.task_group,
      category_subtag: skill.category_subtag,
      integration_level: skill.integration_level,
      availability: skill.availability,
      hidden_in_hub: Boolean(skill.hidden_in_hub),
      source: skill.source,
      hub_sort: skill.hub_sort,
      score: evaluation.score,
      stars: evaluation.stars,
      system_fit: evaluation.system_fit,
      usage_advice: evaluation.usage_advice,
      usage_label: evaluation.usage_label,
      reasons: evaluation.reasons,
      misalignments: evaluation.misalignments,
      alternatives: evaluation.alternatives,
      has_skill_md: evaluation.has_skill_md,
    };
  });

  rated.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'zh-CN'));

  const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const hubVisible = rated.filter((r) => !r.hidden_in_hub);
  for (const r of rated) starCounts[r.stars] += 1;

  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total: rated.length,
        hub_visible: hubVisible.length,
        star_counts: starCounts,
        methodology: 'per-skill: SKILL.md + availability + SaaS exec risk + i18n + alternatives + system fit',
        skills: rated,
      },
      null,
      2,
    ),
    'utf8',
  );

  const lines = [];
  lines.push('# Skills 逐项深度评估报告（全库）');
  lines.push('');
  lines.push(`> 生成时间：${new Date().toISOString()} · 共 **${rated.length}** 项 · Hub 可见 **${hubVisible.length}** 项`);
  lines.push('');
  lines.push('## 如何使用本报告');
  lines.push('');
  lines.push('- 每项含：**星级**、**系统契合度**、**使用建议**、**替代方案**、**评分原因**、**与 Nova/PilotDeck 不切合点**');
  lines.push('- **系统契合**：高 = 对话+read_skill+artifacts 主路径；中 = 需 Key 或轻微脚本；低 = 重复包/高风险指引/不宜 SaaS');
  lines.push('- **使用建议**：主力使用 / 配置 Key 后 / 经能力包 / 已被替代 / 专家向 / 不建议');
  lines.push('- 机器可读全量 JSON：`artifacts/capabilities-smoke/skills-deep-rating.json`');
  lines.push('');
  lines.push('## 星级含义');
  lines.push('');
  lines.push('| 星级 | 含义 |');
  lines.push('|------|------|');
  lines.push('| ★★★★★ | 生产主力：L1、规范齐全、与平台交付链一致，多数有 smoke |');
  lines.push('| ★★★★☆ | 可靠可用：可独立使用，有小依赖或分类/i18n 问题 |');
  lines.push('| ★★★☆☆ | 条件可用：需 Key、MCP、L2 CLI，或 SKILL 指引与 SaaS 部分不符 |');
  lines.push('| ★★☆☆☆ | 高摩擦：隐藏子卡、强脚本依赖，仅包入口或专家场景 |');
  lines.push('| ★☆☆☆☆ | **不可用**：重复镜像、缺 SKILL、应改用替代项 |');
  lines.push('');
  lines.push('## 总览');
  lines.push('');
  lines.push('| 星级 | 数量 | 占比 |');
  lines.push('|------|------|------|');
  for (const n of [5, 4, 3, 2, 1]) {
    const c = starCounts[n];
    lines.push(`| ${starsLabel(n)} | ${c} | ${((c / rated.length) * 100).toFixed(1)}% |`);
  }
  lines.push('');

  const tableRows = sortForTable(rated);
  const TABLE_HEADER =
    '| 类别 | 星级 | 名称 | slug | 级别 | Hub | 系统契合 | 使用建议 | 替代方案 | 评分原因 | 与系统不切合 |';
  const TABLE_SEP =
    '|------|------|------|------|------|-----|----------|----------|----------|----------|--------------|';

  lines.push('---');
  lines.push('');
  lines.push('## 全库大表（按类别 → 星级降序，每项一行）');
  lines.push('');
  lines.push(TABLE_HEADER);
  lines.push(TABLE_SEP);
  for (const r of tableRows) {
    lines.push(`| ${tableRow(r)} |`);
  }
  lines.push('');

  writeFileSync(OUT_MD, lines.join('\n'), 'utf8');

  console.log('[skills-deep-rating] OK');
  console.log(`[skills-deep-rating] total=${rated.length} hub_visible=${hubVisible.length}`);
  console.log(`[skills-deep-rating] stars=${JSON.stringify(starCounts)}`);
  console.log(`[skills-deep-rating] md=${OUT_MD}`);
  console.log(`[skills-deep-rating] json=${OUT_JSON}`);
}

main();
