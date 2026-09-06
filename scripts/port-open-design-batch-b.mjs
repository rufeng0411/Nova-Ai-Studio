#!/usr/bin/env node
/**
 * Track B: port curated Open Design design-templates / skills → Nova od-* surface skills.
 * Nova-fit SOP: STDA task dir, Chinese SKILL description, checklist via read_skill, no OD daemon fields.
 *
 * Usage:
 *   node scripts/port-open-design-batch-b.mjs
 *   node scripts/port-open-design-batch-b.mjs --fix-existing-stda
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const TMP_TEMPLATES = path.join(REPO_ROOT, 'tmp', 'od-templates');
const OPEN_DESIGN_SKILLS = path.join(REPO_ROOT, 'OpenDesign', 'skills');
const RAW_TEMPLATE = (slug) =>
  `https://raw.githubusercontent.com/nexu-io/open-design/main/design-templates/${slug}/SKILL.md`;

/** @typedef {{ source: string, sourceKind: 'template'|'skill', target: string, displayName: string, taskSummary: string, description: string, bullets: string[], hubVisible: boolean, deliverable?: string }} BatchItem */

/** @type {BatchItem[]} */
export const BATCH_B_ITEMS = [
  {
    source: 'waitlist-page',
    sourceKind: 'template',
    target: 'od-waitlist-page',
    displayName: '候补名单页',
    taskSummary: '预发布邮箱收集页',
    description: '制作产品预发布 / 候补名单落地页（品牌、一句话价值、邮箱收集与成功态）。用户提到 waitlist、即将上线、早鸟报名时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '首屏一眼看懂产品名与一句话价值，邮箱输入 + 提交按钮可用（可用前端假成功态）。',
      '可选：品牌徽标区、倒计时或「即将上线」标签、轻量装饰层（勿堆紫蓝 AI 渐变）。',
      '手机窄屏不横向溢出；提交后有成功提示文案。',
    ],
    hubVisible: true,
  },
  {
    source: 'web-prototype',
    sourceKind: 'template',
    target: 'od-web-prototype',
    displayName: '网页原型页',
    taskSummary: '可点击网页原型',
    description: '制作高保真网页原型（导航、核心页面区块、关键交互示意）。用户要「原型 / 高保真 HTML 示意」时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '完整单页或少量锚点分区，含顶栏导航与页脚。',
      '至少 3 个内容区块贴合用户 brief；文案用真实业务词，禁 lorem。',
      '交互可用锚点 / 简单 JS；交付可浏览器直接打开。',
    ],
    hubVisible: true,
  },
  {
    source: 'team-okrs',
    sourceKind: 'template',
    target: 'od-team-okrs',
    displayName: '团队 OKR 页',
    taskSummary: '季度目标与关键结果看板',
    description: '制作团队 OKR / 目标跟踪页（季度横幅、目标、关键结果进度条、负责人与状态）。用户提到 OKR、关键结果时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '季度横幅 + 至少 3 个 Objective，每个含 Key Results 进度条。',
      '负责人头像占位、状态胶囊（进行中 / 风险 / 完成）。',
      '侧栏或底部「本季度一览」摘要。',
    ],
    hubVisible: true,
  },
  {
    source: 'kanban-board',
    sourceKind: 'template',
    target: 'od-kanban-board',
    displayName: '看板任务板',
    taskSummary: '看板式任务列',
    description: '制作看板任务板页面（多列状态、卡片、优先级标签）。用户提到看板、Kanban、任务板时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '至少 3 列（如待办 / 进行中 / 完成），每列有示例卡片。',
      '卡片含标题、标签、负责人占位；列宽在桌面可读。',
      '示例数据贴合用户场景，禁空白骨架。',
    ],
    hubVisible: true,
  },
  {
    source: 'meeting-notes',
    sourceKind: 'template',
    target: 'od-meeting-notes',
    displayName: '会议纪要页',
    taskSummary: '结构化会议纪要页面',
    description: '制作会议纪要展示页（议题、决议、行动项与负责人）。用户要「会议纪要页 / 纪要排版」时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '页眉含会议主题、时间、与会人。',
      '分区：议题要点、决议、行动项（负责人 + 截止日期占位）。',
      '排版清晰可打印；内容贴合用户提供的笔记。',
    ],
    hubVisible: true,
  },
  {
    source: 'docs-page',
    sourceKind: 'template',
    target: 'od-docs-page',
    displayName: '文档站点页',
    taskSummary: '产品文档 / 帮助中心页',
    description: '制作产品文档或帮助中心单页（侧栏目录 + 正文）。用户提到文档站、帮助文档页时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '左侧目录 + 右侧正文（或顶部分段导航）。',
      '至少 3 个章节标题与可读正文；代码块可选。',
      '窄屏目录可折叠或置顶，不横向溢出。',
    ],
    hubVisible: true,
  },
  {
    source: 'blog-post',
    sourceKind: 'template',
    target: 'od-blog-post',
    displayName: '博客文章页',
    taskSummary: '长文博客排版页',
    description: '制作博客 / 长文阅读页（标题、作者信息、正文排版）。用户提到博客页、文章页时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '标题、作者/日期、导语；正文层级清晰（h2/h3）。',
      '适合阅读的行宽与字距；可选配图占位并标注。',
      '文末可附相关阅读或 CTA。',
    ],
    hubVisible: true,
  },
  {
    source: 'finance-report',
    sourceKind: 'template',
    target: 'od-finance-report',
    displayName: '财务报告页',
    taskSummary: '财务摘要可视化页',
    description: '制作财务 / 经营摘要报告页（指标卡、图表区、说明）。用户提到财务报告页、经营看板摘要时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '至少 4 个 KPI 卡片 + 1 个趋势或构成图（可用 SVG/简易 Chart）。',
      '数字用示例数据并标注「示例」；勿伪造真实公司财报。',
      '附简短解读段落。',
    ],
    hubVisible: true,
  },
  {
    source: 'hr-onboarding',
    sourceKind: 'template',
    target: 'od-hr-onboarding',
    displayName: '入职引导页',
    taskSummary: '新人入职流程页',
    description: '制作 HR 新人入职引导页（步骤、清单、联系人）。用户提到入职引导、onboarding 页面时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '分步流程（至少 4 步）与进度示意。',
      '待办清单、常用链接、对接人卡片。',
      '语气友好专业，贴合用户公司名。',
    ],
    hubVisible: true,
  },
  {
    source: 'pm-spec',
    sourceKind: 'template',
    target: 'od-pm-spec',
    displayName: '产品规格页',
    taskSummary: 'PRD / 规格说明页',
    description: '制作产品规格 / PRD 展示页（背景、需求、验收）。用户提到产品规格页、PRD 页面时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '含背景、目标用户、功能列表、验收标准分区。',
      '可用表格列出优先级；示意数据贴合 brief。',
      '单文件 HTML，结构清晰便于评审。',
    ],
    hubVisible: true,
  },
  {
    source: 'gamified-app',
    sourceKind: 'template',
    target: 'od-gamified-app',
    displayName: '游戏化应用页',
    taskSummary: '游戏化产品界面示意',
    description: '制作游戏化产品界面示意（等级、任务、奖励反馈）。用户提到游戏化、积分成长界面时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '用户等级 / 经验条、任务卡、奖励反馈区至少各一。',
      '视觉活泼但克制，避免廉价贴纸堆叠。',
      '示例文案贴合用户产品名。',
    ],
    hubVisible: true,
  },
  {
    source: 'deck-swiss-international',
    sourceKind: 'skill',
    target: 'od-deck-swiss',
    displayName: '瑞士国际主义 Deck',
    taskSummary: '16 列网格 HTML 演示稿',
    description: '制作瑞士国际主义风格 HTML 演示稿（16 列网格、单一强调色、锁死版式）。用户提到瑞士风 deck、国际主义幻灯网页时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '横屏 16:9 多页（至少 4 页），键盘或点击翻页。',
      '强网格对齐、单一饱和强调色；冷静理性，无手绘噪点装饰。',
      '真实内容填充，禁 lorem；交付 index.html。',
    ],
    hubVisible: true,
  },
  {
    source: 'card-twitter',
    sourceKind: 'skill',
    target: 'od-social-x-card',
    displayName: 'X 分享卡片',
    taskSummary: '推特 / X 金句分享卡',
    description: '制作 X（Twitter）金句或数据分享卡（适合配推文截图）。用户提到推特卡、X 分享图时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '画幅约 16:9（如 1600×900 容器），中央金句 2–3 行。',
      '含作者署名 / handle 占位、类型小标签、品牌水印位。',
      '暗色或亮色二选一，对比足够；交付 index.html。',
    ],
    hubVisible: true,
  },
  {
    source: 'creative-director',
    sourceKind: 'skill',
    target: 'od-creative-director',
    displayName: '创意总监审稿',
    taskSummary: '设计审稿与改稿指引',
    description: '对已有设计稿或 HTML 做创意总监式审稿（层级、节奏、品牌一致性与改稿清单）。内部辅助技能，用户明确要求「帮我审稿 / 改设计」时使用。先读 open-design 总控再执行。',
    bullets: [
      '输出结构化审稿意见（优点 / 问题 / 优先改 3 项），可写 review.md。',
      '若用户要求改稿，再 write_file 更新 HTML；勿空谈不落盘。',
      '禁止另起无关新站；锚定用户已有成果路径。',
    ],
    hubVisible: false,
    deliverable: 'review.md',
  },
  {
    source: 'wireframe-mobile-flow',
    sourceKind: 'template',
    target: 'od-wireframe-mobile-flow',
    displayName: '手机流程线框',
    taskSummary: '多屏手机流程线框',
    description: '制作手机多屏流程线框（灰盒结构、关键标注）。用户要细化手机流程线框时使用。先读 open-design 总控，再按本技能清单执行。',
    bullets: [
      '至少 3 屏手机外框并排或纵向流，灰盒保真。',
      '关键热区与流转箭头标注；禁高饱和装饰。',
      '交付 index.html；与 od-wireframe-sketch 互补（本技能偏流程）。',
    ],
    hubVisible: false,
  },
];

