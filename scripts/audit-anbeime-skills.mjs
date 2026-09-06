#!/usr/bin/env node
/** Cross-reference anbeime/skill local packages vs Nova catalog */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANBEIME = process.env.ANBEIME_SKILL_ROOT || path.join(process.env.TEMP || '/tmp', 'anbeime-skill-audit');
const CATALOG = JSON.parse(readFileSync(path.join(ROOT, 'config', 'capabilities.catalog.json'), 'utf8'));
const catalogByName = new Map();
const catalogBySlug = new Map();
for (const s of CATALOG.skills || []) {
  catalogBySlug.set(s.slug, s);
  if (s.name) catalogByName.set(s.name.toLowerCase(), s);
}

const ANBEIME_RATINGS = {
  'content-creation-publisher': 5, 'intelligent-content-system': 5, 'article-illustrator': 4,
  'baoyu-url-to-markdown': 4, 'baoyu-format-markdown': 4, 'baoyu-post-to-wechat': 4,
  'baoyu-post-to-x': 3, 'baoyu-xhs-images': 4, 'wechat-hotspot-publisher': 3,
  'video-creation-suite': 5, 'video-creation-collaborator': 4, 'video-creation-pro': 3,
  'video-recreation': 4, 'video-frame-extractor': 3, 'viral-video-copywriting': 4,
  'historical-science-video-prod': 2, 'historical-interview-scripts': 2, 'three-body-video-creator': 2,
  'pet-commerce-creator': 3, 'ecommerce-copywriter': 3, 'ecommerce-video-marketing': 3,
  'product-marketing-copywriter': 3, 'product-video-creator': 4, 'xiaohongshu-makeup': 3,
  'NanoBanana-PPT-Skills': 5, 'nanobanana-ppt-visualizer': 3, 'ppt-generator': 4,
  'pptx-generator': 3, 'ppt-roadshow-generator': 2, 'remotion-video-enhancer': 2,
  'tts-voice-synthesis': 5, 'qwen3-tts-local': 4, 'qwen3-asr-assistant': 4,
  'infinitetalk': 5, 'infinitetalk-shopping-avatar': 2, 'digital-avatar-shopping-video': 2,
  'dream-video-prompt-generator': 2, 'agentkit-multimedia-shopping': 2,
  'paper-analysis-assistant': 4, 'contract-review': 3, 'law-to-markdown': 2, 'stock-analysis': 3,
  'agent-team': 3, 'multi-agent-meeting': 2, 'peers-advisory-group': 2,
  'product-manager-toolkit': 3, 'sales-ai-assistant': 2,
  'frontend-design': 3, 'ai-drawio': 4, 'pop-up-book-illustration': 2, 'web-to-app': 2,
  'web-design-analyzer': 3, 'creating-financial-models': 4, 'market-research-reports': 4,
  'poetry-music-visual': 2,
};

const ALIAS_TO_CATALOG = {
  'pptx': 'anth-pptx', 'docx': 'anth-docx', 'pdf': 'anth-pdf', 'xlsx': 'anth-xlsx',
  'find-skill': 'find-skills', 'skill-creator': 'skill-creator',
  'NanoBanana-PPT-Skills': 'create-nanobanana-ppt',
  'frontend-design': 'df-frontend-design',
  'contract-review': 'legal-risk-assessment',
};

function findSkillMd(dir) {
  const direct = path.join(dir, 'SKILL.md');
  if (existsSync(direct)) return direct;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const nested = path.join(dir, ent.name, 'SKILL.md');
    if (existsSync(nested)) return nested;
  }
  return null;
}

function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  const body = md.slice(m[0].length).toLowerCase();
  const keys = [];
  for (const k of ['api_key', 'api key', 'openai', 'dashscope', 'fal', 'gemini', 'wechat', 'cookie', 'edge-tts', 'ffmpeg', 'playwright', 'chrome']) {
    if (body.includes(k)) keys.push(k);
  }
  return { ...out, _keyHints: [...new Set(keys)] };
}

function matchInstalled(id, fmName) {
  const candidates = [id, fmName, ALIAS_TO_CATALOG[id], ALIAS_TO_CATALOG[fmName]].filter(Boolean);
  for (const c of candidates) {
    const slug = String(c).toLowerCase();
    if (catalogBySlug.has(slug)) return catalogBySlug.get(slug);
    if (catalogBySlug.has(`mkt-${slug}`)) return catalogBySlug.get(`mkt-${slug}`);
    if (catalogBySlug.has(`create-${slug}`)) return catalogBySlug.get(`create-${slug}`);
    if (catalogBySlug.has(`anth-${slug}`)) return catalogBySlug.get(`anth-${slug}`);
    if (catalogBySlug.has(`legal-${slug}`)) return catalogBySlug.get(`legal-${slug}`);
    if (catalogByName.has(slug)) return catalogByName.get(slug);
    // fuzzy slug contains
    for (const [s, item] of catalogBySlug) {
      if (s.includes(slug) || slug.includes(s.replace(/^(mkt-|create-|anth-|edu-|df-)/, ''))) {
        if (s.endsWith(slug) || s.includes(slug)) return item;
      }
    }
  }
  return null;
}

function listTopSkills(base) {
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => path.join(base, e.name));
}

const rows = [];
for (const dir of [...listTopSkills(path.join(ANBEIME, 'skills')), ...listTopSkills(path.join(ANBEIME, 'finance-skills'))]) {
  const id = path.basename(dir);
  const skillMd = findSkillMd(dir);
  if (!skillMd) continue;
  const fm = parseFrontmatter(readFileSync(skillMd, 'utf8'));
  const installed = matchInstalled(id, fm.name);
  rows.push({
    id,
    skillName: fm.name || id,
    category: dir.includes('finance-skills') ? '财务分析' : '本地技能',
    anbeimeStars: ANBEIME_RATINGS[id] ?? ANBEIME_RATINGS[fm.name] ?? null,
    installed: !!installed,
    novaSlug: installed?.slug || '',
    novaHub: installed ? !installed.hidden_in_hub : false,
    integration: installed?.integration_level || '',
    availability: installed?.availability || '',
    keyHints: fm._keyHints?.join(', ') || '',
    description: (fm.description || '').slice(0, 120),
  });
}

rows.sort((a, b) => Number(b.installed) - Number(a.installed) || (b.anbeimeStars || 0) - (a.anbeimeStars || 0) || a.id.localeCompare(b.id));

const outPath = path.join(ROOT, 'artifacts', 'capabilities-smoke', 'anbeime-skill-audit.json');
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), total: rows.length, installed: rows.filter((r) => r.installed).length, rows }, null, 2));
console.log(`[anbeime-audit] ${rows.length} local packages, ${rows.filter((r) => r.installed).length} matched installed → ${outPath}`);
