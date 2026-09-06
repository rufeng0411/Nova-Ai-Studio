#!/usr/bin/env node
/**
 * 全球 Agent Skills 调研表（≥700 条 · 多平台 · 中文介绍）
 * 用法: node scripts/generate-global-skills-discovery.mjs
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getIndustryZh,
  getIntroZh,
  getScopeZh,
  getSourceLabel,
} from './lib/skillsDiscoveryZh.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(REPO_ROOT, 'docs', 'skills-global-discovery-300plus.md');
const EXISTING_PATH = path.join(REPO_ROOT, 'docs', '.existing-skills-temp.json');
const MIN_OUTPUT = 700;

const AGENT_TOOLS = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.cursor',
  'projects',
  'f-Ai-pilotdeck',
  'agent-tools',
);

const CACHE_FILES = [
  { file: 'c180c8ad-4d18-4f66-89bd-405085899725.txt', platform: 'officialskills.sh / GitHub' },
  { file: '8f403db1-0c72-4a6a-9d73-31dcc10bd7a5.txt', platform: 'agent-skill.co' },
];

/** skills.sh 安装榜补充（非 GitHub 主链或高安装量项） */
const SKILLS_SH_LEADERBOARD = [
  ['vercel-labs', 'react-best-practices', 'https://skills.sh/vercel-labs/skills/react-best-practices', 'React 性能与架构最佳实践（skills.sh 榜首级）', 5],
  ['vercel-labs', 'next-best-practices', 'https://skills.sh/vercel-labs/skills/next-best-practices', 'Next.js 路由、缓存与部署最佳实践', 5],
  ['vercel-labs', 'web-design-guidelines', 'https://skills.sh/vercel-labs/skills/web-design-guidelines', 'Web 设计规范与可访问性质量标准', 5],
  ['vercel-labs', 'agent-browser', 'https://skills.sh/vercel-labs/skills/agent-browser', 'Agent 驱动浏览器自动化与页面交互', 4],
  ['vercel-labs', 'find-skills', 'https://skills.sh/vercel-labs/skills/find-skills', '发现并安装社区 Skills 的检索助手', 4],
];

/** Claude 合作伙伴 Skills（Anthropic 官方目录 · 非 GitHub 仓库形态） */
const PARTNER_SKILLS = [
  ['anthropic-partners', 'asana', 'https://claude.com/partners/skills/asana', 'Asana 项目与任务管理集成 Skill', 4],
  ['anthropic-partners', 'notion', 'https://claude.com/partners/skills/notion', 'Notion 页面与数据库协作 Skill', 4],
  ['anthropic-partners', 'figma', 'https://claude.com/partners/skills/figma', 'Figma 设计稿读取与还原 Skill', 5],
  ['anthropic-partners', 'linear', 'https://claude.com/partners/skills/linear', 'Linear Issue 与路线图管理 Skill', 4],
  ['anthropic-partners', 'stripe', 'https://claude.com/partners/skills/stripe', 'Stripe 支付与订阅管理 Skill', 5],
  ['anthropic-partners', 'slack', 'https://claude.com/partners/skills/slack', 'Slack 频道消息与通知 Skill', 4],
  ['anthropic-partners', 'github', 'https://claude.com/partners/skills/github', 'GitHub PR、Issue 与代码审查 Skill', 5],
  ['anthropic-partners', 'box', 'https://claude.com/partners/skills/box', 'Box 企业文件存储与共享 Skill', 4],
  ['anthropic-partners', 'canva', 'https://claude.com/partners/skills/canva', 'Canva 模板设计与品牌物料 Skill', 4],
  ['anthropic-partners', 'intercom', 'https://claude.com/partners/skills/intercom', 'Intercom 客服对话与用户洞察 Skill', 4],
];