const STDA_DELIVER_LINE =
  '- 交付：`write_file` 到**系统分配的任务目录**（`artifacts/task-*`）下的 `{file}`；对话只给路径，勿贴整页 html。**禁止**写入 `artifacts/design/` 语义目录。';

function buildSkillMd(item) {
  const file = item.deliverable || 'index.html';
  const deliver = STDA_DELIVER_LINE.replace('{file}', file);
  const bullets = item.bullets.map((b) => `- ${b}`).join('\n');
  return `---
name: ${item.target}
description: ${item.description}
---

# ${item.target}

## 使用方式

1. 先 \`read_skill\` 读取 \`open-design\`，完成风格与品牌确认（勿另起无关设计系统问卷）。
2. 用 \`read_skill\` skillName=\`${item.target}\` relativePath=\`references/checklist.md\` 读清单并自检（勿 \`read_file\`）。
3. 直接按用户 brief 开做；用户说「直接开始做」时禁止再问风格偏好。

## 产物要求

${deliver}

${bullets}

## 资源

- 清单：\`references/checklist.md\`（经 read_skill relativePath 读取）
- 上游意图摘要：\`references/upstream-notes.md\`（经 read_skill relativePath 读取；可选）
`;
}

function buildChecklist(item) {
  const lines = item.bullets.map((b) => `- [ ] ${b.replace(/^[^-]*—\s*/, '')}`);
  return `# ${item.displayName}清单

## 必过

- [ ] 落盘在系统分配的 \`artifacts/task-*\` 目录，未写入 \`artifacts/design/\`
- [ ] 浏览器可直接打开主文件预览
${lines.map((l) => l).join('\n')}

## 建议

- [ ] 文案贴合用户行业与产品名，不编造虚假客户数据
- [ ] 手机窄屏不横向溢出
- [ ] 无大面积默认紫蓝渐变「AI 味」背景
`;
}

