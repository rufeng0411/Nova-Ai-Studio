#!/usr/bin/env node
/**
 * Skills + MCP 全场景调研表（≥500 条 · 多平台 · 中文）
 * 用法: node scripts/generate-skills-mcp-discovery-500plus.mjs
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
import {
  HOT_MCP_CURATED,
  mapMcpCategory,
  mcpIntroZh,
  mcpScopeZh,
} from './lib/skillsMcpScenarios.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(REPO_ROOT, 'docs', 'skills-mcp-discovery-500plus.md');
const EXISTING_PATH = path.join(REPO_ROOT, 'docs', '.existing-skills-temp.json');
const MIN_TOTAL = 500;
const SKILL_QUOTA = 420;
const MCP_QUOTA = 180;

const AGENT_TOOLS = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.cursor',
  'projects',
  'f-Ai-pilotdeck',
  'agent-tools',
);

const SKILL_CACHES = [
  { file: 'c180c8ad-4d18-4f66-89bd-405085899725.txt', platform: 'officialskills.sh' },
  { file: '8f403db1-0c72-4a6a-9d73-31dcc10bd7a5.txt', platform: 'agent-skill.co' },
];
const MCP_CACHE = '4103185d-de64-4d9f-b406-fc360bd22b40.txt';

const ORG_TIER = {
  anthropics: 5, google: 5, vercel: 5, stripe: 5, microsoft: 5, openai: 5,
  remotion: 5, cloudflare: 5, supabase: 5, figma: 5, firecrawl: 5, notion: 5,
  googleworkspace: 5, composiohq: 4, coreyhaines31: 4, trailofbits: 5,
};

function loadExisting() {
  if (!existsSync(EXISTING_PATH)) return new Set();
  return new Set(JSON.parse(readFileSync(EXISTING_PATH, 'utf8')));
}

function normalizeSlug(s) {
  return s.toLowerCase().replace(/_/g, '-');
}

function isIntegrated(existing, slug, owner) {
  const s = normalizeSlug(slug);
  const cands = new Set([s, `mkt-${s}`, `df-${s}`, `od-${s}`, `anth-${s}`, `ala-${s}`]);
  for (const c of cands) if (existing.has(c)) return true;
  if (owner === 'anthropics' && existing.has(`anth-${s}`)) return true;
  if (s === 'docx' && existing.has('anth-docx')) return true;
  return false;
}

function inferStars(owner, base = 3) {
  const k = (owner || '').toLowerCase();
  for (const [org, v] of Object.entries(ORG_TIER)) {
    if (k.includes(org)) return v;
  }
  return base;
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function readCache(name, sliceAt) {
  const p = path.join(AGENT_TOOLS, name);
  if (!existsSync(p)) return '';
  let text = readFileSync(p, 'utf8');
  if (sliceAt) {
    const idx = text.indexOf(sliceAt);
    if (idx >= 0) text = text.slice(idx);
  }
  return text;
}

function pushSkill(items, raw) {
  const { owner, skillSlug, url, desc, section, stars, sourcePlatform } = raw;
  if (!owner || !skillSlug) return;
  items.push({
    kind: 'Skill',
    id: `${owner}/${skillSlug}`.toLowerCase(),
    name: `${owner}/${skillSlug}`,
    owner,
    skillSlug,
    url: url || '',
    desc: desc || '',
    section: section || 'Community',
    stars: stars ?? 3,
    sourcePlatform: sourcePlatform || 'GitHub',
  });
}

function parseSkills(text, defaultPlatform) {
  const items = [];
  let section = 'Community';
  let sectionStars = 4;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^#{2,4}\s+(.+)$/);
    if (h) {
      section = h[1].trim();
      sectionStars = /community/i.test(section) ? 3 : /official|claude/i.test(section) ? 5 : 4;
      continue;
    }
    const bare = line.trim();
    if (bare && !bare.startsWith('-') && !bare.startsWith('|') && !bare.includes('[') && bare.length >= 8 && bare.length <= 72 && /skill/i.test(bare)) {
      section = bare;
      continue;
    }
    const bold = line.match(/^-\s+\*\*\[([^/]+)\/([^\]]+)\]\(([^)]+)\)\*\*\s*-\s*(.+)$/);
    if (bold) {
      const [, owner, skillSlug, url, desc] = bold;
      pushSkill(items, { owner, skillSlug, url, desc, section, stars: inferStars(owner, sectionStars), sourcePlatform: defaultPlatform });
      continue;
    }
    const plain = line.match(/^-\s+\[([^/]+)\/([^\]]+)\]\(([^)]+)\)\s*-\s*(.+)$/);
    if (plain) {
      const [, owner, skillSlug, url, desc] = plain;
      pushSkill(items, { owner, skillSlug, url, desc, section, stars: inferStars(owner, sectionStars), sourcePlatform: defaultPlatform });
    }
  }
  return items;
}

function parseAwesomeMcp(text) {
  const items = [];
  let category = 'Developer Tools';
  let categoryDesc = '';

  for (const line of text.split(/\r?\n/)) {
    const h2 = line.match(/^###\s+(.+)$/);
    if (h2) {
      category = h2[1].trim();
      categoryDesc = '';
      continue;
    }
    if (line.startsWith('### ') === false && line.length > 40 && !line.startsWith('-') && !line.startsWith('|') && !line.startsWith('#')) {
      if (/enables AI|provides|MCP server/i.test(line)) categoryDesc = line.trim();
    }

    const gh = line.match(/\[([^\]]+)\]\((https:\/\/github\.com\/[^)]+)\)/);
    if (!line.startsWith('-') || !gh) continue;

    const displayName = gh[1].trim();
    const url = gh[2].trim();
    const parts = url.replace('https://github.com/', '').split('/');
    const owner = parts[0] || 'community';
    const repo = parts[1] || displayName;

    let desc = line.replace(/\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[🎖️📇🏎️🦀#️⃣☕🌊💎☁️🏠📟🍎🪟🐧]+/g, ' ');
    const dash = desc.match(/\s+-\s+(.+)$/);
    desc = dash ? dash[1].trim() : desc.replace(/^-\s*/, '').trim();
    desc = desc.replace(/\s{2,}/g, ' ');
    if (!desc || desc.length < 8) desc = categoryDesc || `${displayName} MCP integration`;

    const official = line.includes('🎖️');
    items.push({
      kind: 'MCP',
      id: `mcp:${owner}/${repo}`.toLowerCase(),
      name: displayName.includes('/') ? displayName : `${owner}/${repo}`,
      url,
      desc,
      category,
      stars: official ? 5 : desc.length > 120 ? 4 : 3,
      sourcePlatform: 'Glama / GitHub',
    });
  }
  return items;
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