/** SkillsMP 索引中的高星/高关注项（skillsmp.com 聚合） */
const SKILLSMP_CURATED = [
  ['skillsmp', 'marketing-stack', 'https://skillsmp.com/skills/coreyhaines31-marketingskills', 'SaaS 营销全栈：SEO、CRO、邮件与定价（SkillsMP 聚合）', 4],
  ['skillsmp', 'context-engineering', 'https://skillsmp.com/skills/muratcankoylan-agent-skills-for-context-engineering', '上下文压缩、记忆系统与长会话工程（SkillsMP）', 4],
  ['skillsmp', 'pm-dean-peters', 'https://skillsmp.com/skills/deanpeters-product-manager-skills', '46 项 PM 技能：假设、PRD、路线图（SkillsMP）', 4],
  ['skillsmp', 'pm-phuryn', 'https://skillsmp.com/skills/phuryn-pm-skills', '65 项产品策略与市场调研框架（SkillsMP）', 4],
  ['skillsmp', 'antigravity-skills', 'https://skillsmp.com/skills/antigravity-awesome-skills', 'Antigravity 兼容技能合集 1200+（SkillsMP）', 4],
  ['skillsmp', 'microsoft-azure', 'https://skillsmp.com/skills/microsoft-agent-skills', 'Microsoft Azure / AI Foundry 133 域技能（SkillsMP）', 5],
  ['skillsmp', 'firecrawl-web', 'https://skillsmp.com/skills/firecrawl-cli', 'Firecrawl 网页抓取、搜索与 Agent 爬取（SkillsMP）', 4],
  ['skillsmp', 'typefully-social', 'https://skillsmp.com/skills/typefully-skills', 'Typefully 社媒排期与增长文案（SkillsMP）', 4],
];

const EXTRA_SOURCES = [
  {
    category: 'Claude 官方文档技能（anthropics/skills · 未 vendor 项）',
    platform: 'GitHub / skills.sh',
    stars: 5,
    items: [
      ['anthropics', 'pptx', 'https://github.com/anthropics/skills/tree/main/skills/pptx', '创建/编辑 PowerPoint，提案与比稿 deck'],
      ['anthropics', 'pdf', 'https://github.com/anthropics/skills/tree/main/skills/pdf', 'PDF 提取、合并、表单与交付'],
      ['anthropics', 'xlsx', 'https://github.com/anthropics/skills/tree/main/skills/xlsx', 'Excel 预算表、投放排期、数据导出'],
      ['anthropics', 'algorithmic-art', 'https://github.com/anthropics/skills/tree/main/skills/algorithmic-art', 'p5.js 生成艺术、活动视觉探索'],
      ['anthropics', 'canvas-design', 'https://github.com/anthropics/skills/tree/main/skills/canvas-design', 'PNG/PDF 视觉设计画布输出'],
      ['anthropics', 'slack-gif-creator', 'https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator', 'Slack 尺寸优化 GIF 动图'],
      ['anthropics', 'webapp-testing', 'https://github.com/anthropics/skills/tree/main/skills/webapp-testing', 'Playwright 本地 Web 应用测试'],
      ['anthropics', 'doc-coauthoring', 'https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring', '协作文档共创流程'],
      ['anthropics', 'theme-factory', 'https://github.com/anthropics/skills/tree/main/skills/theme-factory', '多品牌 campaign 主题换肤'],
      ['anthropics', 'mcp-builder', 'https://github.com/anthropics/skills/tree/main/skills/mcp-builder', '构建 MCP 服务器集成外部 API'],
      ['anthropics', 'skill-creator', 'https://github.com/anthropics/skills/tree/main/skills/skill-creator', '编写新 Skill 方法论'],
      ['anthropics', 'brand-guidelines', 'https://github.com/anthropics/skills/tree/main/skills/brand-guidelines', '品牌色、字体与语气规范'],
      ['anthropics', 'internal-comms', 'https://github.com/anthropics/skills/tree/main/skills/internal-comms', '内部周报、FAQ、状态更新'],
    ],
  },
  {
    category: '待整合 GitHub 项目（AGENTS.md P0-P2）',
    platform: 'GitHub',
    stars: 4,
    items: [
      ['postiz', 'postiz-mcp', 'https://github.com/gitroomhq/postiz-app', '海外社媒一键发布 + MCP，矩阵分发'],
      ['pixelle-video', 'short-video', 'https://github.com/PixelleLab/Pixelle-Video', 'AI 短视频生成与口播剪辑'],
      ['chnjames', 'aigeotools-geo', 'https://github.com/chnjames/AIGEOTOOLS', 'GEO 生成式引擎优化与内容布局'],
    ],
  },
];

