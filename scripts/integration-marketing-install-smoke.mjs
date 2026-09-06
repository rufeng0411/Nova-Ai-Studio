#!/usr/bin/env node
/**
 * 新装 marketing / GEO skills 与 MCP 快速跑测，输出 install-readiness 表格。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyTaxonomyToSkill } from './lib/capabilityHubTaxonomy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'config', 'marketing-install-manifest.json');
const CATALOG_PATH = path.join(ROOT, 'config', 'capabilities.catalog.json');
const MCP_EXAMPLE = path.join(ROOT, 'products', '_example', 'config', 'mcp.json.example');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts', 'marketing-saas-smoke');
const JSON_OUT = path.join(ARTIFACT_DIR, 'install-readiness.json');
const MD_OUT = path.join(ROOT, 'docs', 'marketing-install-readiness.zh-CN.md');

const STATUS = {
  pass: '通过',
  needs_config: '待配置',
  missing_dep: '缺依赖',
  not_installed: '未安装',
  partial: '部分可用',
};

function discoverSkillDirs(skillsRoot) {
  const found = [];
  const stack = [skillsRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && /^skill\.md$/i.test(e.name))) {
      found.push(current);
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
    }
  }
  return found;
}

function parseFrontmatter(skillPath) {
  const content = readFileSync(skillPath, 'utf8');
  const match = content.match(/^---\s*[\r\n]+([\s\S]*?)\r?\n---/);
  if (!match) return { ok: false, detail: '缺少 frontmatter' };
  const body = match[1];
  const name = body.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = body.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  const textLen = content.replace(/^---[\s\S]*?---/, '').trim().length;
  if (!name || !description) return { ok: false, detail: 'name/description 不完整' };
  if (textLen < 80) return { ok: false, detail: `正文过短 (${textLen})` };
  return { ok: true, detail: 'SKILL.md 可读' };
}

function checkL1Skill(slug, catalogBySlug, runtimeSlugs) {
  const skillDir = path.join(ROOT, 'skills');
  let skillPath = null;
  for (const dir of discoverSkillDirs(skillDir)) {
    if (path.basename(dir) === slug) {
      skillPath = path.join(dir, 'SKILL.md');
      break;
    }
  }
  const cat = catalogBySlug.get(slug);
  const displayName = cat?.display_name || slug;
  if (!skillPath || !existsSync(skillPath)) {
    return row(displayName, slug, 'L1 skill', STATUS.not_installed, 'SKILL 目录缺失', '重新运行 vendor:marketing', '');
  }
  const fm = parseFrontmatter(skillPath);
  if (!fm.ok) {
    return row(displayName, slug, 'L1 skill', STATUS.not_installed, fm.detail, '修复 SKILL.md', skillPath);
  }
  if (!cat) {
    return row(displayName, slug, 'L1 skill', STATUS.not_installed, 'catalog 无条目', 'npm run capabilities:gen', skillPath);
  }
  if (!runtimeSlugs.has(slug)) {
    return row(displayName, slug, 'L1 skill', STATUS.not_installed, 'runtime 未发现', '确认 skills/ 路径', skillPath);
  }
  if (slug === 'pd-geo') {
    return row(displayName, slug, 'L2 skill', STATUS.partial, 'verify 需模型 Key（可选）', '配置模型池后跑 smoke:aigeo:agent', skillPath);
  }
  return row(displayName, slug, 'L1 skill', STATUS.pass, '—', '无需操作，能力中心可直接「试一下」', skillPath);
}

function checkVirtualMcp(slug, catalogBySlug) {
  const cat = catalogBySlug.get(slug);
  const displayName = cat?.display_name || slug;
  if (!cat) {
    return row(displayName, slug, '虚拟 MCP', STATUS.not_installed, 'catalog 无条目', 'npm run capabilities:gen', '');
  }
  let mcpDoc = '';
  if (existsSync(MCP_EXAMPLE)) {
    mcpDoc = readFileSync(MCP_EXAMPLE, 'utf8');
  }
  const hints = {
    'mcp-similarweb': { miss: 'Similarweb API Key', action: '设置 → MCP → 填 Key 后重启', ref: 'mcp.json.example' },
    'mcp-google-workspace': { miss: 'Google OAuth / 服务账号', action: '按 mcp.json.example 完成授权', ref: 'mcp.json.example' },
    'mcp-notion-collab': { miss: 'Notion Integration Token', action: 'Notion 创建集成并填 Token', ref: 'mcp.json.example' },
  };
  const h = hints[slug] || { miss: 'MCP 配置', action: '设置中配置 MCP', ref: 'mcp.json.example' };
  return row(displayName, slug, '虚拟 MCP', STATUS.needs_config, h.miss, h.action, h.ref);
}

function row(displayName, slug, type, result, missing, action, ref) {
  return { displayName, slug, type, result, missing, action, ref };
}

function toMarkdown(rows) {
  const lines = [
    '# 营销 SaaS 新装能力跑测结果',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '| 中文名 | 标识 | 类型 | 跑测结果 | 缺什么 | 你需要做什么 | 参考位置 |',
    '|--------|------|------|----------|--------|--------------|----------|',
    ...rows.map(
      (r) =>
        `| ${r.displayName} | ${r.slug} | ${r.type} | ${r.result} | ${r.missing} | ${r.action} | ${r.ref} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

function main() {
  const live = process.argv.includes('--live');
  if (!existsSync(MANIFEST_PATH)) throw new Error(`Missing ${MANIFEST_PATH}`);
  if (!existsSync(CATALOG_PATH)) throw new Error(`Missing ${CATALOG_PATH}. Run capabilities:gen first.`);

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const catalogBySlug = new Map((catalog.skills || []).map((s) => [s.slug, applyTaxonomyToSkill(s)]));
  const runtimeSlugs = new Set(discoverSkillDirs(path.join(ROOT, 'skills')).map((d) => path.basename(d)));

  const rows = [];
  for (const slug of manifest.skills || []) {
    rows.push(checkL1Skill(slug, catalogBySlug, runtimeSlugs));
  }
  for (const slug of manifest.mcp_virtual || []) {
    rows.push(checkVirtualMcp(slug, catalogBySlug));
  }

  if (!live && rows.some((r) => r.slug === 'pd-geo')) {
    const aigeo = spawnSync(process.execPath, ['scripts/integration-aigeo-smoke.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const idx = rows.findIndex((r) => r.slug === 'pd-geo');
    if (idx >= 0) {
      rows[idx] = {
        ...rows[idx],
        result: aigeo.status === 0 ? STATUS.pass : STATUS.partial,
        missing: aigeo.status === 0 ? '—' : 'aigeo smoke 未全过',
        action: aigeo.status === 0 ? rows[idx].action : 'npm run smoke:aigeo 查看详情',
      };
    }
  }

  const blocked = rows.filter((r) => r.result === STATUS.not_installed || r.result === STATUS.missing_dep);
  const report = {
    generatedAt: new Date().toISOString(),
    ok: blocked.length === 0,
    live,
    rows,
    blockedCount: blocked.length,
  };

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(MD_OUT, `${toMarkdown(rows)}\n`, 'utf8');
  console.log(`[marketing-install-smoke] ok=${report.ok} blocked=${blocked.length}`);
  console.log(`[marketing-install-smoke] json=${JSON_OUT}`);
  console.log(`[marketing-install-smoke] md=${MD_OUT}`);
  if (!report.ok) process.exitCode = 1;
}

main();