function skillRow(item, idx, existing) {
  const scenario = getIndustryZh(item.section, item.owner, item.desc);
  const intro = escapeCell(getIntroZh(item));
  const scope = escapeCell(getScopeZh(item, scenario));
  const status = isIntegrated(existing, item.skillSlug, item.owner) ? '✅ 已接入' : '未接入';
  const link = item.url || `https://github.com/${item.owner}/skills`;
  const install = item.url.includes('github.com')
    ? `\`npx skills add ${item.owner}/skills --skill ${item.skillSlug}\``
    : '见链接';
  const stars = '★'.repeat(item.stars) + '☆'.repeat(5 - item.stars);
  const integration = status === '✅ 已接入' ? 'L1 本仓/bootstrap' : 'L1–L3 见 ad-pr 目录';
  return `| ${idx} | Skill | ${item.name} | ${scenario} | ${intro} | [${getSourceLabel(item)}](${link}) | ${scope} | ${status} | ${integration} | ${stars} |`;
}

function mcpRow(item, idx, statusOverride) {
  const scenario = item.scenarioZh || mapMcpCategory(item.category);
  const intro = escapeCell(mcpIntroZh(item.desc, item.name, scenario));
  const scope = escapeCell(mcpScopeZh(scenario));
  const status = statusOverride || '未接入';
  const stars = '★'.repeat(item.stars) + '☆'.repeat(5 - item.stars);
  const integration = item.integration || 'L3：mcp.json + 凭据';
  const url = item.url || 'https://glama.ai/mcp/servers';
  return `| ${idx} | MCP | ${item.name} | ${scenario} | ${intro} | [${item.sourcePlatform || 'MCP'}](${url}) | ${scope} | ${status} | ${integration} | ${stars} |`;
}