const ORG_TIER = {
  anthropics: 5,
  google: 5,
  'google-gemini': 5,
  'google-labs': 5,
  vercel: 5,
  'vercel-labs': 5,
  stripe: 5,
  microsoft: 5,
  openai: 5,
  figma: 5,
  sentry: 5,
  cloudflare: 5,
  supabase: 5,
  hashicorp: 5,
  mongodb: 5,
  firebase: 5,
  expo: 5,
  huggingface: 5,
  'hugging-face': 5,
  trailofbits: 5,
  netlify: 5,
  neon: 5,
  clickhouse: 5,
  remotion: 5,
  replicate: 5,
  composiohq: 4,
  betterauth: 4,
  'better-auth': 4,
  tinybirdco: 4,
  callstackincubator: 4,
  voltagent: 4,
  angular: 4,
  trycourier: 4,
  sanity: 4,
  firecrawl: 4,
  typefully: 4,
  wordpress: 5,
  flutter: 4,
  redis: 4,
  nvidia: 5,
  datadog: 4,
  auth0: 4,
  browserbase: 4,
  coinbase: 4,
  binance: 4,
  notion: 4,
  resend: 4,
  apollographql: 4,
  coreyhaines31: 4,
  marketingskills: 4,
  'anthropic-partners': 4,
  skillsmp: 4,
};

function loadExisting() {
  if (!existsSync(EXISTING_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(EXISTING_PATH, 'utf8')));
}

function normalizeExistingSlug(slug) {
  return slug.toLowerCase().replace(/_/g, '-');
}

function alreadyHave(existing, skillSlug, owner) {
  const s = normalizeExistingSlug(skillSlug);
  const candidates = new Set([
    s,
    `mkt-${s}`,
    `df-${s}`,
    `ala-${s}`,
    `pms-${s}`,
    `anth-${s}`,
    `od-${s}`,
    s.replace(/^mkt-/, ''),
    s.replace(/^df-/, ''),
    s.replace(/^ala-/, ''),
    s.replace(/^anth-/, ''),
    s.replace(/^od-/, ''),
  ]);
  for (const c of candidates) {
    if (existing.has(c)) return true;
  }
  if (owner === 'anthropics' && existing.has(`anth-${s}`)) return true;
  if (owner === 'coreyhaines31' && existing.has(`mkt-${s}`)) return true;
  if (s === 'docx' && existing.has('anth-docx')) return true;
  if (s === 'frontend-design' && existing.has('df-frontend-design')) return true;
  if (s === 'web-artifacts-builder' && existing.has('od-web-artifacts-builder')) return true;
  if (s === 'find-skills' && existing.has('df-find-skills')) return true;
  return false;
}

function inferIntegration(owner, skillSlug, desc) {
  const d = desc.toLowerCase();
  if (/mcp|api key|oauth|stripe|firebase|supabase|figma token|docker compose/.test(d)) {
    return `L3：MCP/凭据 + \`npx skills add ${owner}/skills --skill ${skillSlug}\` + bootstrap`;
  }
  if (/terraform|provider|acceptance test|sdk guidelines/.test(d)) {
    return `L2：vendor 至 skills/vendor/ + 冒烟脚本`;
  }
  if (owner === 'anthropic-partners' || owner === 'skillsmp') {
    return 'L3：合作伙伴/MCP 凭据 + pilotdeck.yaml + 能力中心 overrides';
  }
  return `L1：\`npx skills add ${owner}/skills --skill ${skillSlug}\` → bootstrap → 能力中心`;
}

function inferStars(owner, sectionStars = 4) {
  const key = owner.toLowerCase().replace(/[^a-z0-9-]/g, '');
  for (const [k, v] of Object.entries(ORG_TIER)) {
    if (key.includes(k.replace(/[^a-z0-9-]/g, ''))) return v;
  }
  return sectionStars;
}

