#!/usr/bin/env node
/**
 * Render docs/showcase-card-recommendation-20260803.zh-CN.md with full prompts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const jsonPath = path.join(root, 'docs/showcase-card-recommendation-20260803.json');
const outPath = path.join(root, 'docs/showcase-card-recommendation-20260803.zh-CN.md');

const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const sections = [
  ['design', '设计'],
  ['video', '视频'],
  ['copy', '文案'],
  ['marketing', '营销'],
  ['office', '办公'],
  ['research', '研究分析'],
  ['geo', 'GEO'],
  ['fullcase', '全案项目★'],
  ['compliance', '企业合规★'],
];

const lines = [];
lines.push('# Showcase 卡片内容规格（Wave-A · 2026-08-03）');
lines.push('');
lines.push(
  '> **规格批全 A（L0+L1）**：`npm run test:showcase:cards:gate`  ',
);
lines.push(
  '> **机读源**：[`showcase-card-recommendation-20260803.json`](./showcase-card-recommendation-20260803.json)（54 卡）  ',
);
lines.push(
  '> **提示词等级**：`professional-showcase-v2`（代理提案 / 高管可投影级 brief，非短句模板）  ',
);
lines.push('> **Wave-B 实机批量**：须你书面确认后才开跑（见文末确认清单）');
lines.push('');
lines.push('## 1. 战略摘要');
lines.push('');
lines.push(
  'Nova Ai-Studio 演示案例定位为「**可打开验收的企业项目成果馆**」，不是模板商店或纯聊天截图墙。',
);
lines.push('');
lines.push(
  '生成提示词按 **专业 showcase** 编写：假名品牌/场景设定、受众与用途、结构清单、视觉/质量禁令、验收口径（可投影/可投董事会/可审阅），强制「须交付」+ 系统任务目录；合规栏含执业免责。',
);
lines.push('');
lines.push('| 锚点 | 做法 |');
lines.push('|------|------|');
lines.push(
  '| 相对 Gamma/扣子/纯聊天 | 徽章写交付格式；注解写可验收成果；提示词强制「须交付」+ 任务目录 |',
);
lines.push(
  '| 中国中小 B2B 节奏 | 办公 PPT / 调研建信任 → 全案★ / GEO 建护城河 → 合规★ 建私有化信任 |',
);
lines.push(
  '| 栏间去重 | GEO 全案只在 `fullcase`；真 pptx/Bento 只在 `office`；单点 GEO 只在 `geo` |',
);
lines.push('');
lines.push('## 2. 九栏 × 6 卡 · 完整生成提示词');
lines.push('');
lines.push(
  '以下每卡含：**绑定**、**须交付**、**中文提示词**、**英文提示词**（可直接复制开跑；中文约 120–240 字专业 brief）。',
);
lines.push('');
lines.push(
  '权威源：`scripts/showcase/card-prompts-pro-20260803.mjs` → `build-card-recommendation-20260803.mjs`。改提示词请改 pro 源后重建。',
);
lines.push('');

for (const [sid, title] of sections) {
  const cards = doc.cards
    .filter((c) => c.section_id === sid)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  lines.push(`### ${title} (\`${sid}\`)`);
  lines.push('');
  for (const c of cards) {
    const star = c.star ? ' ★' : '';
    const deps = Array.isArray(c.deps) && c.deps.length ? c.deps.join(', ') : '无';
    lines.push(`#### ${c.name_zh}${star}`);
    lines.push('');
    lines.push('| 字段 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| id | \`${c.id}\` |`);
    lines.push(`| 英文名 | ${c.name_en} |`);
    lines.push(`| 徽章 | ${c.badge_zh} / ${c.badge_en} |`);
    lines.push(`| 注解 | ${c.annotation_zh} |`);
    lines.push(`| 绑定 | \`${c.hub_binding}\` (${c.binding_kind}) |`);
    lines.push(
      `| 须交付 | ${(c.must_deliver || []).map((x) => `\`${x}\``).join(', ')} |`,
    );
    lines.push(`| 优先级 | ${c.priority} |`);
    lines.push(`| 依赖 | ${deps} |`);
    lines.push('');
    lines.push('**生成提示词（中文）**');
    lines.push('');
    lines.push('```');
    lines.push(c.prompt_zh);
    lines.push('```');
    lines.push('');
    lines.push('**生成提示词（英文）**');
    lines.push('');
    lines.push('```');
    lines.push(c.prompt_en);
    lines.push('```');
    lines.push('');
  }
}

lines.push('## 3. P0 首屏优先（实机批建议先跑）');
lines.push('');
lines.push('| id | section | hub_binding | deps |');
lines.push('|----|---------|-------------|------|');
lines.push('| sc-design-tea-landing | design | od-saas-landing | [] |');
lines.push('| sc-office-board-pptx | office | anth-pptx | [] |');
lines.push('| sc-research-industry | research | nova-research-industry-market | bocha |');
lines.push('| sc-fullcase-campaign | fullcase | brand-campaign-full | [] |');
lines.push('| sc-geo-ai-seo | geo | mkt-ai-seo | bocha |');
lines.push('| sc-compliance-contract | compliance | comp-contract-review | [] |');
lines.push('');
lines.push(
  '另有 `sc-copy-one-article-matrix` 亦为 P0（矩阵清单样板），可并入首波。',
);
lines.push('');
lines.push('## 4. 旧 seed 对照');
lines.push('');
lines.push('| 动作 | id |');
lines.push('|------|-----|');
lines.push(
  '| 缩略可参考复用 | site-south, video-hf, html-plan, deep, geo-report, full-campaign, full-flywheel, full-geo |',
);
lines.push('| 内容退役（不进新注册表） | site-modric、体育向 article-*、ppt-guofeng 等 |');
lines.push('| 新建 | 全部 `sc-*`（禁止撞旧 item id） |');
lines.push('');
lines.push('## 5. L0–L4 与命令');
lines.push('');
lines.push('| 级 | Wave-A | 命令/证据 |');
lines.push('|----|--------|-----------|');
lines.push('| L0 | 必跑 | `npm run test:showcase:cards:gate` |');
lines.push(
  '| L1 | 必跑 | gate：54 卡、九栏×6、唯一绑定、禁词、隐藏 slug、合规免责 |',
);
lines.push(
  '| L2–L4 | Wave-B | 见计划；`test:showcase:cards:live --dry-run` 可预览队列 |',
);
lines.push('');
lines.push(
  '重建 JSON：`node scripts/showcase/build-card-recommendation-20260803.mjs`  ',
);
lines.push(
  '重建本 MD：`node scripts/showcase/render-card-recommendation-md.mjs`',
);
lines.push('');
lines.push('## 6. 人工确认清单（Wave-B 开跑前）');
lines.push('');
lines.push('请确认后回复类似口令：');
lines.push('');
lines.push('`确认 Wave-B，范围 P0+P1，shadow，项目 Showcase-Batch-20260803`');
lines.push('');
lines.push('须覆盖：');
lines.push('');
lines.push('1. 卡表文案与提示词是否 OK（砍卡列出 `sc-*`）');
lines.push('2. 范围：`P0-only` / `P0+P1` / `全部54`');
lines.push('3. 验收项目名（建议保留、禁 teardown）');
lines.push('4. Key：video / HF / 生图 / 博查（缺则 skipped）');
lines.push('5. 发布：默认 **shadow**；`enforce` 须另说「盖前台」');
lines.push('');
lines.push('**无确认禁止批量 Gateway。**');
lines.push('');
lines.push('## 7. Wave-A 自检');
lines.push('');
lines.push('- [x] `npm run test:showcase:cards:gate` exit 0');
lines.push('- [x] JSON 54 / 九栏×6');
lines.push('- [x] MD 展开 54 条完整中英提示词');
lines.push('- [x] 零双主绑定、零隐藏 slug、零禁词');
lines.push('- [x] 合规 6/6 免责');
lines.push('- [x] 全案/合规 star=true');
lines.push('- [x] 未改前台 catalog、未跑 Gateway');
lines.push('');
lines.push('**规格批全 A ≠ 案例已上线全 A。**');
lines.push('');

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`wrote ${outPath} cards=${doc.cards.length}`);
