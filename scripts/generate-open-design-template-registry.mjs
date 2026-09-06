#!/usr/bin/env node
/**
 * Track C: shadow registry for Open Design design-templates (Hub invisible by default).
 *
 * Writes:
 *   config/open-design-template-registry.json
 *   docs/open-design-template-registry.zh-CN.md
 *
 * Flag (runtime): PILOTDECK_OD_TEMPLATE_REGISTRY=off|shadow|1  (default shadow when key absent)
 *
 * Usage: node scripts/generate-open-design-template-registry.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BATCH_B_ITEMS } from './port-open-design-batch-b.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = path.join(REPO_ROOT, 'config', 'open-design-template-registry.json');
const OUT_MD = path.join(REPO_ROOT, 'docs', 'open-design-template-registry.zh-CN.md');
const API =
  'https://api.github.com/repos/nexu-io/open-design/contents/design-templates?ref=main';

const CATEGORY_HINTS = [
  { re: /^html-ppt|^kami-deck|^simple-deck|^guizang|^replit-deck|^open-design-landing-deck/, category: 'deck_ppt', skipPortHint: true },
  { re: /^video-|^motion-|^sprite-|^hyperframes|^audio-/, category: 'motion_video', skipPortHint: true },
  { re: /^wireframe-/, category: 'wireframe' },
  { re: /^web-prototype|^saas-landing|^waitlist|^pricing|^landing|^kami-landing|^open-design-landing$/, category: 'marketing_web' },
  { re: /^dashboard|^live-|^social-media-dashboard|^github-dashboard|^trading-|^flowai-/, category: 'dashboard' },
  { re: /^social-|^card-|^poster|^magazine-poster|^image-poster/, category: 'social_card' },
  { re: /^docs-|^blog-|^meeting-|^weekly-|^eng-runbook|^pm-spec|^team-okrs|^kanban/, category: 'docs_collab' },
  { re: /^finance-|^invoice|^dcf-|^ib-pitch/, category: 'finance' },
  { re: /^hr-|^mobile-onboarding|^gamified|^mobile-app/, category: 'product_ui' },
];

function inferCategory(slug) {
  for (const h of CATEGORY_HINTS) {
    if (h.re.test(slug)) return { category: h.category, skipPortHint: Boolean(h.skipPortHint) };
  }
  return { category: 'other', skipPortHint: false };
}

function zhCategory(cat) {
  return ({
    deck_ppt: '演示/PPT 变体',
    motion_video: '动效/视频',
    wireframe: '线框',
    marketing_web: '营销网页',
    dashboard: '看板',
    social_card: '社媒卡片',
    docs_collab: '文档协作',
    finance: '财务',
    product_ui: '产品界面',
    other: '其他',
  })[cat] || cat;
}

async function listRemoteTemplates() {
  const res = await fetch(API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'nova-ai-studio-od-registry' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('unexpected API payload');
  return data.filter((x) => x.type === 'dir').map((x) => x.name).sort();
}

async function main() {
  const portedBySource = new Map(BATCH_B_ITEMS.map((i) => [i.source, i]));
  let slugs;
  try {
    slugs = await listRemoteTemplates();
  } catch (err) {
    console.warn('remote list failed, using Batch B sources only:', err.message);
    slugs = [...new Set(BATCH_B_ITEMS.map((i) => i.source))].sort();
  }

  const templates = slugs.map((slug) => {
    const { category, skipPortHint } = inferCategory(slug);
    const ported = portedBySource.get(slug);
    return {
      slug,
      category,
      categoryZh: zhCategory(category),
      hubVisible: false,
      portStatus: ported ? 'ported' : skipPortHint ? 'skip_use_native' : 'shadow_only',
      portedSkill: ported?.target ?? null,
      displayNameZh: ported?.displayName ?? null,
      upstreamPath: `design-templates/${slug}`,
      upstreamUrl: `https://github.com/nexu-io/open-design/tree/main/design-templates/${slug}`,
    };
  });

  // Also register functional skills that were ported from OpenDesign/skills (not templates)
  for (const item of BATCH_B_ITEMS) {
    if (item.sourceKind !== 'skill') continue;
    if (templates.some((t) => t.slug === item.source)) continue;
    templates.push({
      slug: item.source,
      category: item.target.includes('deck') ? 'deck_ppt' : 'social_card',
      categoryZh: item.target.includes('deck') ? zhCategory('deck_ppt') : zhCategory('social_card'),
      hubVisible: false,
      portStatus: 'ported',
      portedSkill: item.target,
      displayNameZh: item.displayName,
      upstreamPath: `skills/${item.source}`,
      upstreamUrl: `https://github.com/nexu-io/open-design/tree/main/skills/${item.source}`,
    });
  }

  templates.sort((a, b) => a.slug.localeCompare(b.slug));

  const registry = {
    version: 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: 'nexu-io/open-design',
    license: 'Apache-2.0',
    hubVisibleDefault: false,
    flag: 'PILOTDECK_OD_TEMPLATE_REGISTRY',
    flagModes: ['off', 'shadow', '1'],
    notes: [
      '默认 shadow：仅对账/Preflight 选型，不进能力中心卡片墙。',
      '禁止整包 port 为 od-*；需要可见能力时走 Batch B 精选。',
      'html-ppt-* / video-* 优先用本仓 ppt-master / hf-*，勿重复 od 化。',
    ],
    counts: {
      total: templates.length,
      ported: templates.filter((t) => t.portStatus === 'ported').length,
      shadow_only: templates.filter((t) => t.portStatus === 'shadow_only').length,
      skip_use_native: templates.filter((t) => t.portStatus === 'skip_use_native').length,
    },
    templates,
  };

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

  const md = `# Open Design 模板影子目录（轨 C）

> 生成：\`node scripts/generate-open-design-template-registry.mjs\`  
> 权威 JSON：\`config/open-design-template-registry.json\`  
> Flag：\`PILOTDECK_OD_TEMPLATE_REGISTRY=off|shadow|1\`（默认 **shadow**）

## 原则

- **Hub 默认不可见**（\`hubVisible: false\`）——避免 100+ 模板炸能力中心。
- 需要用户可发现的场景 → 精选 port 为 \`skills/od-*\`（轨 B）。
- \`html-ppt-*\` / 视频类 → \`skip_use_native\`，走本仓 PPT / HyperFrames。
- **不接** OD marketplace daemon / \`open-design.json\` 原子链。

## 统计

| 状态 | 数量 |
|------|------|
| 合计 | ${registry.counts.total} |
| 已 port（ported） | ${registry.counts.ported} |
| 仅影子（shadow_only） | ${registry.counts.shadow_only} |
| 跳过用本仓（skip_use_native） | ${registry.counts.skip_use_native} |

## 已 port 对照

| 上游 slug | Nova skill | 中文名 |
|-----------|------------|--------|
${templates
  .filter((t) => t.portStatus === 'ported')
  .map((t) => `| \`${t.slug}\` | \`${t.portedSkill}\` | ${t.displayNameZh || ''} |`)
  .join('\n')}

## 分类摘要

${[...new Set(templates.map((t) => t.category))]
  .sort()
  .map((c) => {
    const n = templates.filter((t) => t.category === c).length;
    return `- **${zhCategory(c)}**（\`${c}\`）：${n}`;
  })
  .join('\n')}
`;
  await fs.writeFile(OUT_MD, md, 'utf8');
  console.log(`wrote ${path.relative(REPO_ROOT, OUT_JSON)} (${templates.length} templates)`);
  console.log(`wrote ${path.relative(REPO_ROOT, OUT_MD)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