function inferPlatformFromUrl(url, fallback) {
  if (url.includes('skills.sh') || url.includes('officialskills.sh')) return 'skills.sh';
  if (url.includes('agent-skill.co')) return 'agent-skill.co';
  if (url.includes('skillsmp.com')) return 'SkillsMP';
  if (url.includes('claude.com/partners')) return 'Claude 合作伙伴';
  if (url.includes('github.com')) return 'GitHub';
  return fallback || '多源索引';
}

function skillSlugFromUrl(url, fallbackName) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const skillsIdx = parts.indexOf('skills');
    if (skillsIdx >= 0 && parts[skillsIdx + 1]) return parts[skillsIdx + 1];
    if (parts.length >= 2 && parts[parts.length - 1] !== 'skills') {
      return parts[parts.length - 1].replace(/\.md$/, '');
    }
  } catch {
    /* ignore */
  }
  return fallbackName;
}

function pushItem(items, raw) {
  const {
    owner,
    skillSlug,
    url,
    desc,
    section = 'Community',
    stars,
    sourcePlatform,
  } = raw;
  if (!owner || !skillSlug || !desc) return;
  items.push({
    owner: owner.trim(),
    skillSlug: skillSlug.trim(),
    url: (url || '').trim(),
    desc: desc.trim(),
    section,
    stars: stars ?? inferStars(owner, 3),
    sourcePlatform: sourcePlatform || inferPlatformFromUrl(url, 'GitHub'),
  });
}

/** VoltAgent / officialskills.sh: - **[owner/skill](url)** - desc */
function parseBoldList(text, defaultPlatform) {
  const items = [];
  let section = 'Community';
  let sectionDefaultStars = 4;

  for (const line of text.split(/\r?\n/)) {
    const h3 = line.match(/^#{2,4}\s+(.+)$/);
    if (h3) {
      const title = h3[1].trim();
      if (!/using skills|creating skills|faq|contributing|license|contact/i.test(title)) {
        section = title.replace(/^Skills by\s+/i, 'Skills by ').trim();
        sectionDefaultStars = /community/i.test(section) ? 3 : /official|claude|anthropic/i.test(section) ? 5 : 4;
      }
      continue;
    }

    const bareTitle = line.trim();
    if (
      bareTitle &&
      !bareTitle.startsWith('-') &&
      !bareTitle.startsWith('|') &&
      !bareTitle.includes('[') &&
      bareTitle.length >= 8 &&
      bareTitle.length <= 72 &&
      /skills|official|marketing|community|product|security|cloud|development|context|claude|terraform|gemini|stripe|vector|productivity|testing|engineering/i.test(
        bareTitle,
      )
    ) {
      section = bareTitle;
      sectionDefaultStars = /community/i.test(section) ? 3 : /official|claude|anthropic/i.test(section) ? 5 : 4;
      continue;
    }

    const bold = line.match(/^-\s+\*\*\[([^/]+)\/([^\]]+)\]\(([^)]+)\)\*\*\s*-\s*(.+)$/);
    if (bold) {
      const [, owner, skillSlug, url, desc] = bold;
      pushItem(items, {
        owner,
        skillSlug,
        url,
        desc,
        section,
        stars: inferStars(owner, sectionDefaultStars),
        sourcePlatform: inferPlatformFromUrl(url, defaultPlatform),
      });
      continue;
    }

    const plain = line.match(/^-\s+\[([^/]+)\/([^\]]+)\]\(([^)]+)\)\s*-\s*(.+)$/);
    if (plain) {
      const [, owner, skillSlug, url, desc] = plain;
      pushItem(items, {
        owner,
        skillSlug,
        url,
        desc,
        section,
        stars: inferStars(owner, sectionDefaultStars),
        sourcePlatform: inferPlatformFromUrl(url, defaultPlatform),
      });
      continue;
    }

    const repoOnly = line.match(/^-\s+\[([^/]+)\/([^\]]+)\]\(([^)]+)\)\s*-\s*(.+)$/);
    if (repoOnly) {
      const [, owner, repo, url, desc] = repoOnly;
      const slug = skillSlugFromUrl(url, repo);
      pushItem(items, {
        owner,
        skillSlug: slug,
        url,
        desc,
        section,
        stars: inferStars(owner, 3),
        sourcePlatform: inferPlatformFromUrl(url, defaultPlatform),
      });
    }

    const table = line.match(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|?\s*$/);
    if (table && !table[1].includes('---') && table[1] !== 'Skill') {
      const [, name, url, desc] = table;
      const parts = name.split('/');
      const owner = parts.length >= 2 ? parts[0] : 'community';
      const skillSlug = parts.length >= 2 ? parts.slice(1).join('-') : name;
      pushItem(items, {
        owner,
        skillSlug,
        url,
        desc,
        section,
        stars: inferStars(owner, 3),
        sourcePlatform: inferPlatformFromUrl(url, defaultPlatform),
      });
    }
  }
  return items;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.owner}/${item.skillSlug}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sortByPriority(items) {
  return [...items].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    const tier = (o) => ORG_TIER[o.toLowerCase()] || 0;
    return tier(b.owner) - tier(a.owner);
  });
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function buildInstallCell(item) {
  const platform = getSourceLabel(item);
  const link = item.url || `https://github.com/${item.owner}/skills`;
  let install = '';
  if (item.url.includes('github.com') && !item.url.includes('/tree/')) {
    install = `\`npx skills add ${item.owner}/skills --skill ${item.skillSlug}\``;
  } else if (item.url.includes('github.com')) {
    install = `\`npx skills add ${item.owner}/skills --skill ${item.skillSlug}\``;
  } else {
    install = '见链接安装或粘贴 SKILL.md';
  }
  return `[${platform}](${link}) · ${install}`;
}

