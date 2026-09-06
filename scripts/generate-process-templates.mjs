#!/usr/bin/env node
/**
 * Validate config/process-templates.json and emit UI bundle + catalog doc.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyHubPinnedToTemplate } from './lib/capabilityHubPinned.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'config', 'process-templates.json');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const OUT_JSON = path.join(REPO_ROOT, 'ui', 'src', 'generated', 'process-templates.json');
const OUT_DOC = path.join(REPO_ROOT, 'docs', 'process-templates-catalog.zh-CN.md');

const VALID_COMPLEXITY = new Set(['light', 'standard', 'full']);
const VALID_CATEGORY = new Set(['marketing', 'enterprise', 'geo', 'office', 'creation']);
const LOCALES = ['zh-CN', 'en'];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function assertLocalized(obj, label) {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`${label}: expected localized object`);
  }
  for (const locale of LOCALES) {
    if (typeof obj[locale] !== 'string' || !obj[locale].trim()) {
      throw new Error(`${label}: missing or empty ${locale}`);
    }
  }
}

function loadSkillSlugs() {
  if (!existsSync(CATALOG_PATH)) return new Set();
  const catalog = readJson(CATALOG_PATH);
  return new Set((catalog.skills || []).map((s) => s.slug).filter(Boolean));
}

function validate(config, skillSlugs) {
  const ids = new Set();
  const complexityCounts = { light: 0, standard: 0, full: 0 };
  const categoryCounts = Object.fromEntries([...VALID_CATEGORY].map((c) => [c, 0]));
  const templates = config.templates || [];

  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error('templates must be a non-empty array');
  }
  if (!Array.isArray(config.categoryLevels) || config.categoryLevels.length === 0) {
    throw new Error('categoryLevels must be a non-empty array');
  }
  for (const level of config.categoryLevels) {
    if (!VALID_CATEGORY.has(level.id)) {
      throw new Error(`invalid categoryLevels id: ${level.id}`);
    }
    if (level.id === 'education' || level.id === 'brainstorming') {
      throw new Error('categoryLevels must not include education/brainstorming');
    }
  }

  for (const item of templates) {
    if (!item.id || ids.has(item.id)) {
      throw new Error(`duplicate or missing template id: ${item.id}`);
    }
    ids.add(item.id);

    if (!VALID_COMPLEXITY.has(item.complexity)) {
      throw new Error(`${item.id}: invalid complexity ${item.complexity}`);
    }
    complexityCounts[item.complexity] += 1;

    if (!VALID_CATEGORY.has(item.category)) {
      throw new Error(`${item.id}: invalid or missing category ${item.category}`);
    }
    if (item.category === 'education' || item.category === 'brainstorming') {
      throw new Error(`${item.id}: category education/brainstorming forbidden`);
    }
    categoryCounts[item.category] += 1;

    assertLocalized(item.title, `${item.id}.title`);
    assertLocalized(item.outcome, `${item.id}.outcome`);
    assertLocalized(item.scenario, `${item.id}.scenario`);
    assertLocalized(item.outputs, `${item.id}.outputs`);
    assertLocalized(item.prompt, `${item.id}.prompt`);

    if (!Array.isArray(item.flow) || item.flow.length < 2) {
      throw new Error(`${item.id}: flow must have at least 2 steps`);
    }
    for (const step of item.flow) {
      assertLocalized(step.title, `${item.id}.flow step ${step.step}`);
    }

    if (!/\d+\./.test(item.prompt['zh-CN']) && item.flow.length > 1) {
      throw new Error(`${item.id}: zh-CN prompt should contain numbered steps`);
    }

    for (const slug of item.relatedSkills || []) {
      if (skillSlugs.size > 0 && !skillSlugs.has(slug)) {
        throw new Error(`${item.id}: relatedSkill not in capabilities.catalog: ${slug}`);
      }
    }
  }

  for (const level of VALID_COMPLEXITY) {
    if (complexityCounts[level] === 0) {
      throw new Error(`missing templates for complexity: ${level}`);
    }
  }

  return { count: templates.length, complexityCounts, categoryCounts };
}

function buildDoc(config) {
  const lines = [
    '# 全案模板目录（自动生成）',
    '',
    `> 生成时间：${new Date().toISOString()} · 源文件 \`config/process-templates.json\``,
    '',
    '| 类别 | 数量 |',
    '|------|------|',
  ];

  const counts = Object.fromEntries([...VALID_CATEGORY].map((c) => [c, 0]));
  for (const t of config.templates) counts[t.category] += 1;
  const labelZh = Object.fromEntries(
    (config.categoryLevels || []).map((l) => [l.id, l.label?.['zh-CN'] || l.id]),
  );
  for (const id of VALID_CATEGORY) {
    lines.push(`| ${labelZh[id] || id} (\`${id}\`) | ${counts[id]} |`);
  }
  lines.push('');
  lines.push('## 模板列表');
  lines.push('');

  const order = Object.fromEntries(
    (config.categoryLevels || []).map((l) => [l.id, l.order ?? 99]),
  );
  const sorted = [...config.templates].sort(
    (a, b) => (order[a.category] ?? 99) - (order[b.category] ?? 99) || a.id.localeCompare(b.id),
  );

  for (const t of sorted) {
    const steps = t.flow.map((s) => s.title['zh-CN']).join(' → ');
    lines.push(`### ${t.title['zh-CN']} (\`${t.id}\`)`);
    lines.push('');
    lines.push(`- **类别**：${t.category} · **体量徽章**：${t.complexity} · ${t.flow.length} 步`);
    lines.push(`- **成果**：${t.outcome['zh-CN']}`);
    lines.push(`- **场景**：${t.scenario['zh-CN']}`);
    lines.push(`- **流程**：${steps}`);
    lines.push(`- **产出物**：${t.outputs['zh-CN']}`);
    lines.push(`- **关联能力**：${(t.relatedSkills || []).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`missing config: ${CONFIG_PATH}`);
  }

  const config = readJson(CONFIG_PATH);
  const skillSlugs = loadSkillSlugs();
  const report = validate(config, skillSlugs);

  const payload = {
    generated_at: new Date().toISOString(),
    version: config.version,
    complexityLevels: config.complexityLevels,
    categoryLevels: config.categoryLevels,
    templates: (config.templates || []).map((item) => applyHubPinnedToTemplate(item)),
    report,
  };

  mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeFileSync(OUT_DOC, buildDoc(config), 'utf8');

  console.log('[process-templates] generated');
  console.log(`[process-templates] total=${report.count}`);
  console.log(
    `[process-templates] light=${report.complexityCounts.light} standard=${report.complexityCounts.standard} full=${report.complexityCounts.full}`,
  );
  console.log(`[process-templates] categories=${JSON.stringify(report.categoryCounts)}`);
  console.log(`[process-templates] output=${OUT_JSON}`);
}

main();
