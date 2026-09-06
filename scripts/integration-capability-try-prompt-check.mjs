#!/usr/bin/env node
/**
 * Hub「试一下」提示词与隐式绑定抽检验证。
 * Run: node scripts/integration-capability-try-prompt-check.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertTryPromptQuality, TRY_PROMPT_ZH } from './lib/capabilityTryPrompts.mjs';
function buildCapabilityBindingAppendPrompt(context) {
  const name = context.displayName.trim();
  const slug = context.slug.trim();
  const prefix = context.packMemberPrefix?.trim();
  const etiquette =
    '无需重复说明任务来源；缺关键输入时再提问；产出文件后在对话中给出可点击路径。'
    + '若用户消息与该能力明显无关，按常规对话处理。';
  if (prefix) {
    return [
      '<capability-binding>',
      `用户在能力中心选择了能力包「${name}」（skill: ${slug}）。`,
      `根据用户描述，从成员前缀 ${prefix} 的子技能中选用 1–3 个最贴合的项，`,
      '必须先 read_skill 加载对应技能并按其执行，不要改用无关技能。',
      etiquette,
      '</capability-binding>',
    ].join('');
  }
  return [
    '<capability-binding>',
    `用户在能力中心选择了能力「${name}」（skill: ${slug}）。`,
    '必须先 read_skill 加载该技能并按其执行，不要改用其他无关技能。',
    etiquette,
    '</capability-binding>',
  ].join('');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const I18N_PATH = path.join(REPO_ROOT, 'config', 'capabilities.i18n.json');
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'capabilities-smoke');

/** 计划抽测 10 项 + i18n 抽查 20 项 */
const SPOT_CHECK_SLUGS = [
  'df-deep-research',
  'tool-web-search',
  'mcp-firecrawl',
  'mcp-playwright',
  'hub-pack-brand-website',
  'hub-pack-pm-toolkit',
  'pd-geo',
  'od-mobile-app',
  'create-nanobanana-ppt',
  'edu-tutor-skills',
  'karpathy-guidelines',
  'mkt-customer-research',
  'geo-competitor-analysis',
  'ala-code-reviewer',
  'hf-website-to-video',
  'persona-buffett',
  'brainstorm-structured',
  'office-ecom',
  'video-db-python',
  'humanizer',
  'hub-pack-aso',
];

const BINDING_SAMPLES = [
  { slug: 'df-deep-research', displayName: '深度调研' },
  { slug: 'mcp-firecrawl', displayName: '网页抓取调研' },
  { slug: 'mcp-playwright', displayName: '浏览器自动化 MCP' },
  { slug: 'edu-tutor-skills', displayName: '家教技能' },
  {
    slug: 'hub-pack-brand-website',
    displayName: '品牌官网全案',
    packMemberPrefix: 'mkt-brand-',
  },
  {
    slug: 'hub-pack-pm-toolkit',
    displayName: 'PM工具包',
    packMemberPrefix: 'pms-',
  },
  { slug: 'od-mobile-app', displayName: '手机界面示意' },
  { slug: 'pd-geo', displayName: 'AI 搜索全案' },
  { slug: 'create-nanobanana-ppt', displayName: 'AI 配图幻灯' },
  { slug: 'tool-web-search', displayName: '联网搜索' },
  { slug: 'karpathy-guidelines', displayName: 'AI 编码规范' },
];

function isVisibleInHub(skill) {
  if (skill.hidden_in_hub) return false;
  if (skill.integration_level === 'hidden') return false;
  return true;
}

function main() {
  const failures = [];
  const i18n = JSON.parse(readFileSync(I18N_PATH, 'utf8'));
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

  const badPrompts = assertTryPromptQuality();
  if (badPrompts.length > 0) {
    failures.push(`try-prompt quality: ${badPrompts.length} bad entries`);
  }

  const visible = (catalog.skills || []).filter(isVisibleInHub);
  if (visible.length !== Object.keys(TRY_PROMPT_ZH).length) {
    failures.push(
      `visible hub count mismatch: catalog=${visible.length} prompts=${Object.keys(TRY_PROMPT_ZH).length}`,
    );
  }

  for (const skill of visible) {
    const slug = skill.slug;
    const expected = TRY_PROMPT_ZH[slug];
    if (!expected) {
      failures.push(`missing TRY_PROMPT_ZH: ${slug}`);
      continue;
    }
    const actual = i18n.skills[slug]?.['zh-CN']?.examples?.[0];
    if (actual !== expected) {
      failures.push(`i18n zh example mismatch: ${slug}`);
    }
  }

  const catalogBySlug = new Map((catalog.skills || []).map((s) => [s.slug, s]));
  for (const slug of SPOT_CHECK_SLUGS) {
    const skill = catalogBySlug.get(slug);
    // PD-SAAS-FORK: TRY_PROMPT_ZH 仅覆盖 Hub 可见项；pin 但仍 hidden 的 slug 不做硬失败抽检
    if (skill && !isVisibleInHub(skill)) {
      continue;
    }
    const expected = TRY_PROMPT_ZH[slug];
    const actual = i18n.skills[slug]?.['zh-CN']?.examples?.[0];
    if (!expected || actual !== expected) {
      failures.push(`spot check failed: ${slug}`);
    }
    if (!expected?.startsWith('用「')) {
      failures.push(`spot check missing 用「 prefix: ${slug}`);
    }
  }

  for (const ctx of BINDING_SAMPLES) {
    const prompt = buildCapabilityBindingAppendPrompt(ctx);
    if (!prompt.includes('<capability-binding>')) {
      failures.push(`binding missing tag: ${ctx.slug}`);
    }
    if (!prompt.includes(ctx.slug)) {
      failures.push(`binding missing slug: ${ctx.slug}`);
    }
    if (!prompt.includes('read_skill')) {
      failures.push(`binding missing read_skill: ${ctx.slug}`);
    }
    if (ctx.packMemberPrefix && !prompt.includes(ctx.packMemberPrefix)) {
      failures.push(`binding missing pack prefix: ${ctx.slug}`);
    }
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    ok: failures.length === 0,
    failures,
    visible_hub: visible.length,
    try_prompt_count: Object.keys(TRY_PROMPT_ZH).length,
    spot_check: SPOT_CHECK_SLUGS.length,
    binding_samples: BINDING_SAMPLES.length,
    generated_at: new Date().toISOString(),
  };
  const reportPath = path.join(REPORT_DIR, 'capability-try-prompt-check.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`[try-prompt-check] ok=${report.ok}`);
  console.log(`[try-prompt-check] visible=${visible.length} prompts=${Object.keys(TRY_PROMPT_ZH).length}`);
  console.log(`[try-prompt-check] spot=${SPOT_CHECK_SLUGS.length} binding=${BINDING_SAMPLES.length}`);
  console.log(`[try-prompt-check] report=${reportPath}`);
  if (failures.length > 0) {
    for (const f of failures.slice(0, 20)) console.error(`[try-prompt-check] ${f}`);
    process.exit(1);
  }
}

main();