function toTableRow(item, index) {
  const name = `${item.owner}/${item.skillSlug}`;
  const industry = getIndustryZh(item.section, item.owner, item.desc);
  const intro = escapeCell(getIntroZh(item));
  const scope = escapeCell(getScopeZh(item, industry));
  const integration = inferIntegration(item.owner, item.skillSlug, item.desc);
  const stars = '★'.repeat(item.stars) + '☆'.repeat(5 - item.stars);
  return `| ${index} | ${name} | ${intro} | ${industry} | ${buildInstallCell(item)} | ${scope} | ${integration} | ${stars} |`;
}

function readCache(name) {
  const p = path.join(AGENT_TOOLS, name);
  if (!existsSync(p)) return '';
  let text = readFileSync(p, 'utf8');
  const idx = text.indexOf('## Table of Contents');
  if (idx >= 0) text = text.slice(idx);
  return text;
}

function main() {
  const existing = loadExisting();
  let all = [];

  for (const { file, platform } of CACHE_FILES) {
    const text = readCache(file);
    if (text) {
      all.push(...parseBoldList(text, platform));
      console.log(`[skills-discovery] parsed ${file}: +${parseBoldList(text, platform).length} (may overlap)`);
    } else {
      console.warn(`[skills-discovery] cache missing: ${file}`);
    }
  }

  all = dedupe(all);

  for (const src of EXTRA_SOURCES) {
    for (const [owner, skillSlug, url, desc] of src.items) {
      pushItem(all, {
        owner,
        skillSlug,
        url,
        desc,
        section: src.category,
        stars: src.stars,
        sourcePlatform: src.platform,
      });
    }
  }

  for (const [owner, skillSlug, url, desc, stars] of SKILLS_SH_LEADERBOARD) {
    pushItem(all, {
      owner,
      skillSlug,
      url,
      desc,
      section: 'skills.sh 安装榜（Vercel 生态 telemetry）',
      stars,
      sourcePlatform: 'skills.sh',
    });
  }

  for (const [owner, skillSlug, url, desc, stars] of PARTNER_SKILLS) {
    pushItem(all, {
      owner,
      skillSlug,
      url,
      desc,
      section: 'Claude 合作伙伴目录（Partner Skills）',
      stars,
      sourcePlatform: 'Claude 合作伙伴',
    });
  }

  for (const [owner, skillSlug, url, desc, stars] of SKILLSMP_CURATED) {
    pushItem(all, {
      owner,
      skillSlug,
      url,
      desc,
      section: 'SkillsMP 精选索引（跨 GitHub 聚合）',
      stars,
      sourcePlatform: 'SkillsMP',
    });
  }

  all = dedupe(all);
  const missing = sortByPriority(all.filter((item) => !alreadyHave(existing, item.skillSlug, item.owner)));

  const selected =
    missing.length >= MIN_OUTPUT ? missing : missing.slice(0, Math.max(MIN_OUTPUT, missing.length));

  if (missing.length < MIN_OUTPUT) {
    console.warn(`[skills-discovery] 未接入仅 ${missing.length} 条，不足 ${MIN_OUTPUT}；已全量输出`);
  }

  const platformStats = {};
  const industryStats = {};
  for (const item of selected) {
    const p = getSourceLabel(item);
    platformStats[p] = (platformStats[p] || 0) + 1;
    const ind = getIndustryZh(item.section, item.owner, item.desc);
    industryStats[ind] = (industryStats[ind] || 0) + 1;
  }

  const lines = [
    '# 全球 Agent Skills 调研目录（本项目未接入 · ≥700 项 · 多平台）',
    '',
    `> 生成时间：${new Date().toISOString().slice(0, 10)}`,
    '> 数据来源：**不限于 GitHub** — [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)（1424+）、[heilcheng/awesome-agent-skills / agent-skill.co](https://agent-skill.co)、[skills.sh](https://skills.sh) 安装榜、[SkillsMP](https://skillsmp.com) 聚合、[Claude 合作伙伴 Skills](https://claude.com/partners/skills)、[anthropics/skills](https://github.com/anthropics/skills)、AGENTS.md 待整合项。',
    `> 本项目已接入 **${existing.size}** 项（含 Hermes 教育、Marketing、Open Design、DeerFlow、ALA 等），下表为**未接入**候选；**介绍、行业/类型、应用范围均为中文**。`,
    '',
    '## 评星说明',
    '',
    '| 星级 | 含义 |',
    '|------|------|',
    '| ★★★★★ | 官方/大厂维护、生态安装量高、文档完整 |',
    '| ★★★★☆ | 知名团队或高星仓库子技能 |',
    '| ★★★☆☆ | 社区技能，接入前建议人工审 SKILL.md |',
    '',
    '## 集成方式说明（PilotDeck）',
    '',
    '| 级别 | 做法 |',
    '|------|------|',
    '| **L1** | npx skills add + bootstrap-pilotdeck-config.mjs + capabilities:gen |',
    '| **L2** | scripts/vendor-*.mjs 同步至 skills/vendor/ + 冒烟 |',
    '| **L3** | MCP / pilotdeck.yaml 凭据 + L2 或能力中心 overrides |',
    '',
    '## 按来源平台统计',
    '',
    '| 来源平台 | 数量 |',
    '|----------|------|',
  ];

  for (const [k, v] of Object.entries(platformStats).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${v} |`);
  }

  lines.push('', '## 按行业/类型统计（全表）', '', '| 行业/类型 | 数量 |', '|----------|------|');
  for (const [k, v] of Object.entries(industryStats).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${v} |`);
  }

  lines.push('', '## 完整清单', '');
  lines.push(
    '| # | 名称 | 介绍 | 行业/类型 | 下载/安装 | 应用范围 | 集成到本系统 | 评星 |',
    '|---|------|------|----------|-----------|----------|--------------|------|',
  );

  selected.forEach((item, i) => {
    lines.push(toTableRow(item, i + 1));
  });

  lines.push(
    '',
    '---',
    '',
    `**合计：${selected.length} 项**（多源扫描 ${all.length} 项，排除已接入 ${all.length - missing.length} 项，目标 ≥${MIN_OUTPUT}）`,
    '',
  );

  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${lines.join('\n')}\n`, 'utf8');
  console.log(`[skills-discovery] wrote ${OUTPUT}`);
  console.log(`[skills-discovery] selected=${selected.length} missing=${missing.length} total_scanned=${all.length}`);
}

main();
