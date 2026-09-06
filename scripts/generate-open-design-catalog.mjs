#!/usr/bin/env node
/**
 * Regenerate docs/open-design-design-catalog.md from skills + design-systems index.
 * Run after adding od-* skills or syncing design systems.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_ROOT = path.join(REPO_ROOT, "skills");
const DS_DIR = path.join(SKILLS_ROOT, "open-design", "references", "design-systems");
const OUT = path.join(REPO_ROOT, "docs", "open-design-design-catalog.md");

const CATEGORIES = [
  {
    group: "网站与产品",
    items: [
      { name: "产品官网 / 落地页", file: "skills/od-saas-landing/SKILL.md", prompt: "帮我做一个【产品名】的介绍网页，要有醒目标题、三个核心功能、价格或试用按钮、页脚联系方式。风格简洁专业，直接开始做。", note: "企业或产品介绍单页" },
      { name: "定价与套餐", file: "skills/od-pricing-page/SKILL.md", prompt: "帮我做【产品】定价页，三个套餐并对比能做什么，企业档写「联系销售」，直接开始做。", note: "多档价格对比" },
      { name: "升级会员 / 付费", file: "skills/od-pricing-upgrade/SKILL.md", prompt: "帮我做【App】升级会员页，说清楚免费和付费差在哪，一个主按钮「立即升级」，直接开始做。", note: "转化向付费页" },
      { name: "后台 / 数据看板", file: "skills/od-dashboard/SKILL.md", prompt: "帮我做【业务】后台首页，左边菜单、关键数字、下面趋势图（示例数据即可），直接开始做。", note: "管理端首页" },
      { name: "数据汇报", file: "skills/od-data-report/SKILL.md", prompt: "帮我做【季度】数据汇报页，先四条结论、两个图表、三条建议，直接开始做。", note: "分析摘要页" },
      { name: "帮助中心", file: "skills/od-faq-page/SKILL.md", prompt: "帮我做【产品】帮助中心，能搜索、分三类常见问题，直接开始做。", note: "FAQ 折叠页" },
      { name: "线框结构草图", file: "skills/od-wireframe-sketch/SKILL.md", prompt: "先用灰框搭【官网】结构：首页、关于、产品、联系，先不要精美配色，直接开始做。", note: "先确认结构再美化" },
      { name: "页面精修", file: "skills/od-web-artifacts-builder/SKILL.md", prompt: "我有一份初稿页面，请统一间距、按钮和配色，做成能交给客户看的成品，直接开始做。", note: "在已有稿上打磨" },
    ],
  },
  {
    group: "手机端",
    items: [
      { name: "手机 App 界面", file: "skills/od-mobile-app/SKILL.md", prompt: "帮我画【App】三屏界面并排，像真手机一样，直接开始做。", note: "可配合设备外框" },
      { name: "新用户引导", file: "skills/od-mobile-onboarding/SKILL.md", prompt: "帮我做【App】新人引导三屏：欢迎、好处、注册或开始，直接开始做。", note: "首次打开流程" },
      { name: "登录 / 注册", file: "skills/od-login-flow/SKILL.md", prompt: "帮我设计登录、注册和收验证码三个页面，风格干净，直接开始做。", note: "账号流程" },
    ],
  },
  {
    group: "营销与内容",
    items: [
      { name: "营销邮件版面", file: "skills/od-email-marketing/SKILL.md", prompt: "帮我做【活动】邮件版面，有标题、主图位、说明和购买按钮，直接开始做。", note: "邮件客户端友好" },
      { name: "社媒多图轮播", file: "skills/od-social-carousel/SKILL.md", prompt: "帮我做【主题】5 张可左右滑动的配图，每张一个要点，直接开始做。", note: "小红书风系列图" },
      { name: "社媒矩阵（一创意全平台）", file: "skills/social-creative-matrix/SKILL.md", prompt: "我有一条【活动】创意，帮我按抖音小红书微博等国内平台各写文案，并生成竖版方图横版笔记四种配图，先不要发布，直接开始做。", note: "文案矩阵+四套比例图；发布走蚁小二" },
      { name: "竖版海报", file: "skills/od-poster-hero/SKILL.md", prompt: "帮我做【活动】竖版海报，时间地点和三条亮点，底部留二维码位，直接开始做。", note: "分享长图版式" },
      { name: "杂志风长文", file: "skills/od-article-magazine/SKILL.md", prompt: "帮我把下面提纲做成阅读页：【粘贴内容】。杂志排版，直接开始做。", note: "博客 / 专题" },
    ],
  },
  {
    group: "演示与脚本页",
    items: [
      { name: "杂志风汇报幻灯片", file: "skills/od-deck-magazine/SKILL.md", prompt: "帮我做【10 页】汇报，杂志风、横着翻页、每页一屏，直接开始做。", note: "HTML 横滑演示" },
      { name: "简洁风幻灯片", file: "skills/frontend-slides/SKILL.md", prompt: "帮我做【8 页】产品介绍，简洁商务风，横屏翻页，每页一屏，直接开始做。", note: "PilotDeck 自带演示技能" },
      { name: "年度回顾脚本页", file: "skills/od-weread-year-in-review-video/SKILL.md", prompt: "帮我做【年度回顾】叙事页，分章节旁白和画面说明，直接开始做。", note: "网页分镜，非 mp4" },
      { name: "用户研究脚本页", file: "skills/od-swiss-user-research-video/SKILL.md", prompt: "帮我做【研究主题】视频分镜页，每镜旁白+画面，直接开始做。", note: "网页分镜，非 mp4" },
      { name: "复古像素故事板", file: "skills/od-8bit-orbit-video/SKILL.md", prompt: "帮我做【主题】8 位机风格故事板页面，直接开始做。", note: "网页分镜，非 mp4" },
    ],
  },
  {
    group: "品牌与编辑风",
    items: [
      { name: "品牌故事长页", file: "skills/od-after-hours-editorial/SKILL.md", prompt: "帮我做【品牌】故事长页，像深夜杂志专栏，直接开始做。", note: "叙事型" },
      { name: "调研观察笔记", file: "skills/od-field-notes-editorial/SKILL.md", prompt: "帮我把【访谈】整理成观察笔记风页面，有时间线和引用，直接开始做。", note: "研究记录" },
      { name: "原则宣言页", file: "skills/od-editorial-burgundy/SKILL.md", prompt: "帮我做【团队】五条原则单页，酒红编辑风，直接开始做。", note: "宣言式" },
      { name: "金融可信风", file: "skills/od-digits-fintech/SKILL.md", prompt: "帮我做【理财工具】介绍页，冷静网格、强调数据可信，直接开始做。", note: "金融科技气质" },
      { name: "研究决策看板", file: "skills/od-research-decision-room/SKILL.md", prompt: "帮我把【结论】做成决策看板：证据、建议、优先级，直接开始做。", note: "研究落地" },
      { name: "作品集", file: "skills/od-swiss-creative/SKILL.md", prompt: "帮我做【设计师】作品集，网格展示项目，直接开始做。", note: "创意展示" },
    ],
  },
  {
    group: "办公与个人",
    items: [
      { name: "版本发布说明", file: "skills/od-release-notes-one-pager/SKILL.md", prompt: "帮我做【版本号】更新说明一页：新功能、修复、升级注意，直接开始做。", note: "发给用户的更新页" },
      { name: "求职简历", file: "skills/od-resume/SKILL.md", prompt: "根据我提供的信息做一页简历网页：【粘贴经历】，直接开始做。", note: "仅使用真实信息" },
    ],
  },
  {
    group: "总控与规范（自动参与）",
    items: [
      { name: "设计总控", file: "skills/open-design/SKILL.md", prompt: "（无需单独说）描述目标即可；系统会先澄清风格与结构。", note: "路由到具体类别" },
      { name: "五种视觉方向", file: "skills/open-design/references/directions.md", prompt: "风格想要【简洁现代 / 杂志编辑 / 温暖亲切 / 数据工具 / 实验粗犷】之一。", note: "无品牌时的默认选项" },
      { name: "设备外框", file: "skills/open-design/assets/frames/", prompt: "请把手机界面放在 iPhone 外框里展示 / 多屏并排。", note: "iphone-15-pro、android-pixel 等" },
    ],
  },
];

function designSystemPrompt(slug, title) {
  const short = title.replace(/^Design System Inspired by\s+/i, "").trim();
  return `风格请参考【${short}】那种感觉（设计系统：${slug}），直接开始做。`;
}

async function loadDesignSystems() {
  const indexPath = path.join(DS_DIR, "_index.md");
  const content = await fs.readFile(indexPath, "utf8");
  const sections = [];
  let current = null;

  for (const line of content.split(/\r?\n/)) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      if (current) sections.push(current);
      current = { category: h2[1], items: [] };
      continue;
    }
    const item = line.match(/^- \[`([^`]+)`\]\([^)]+\) — (.+)$/);
    if (item && current) {
      const slug = item[1].replace(/\.md$/, "");
      current.items.push({ slug, title: item[2] });
    }
  }
  if (current) sections.push(current);
  return sections;
}

async function main() {
  const dsSections = await loadDesignSystems();
  const totalDs = dsSections.reduce((n, s) => n + s.items.length, 0);
  const generatedAt = new Date().toISOString().slice(0, 10);

  const lines = [
    "# Open Design 设计能力目录（静态帮助）",
    "",
    "> **维护说明（必守）**",
    "> - 本文档随 PilotDeck 接入 Open Design 的变更而更新。",
    "> - 新增/调整 `skills/od-*` 或设计系统后：运行 `node scripts/sync-open-design-systems.mjs`，再运行 `node scripts/generate-open-design-catalog.mjs`。",
    "> - 用户面向复制例句也可同步改 `docs/open-design-prompt-examples.md`。",
    "> - 记录在 `AGENTS.md` 与 `docs/open-design-admin-guide.md`。",
    "",
    "**文档版本日期：** " + generatedAt,
    "**设计系统数量：** " + totalDs + " 套",
    "**表面技能数量：** 27 个 od-* + frontend-slides",
    "",
    "---",
    "",
    "## 一、当前可设计的类别",
    "",
    "在 PilotDeck 对话中用下表「提问示例」即可；不必记内部文件名。",
    "",
  ];

  for (const { group, items } of CATEGORIES) {
    lines.push(`### ${group}`, "");
    lines.push("| 可设计内容 | 对应文件 | 提问示例 | 说明 |");
    lines.push("|------------|----------|----------|------|");
    for (const it of items) {
      lines.push(`| ${it.name} | \`${it.file}\` | ${it.prompt} | ${it.note} |`);
    }
    lines.push("");
  }

  lines.push("---", "", "## 二、视觉方向（5 选 1）", "", "| 方向 | 文件 | 提问时可说 |", "|------|------|------------|");
  const directions = [
    ["现代极简", "skills/open-design/references/directions.md", "简洁、冷静、像科技公司官网"],
    ["杂志编辑", "同上", "像杂志专栏、叙事感、排版讲究"],
    ["温暖亲切", "同上", "柔和、适合消费级或教育产品"],
    ["数据工具", "同上", "信息密度高、偏后台与数据产品"],
    ["实验粗犷", "同上", "大胆、活动或独立品牌感"],
  ];
  for (const row of directions) lines.push(`| ${row[0]} | \`${row[1]}\` | ${row[2]} |`);
  lines.push("", "---", "", "## 三、设计系统（完整版）", "");
  lines.push("生成页面时可指定品牌气质；Agent 会读取 `skills/open-design/references/design-systems/<slug>.md`。", "");
  lines.push("| 分类 | 标识（slug） | 文件 | 提问时可说 |", "|------|-------------|------|------------|");

  for (const sec of dsSections) {
    for (const { slug, title } of sec.items) {
      const file = `skills/open-design/references/design-systems/${slug}.md`;
      lines.push(`| ${sec.category} | ${slug} | \`${file}\` | ${designSystemPrompt(slug, title)} |`);
    }
  }

  lines.push(
    "",
    "---",
    "",
    "## 四、媒体与自动化能力（PilotDeck 内）",
    "",
    "| 类型 | 说明 |",
    "|------|------|",
    "| 图片文件 png | 使用 `generate_image`，输出到工作区 |",
    "| 视频文件 mp4 | 使用 `generate_video`，输出到工作区 |",
    "| HTML 导出 MP4 | 使用 `render_html_video` 将本地 html 渲染为 mp4 |",
    "| Figma 自动化 | 配置 MCP 后可用 `mcp__figma__*` 工具 |",
    "",
    "详见 `docs/open-design-prompt-examples.md` 第七节与 `docs/open-design-admin-guide.md`。",
    "",
    "---",
    "",
    "## 五、相关文档",
    "",
    "| 文档 | 用途 |",
    "|------|------|",
    "| `docs/open-design-prompt-examples.md` | 非技术用户可复制提问 |",
    "| `docs/open-design-user-agent-manual.md` | 使用说明 |",
    "| `docs/open-design-admin-guide.md` | 迁移、同步、联调 |",
    "",
  );

  await fs.writeFile(OUT, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(REPO_ROOT, OUT)} (${totalDs} design systems)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