function main() {
  const existing = loadExisting();
  let skills = [];
  for (const { file, platform } of SKILL_CACHES) {
    const text = readCache(file, '## Table of Contents');
    if (text) skills.push(...parseSkills(text, platform));
  }
  skills = dedupeById(skills);
  skills.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));

  let mcps = [];
  const mcpText = readCache(MCP_CACHE, '## Server Implementations');
  if (mcpText) mcps.push(...parseAwesomeMcp(mcpText));
  mcps = dedupeById(mcps);

  for (const [id, display, url, scenario, desc, stars, integration] of HOT_MCP_CURATED) {
    mcps.unshift({
      kind: 'MCP',
      id: `curated:${id}`,
      name: display,
      url,
      desc,
      category: scenario,
      scenarioZh: scenario,
      stars,
      sourcePlatform: '精选',
      integration,
    });
  }
  mcps = dedupeById(mcps);

  const selectedSkills = skills.slice(0, Math.min(SKILL_QUOTA, skills.length));

  const hotIds = new Set(HOT_MCP_CURATED.map(([id]) => `curated:${id}`));
  const curatedMcps = mcps.filter((m) => hotIds.has(m.id));
  const restMcps = mcps.filter((m) => !hotIds.has(m.id));

  const scenarioBuckets = {};
  for (const m of restMcps) {
    const s = mapMcpCategory(m.category);
    if (!scenarioBuckets[s]) scenarioBuckets[s] = [];
    scenarioBuckets[s].push(m);
  }
  const diversified = [];
  const bucketKeys = Object.keys(scenarioBuckets).sort((a, b) => scenarioBuckets[b].length - scenarioBuckets[a].length);
  while (diversified.length < MCP_QUOTA - curatedMcps.length && bucketKeys.some((k) => scenarioBuckets[k].length)) {
    for (const k of bucketKeys) {
      if (scenarioBuckets[k].length && diversified.length < MCP_QUOTA - curatedMcps.length) {
        diversified.push(scenarioBuckets[k].shift());
      }
    }
  }
  const selectedMcps = dedupeById([...curatedMcps, ...diversified]).slice(0, MCP_QUOTA);

  let all = [...selectedSkills, ...selectedMcps];
  if (all.length < MIN_TOTAL) {
    const extra = skills.slice(SKILL_QUOTA, SKILL_QUOTA + (MIN_TOTAL - all.length));
    all = [...all, ...extra];
  }

  const stats = { Skill: 0, MCP: 0 };
  const scenarioStats = {};
  for (const item of all) {
    stats[item.kind] = (stats[item.kind] || 0) + 1;
    const sc =
      item.kind === 'Skill'
        ? getIndustryZh(item.section, item.owner, item.desc)
        : item.scenarioZh || mapMcpCategory(item.category);
    scenarioStats[sc] = (scenarioStats[sc] || 0) + 1;
  }

  const lines = [
    '# 全球 Skills + MCP 全场景调研目录（≥500 项）',
    '',
    `> 生成时间：${new Date().toISOString().slice(0, 10)}`,
    '> **Skills 来源**：[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)、[agent-skill.co](https://agent-skill.co)、[skills.sh](https://skills.sh)、[SkillsMP](https://skillsmp.com)',
    '> **MCP 来源**：[punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)（Glama 同步）、[Smithery](https://smithery.ai)、[MCP 官方 Registry](https://registry.modelcontextprotocol.io)、[`docs/ad-pr-creative-skills-mcp-catalog.md`](./ad-pr-creative-skills-mcp-catalog.md) 营销/办公精选',
    `> 本项目已接入 Skill **${existing.size}** 项；下表含 **Skill + MCP**，介绍与应用范围均为**中文**。`,
    '',
    '## 类型说明',
    '',
    '| 类型 | 含义 | 典型集成 |',
    '|------|------|----------|',
    '| **Skill** | SKILL.md 指令包，扩展 Agent 工作流 | `npx skills add` → bootstrap |',
    '| **MCP** | Model Context Protocol 服务器，连接外部 API/工具 | `mcp.json` + OAuth/API Key |',
    '',
    '## 按类型统计',
    '',
    '| 类型 | 数量 |',
    '|------|------|',
    `| Skill | ${stats.Skill || 0} |`,
    `| MCP | ${stats.MCP || 0} |`,
    `| **合计** | **${all.length}** |`,
    '',
    '## 按应用场景统计（Top 30）',
    '',
    '| 应用场景 | 数量 |',
    '|----------|------|',
  ];

  for (const [k, v] of Object.entries(scenarioStats).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    lines.push(`| ${k} | ${v} |`);
  }

  lines.push('', '## 完整清单', '');
  lines.push(
    '| # | 类型 | 名称 | 应用场景 | 介绍 | 链接/来源 | 应用范围 | 本项目状态 | 集成方式 | 评星 |',
    '|---|------|------|----------|------|-----------|----------|------------|----------|------|',
  );

  all.forEach((item, i) => {
    if (item.kind === 'Skill') {
      lines.push(skillRow(item, i + 1, existing));
    } else {
      let st = '未接入';
      if (item.integration?.includes('已接入')) st = '✅ 已接入';
      else if (item.integration?.includes('L2 已接入')) st = '✅ 已接入';
      lines.push(mcpRow(item, i + 1, st));
    }
  });

  lines.push('', '---', '', `**合计：${all.length} 项**（Skill 扫描 ${skills.length} · MCP 扫描 ${mcps.length} · 目标 ≥${MIN_TOTAL}）`, '');

  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${lines.join('\n')}\n`, 'utf8');
  console.log(`[skills-mcp-discovery] wrote ${OUTPUT}`);
  console.log(`[skills-mcp-discovery] total=${all.length} skills=${stats.Skill} mcps=${stats.MCP}`);
}

main();