async function readUpstream(item) {
  if (item.sourceKind === 'skill') {
    const p = path.join(OPEN_DESIGN_SKILLS, item.source, 'SKILL.md');
    try {
      return await fs.readFile(p, 'utf8');
    } catch {
      /* fall through */
    }
  }
  const local = path.join(TMP_TEMPLATES, item.source, 'SKILL.md');
  try {
    return await fs.readFile(local, 'utf8');
  } catch {
    /* fetch */
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(RAW_TEMPLATE(item.source), { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = await res.text();
    await fs.mkdir(path.join(TMP_TEMPLATES, item.source), { recursive: true });
    await fs.writeFile(path.join(TMP_TEMPLATES, item.source, 'SKILL.md'), text, 'utf8');
    return text;
  } catch {
    return null;
  }
}

function stripToNotes(raw, max = 4000) {
  if (!raw) return '_上游 SKILL 未取到；以本技能产物要求为准。_\n';
  const body = raw.replace(/^---[\s\S]*?---\s*/, '');
  const cleaned = body
    .replace(/\bod:\s*[\s\S]*?(?=\n[a-z_]+:|\n---|\n#|$)/gi, '')
    .replace(/```[\s\S]*?```/g, '[代码块已省略]')
    .trim();
  return `# 上游意图摘要（只读参考）\n\n> 迁移自 Open Design；执行以本技能 SKILL.md 与 checklist 为准，忽略 OD daemon / DESIGN.md 强制问卷。\n\n${cleaned.slice(0, max)}\n`;
}

async function portItem(item) {
  const dir = path.join(SKILLS_ROOT, item.target);
  await fs.mkdir(path.join(dir, 'references'), { recursive: true });
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  const upstream = await readUpstream(item);
  await fs.writeFile(path.join(dir, 'SKILL.md'), buildSkillMd(item), 'utf8');
  await fs.writeFile(path.join(dir, 'references', 'checklist.md'), buildChecklist(item), 'utf8');
  await fs.writeFile(path.join(dir, 'references', 'upstream-notes.md'), stripToNotes(upstream), 'utf8');
  return { target: item.target, upstream: Boolean(upstream) };
}

function fixExistingStda() {
  // Delegate to dedicated normalizer (avoids nested replace garbage).
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'fix-od-stda-paths.mjs')], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0 ? 1 : 0;
}

async function main() {
  const fixOnly = process.argv.includes('--fix-existing-stda');
  const stdaFixed = await fixExistingStda();
  console.log(`STDA path fixes: ${stdaFixed} skill files`);
  if (fixOnly) return;

  const results = [];
  for (const item of BATCH_B_ITEMS) {
    const r = await portItem(item);
    results.push(r);
    console.log(`ported ${r.target} (upstream=${r.upstream})`);
  }
  console.log(`Batch B done: ${results.length} skills`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
