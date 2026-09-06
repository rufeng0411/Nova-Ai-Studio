// PD-SAAS-FORK: Launch Profile providers — scan skill assets for LaunchSheet options
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLaunchEntry } from './launchRegistry.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const HTML_PPT_ROOT = path.join(REPO_ROOT, 'skills', 'vendor', 'html-ppt');
const OD_CATALOG_PATH = path.join(REPO_ROOT, 'config', 'preflight-catalog-od.json');
const PPT_CATALOG_PATH = path.join(REPO_ROOT, 'config', 'preflight-catalog-ppt.json');

/** Official theme-showcase order (matches templates/theme-showcase.html + verify-output PNGs). */
export const HTML_PPT_THEME_ORDER = [
  'minimal-white',
  'editorial-serif',
  'soft-pastel',
  'sharp-mono',
  'arctic-cool',
  'sunset-warm',
  'catppuccin-latte',
  'catppuccin-mocha',
  'dracula',
  'tokyo-night',
  'nord',
  'solarized-light',
  'gruvbox-dark',
  'rose-pine',
  'neo-brutalism',
  'glassmorphism',
  'bauhaus',
  'swiss-grid',
  'terminal-green',
  'xiaohongshu-white',
  'rainbow-gradient',
  'aurora',
  'blueprint',
  'memphis-pop',
  'cyberpunk-neon',
  'y2k-chrome',
  'retro-tv',
  'japanese-minimal',
  'vaporwave',
  'midcentury',
  'corporate-clean',
  'academic-paper',
  'news-broadcast',
  'pitch-deck-vc',
  'magazine-bold',
  'engineering-whiteprint',
];

const HTML_PPT_STATIC_PREFIX = '/api/launch/static/html-ppt';

function humanizeId(id) {
  return id
    .split(/[-_]/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseThemeDescriptions(themesMd) {
  const map = new Map();
  const re = /\|\s*`([^`]+)`\s*\|\s*([^|]+)\|/g;
  let m;
  while ((m = re.exec(themesMd)) !== null) {
    map.set(m[1].trim(), m[2].trim());
  }
  return map;
}

function sortByOfficialThemeOrder(ids) {
  const rank = new Map(HTML_PPT_THEME_ORDER.map((id, index) => [id, index]));
  return [...ids].sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

export function htmlPptThemePreviewImageUrl(themeId, skillRoot = HTML_PPT_ROOT) {
  const idx = HTML_PPT_THEME_ORDER.indexOf(themeId);
  if (idx < 0) return undefined;
  const num = String(idx + 1).padStart(2, '0');
  const rel = `scripts/verify-output/theme-showcase/theme-showcase_${num}.png`;
  return existsSync(path.join(skillRoot, rel))
    ? `${HTML_PPT_STATIC_PREFIX}/${rel}`
    : undefined;
}

export function htmlPptThemePreviewUrl(themeId) {
  return `${HTML_PPT_STATIC_PREFIX}/docs/readme/_theme-cell.html?theme=${encodeURIComponent(themeId)}`;
}

export function htmlPptDeckPreviewUrl(deckId) {
  return `${HTML_PPT_STATIC_PREFIX}/templates/full-decks/${encodeURIComponent(deckId)}/index.html?preview=1`;
}

export function htmlPptLayoutPreviewUrl(layoutId) {
  return `${HTML_PPT_STATIC_PREFIX}/templates/single-page/${encodeURIComponent(layoutId)}.html?preview=1`;
}

export function scanHtmlPptThemes(skillRoot = HTML_PPT_ROOT) {
  const themesDir = path.join(skillRoot, 'assets', 'themes');
  const themesMd = existsSync(path.join(skillRoot, 'references', 'themes.md'))
    ? readFileSync(path.join(skillRoot, 'references', 'themes.md'), 'utf8')
    : '';
  const desc = parseThemeDescriptions(themesMd);
  if (!existsSync(themesDir)) return [];
  const ids = readdirSync(themesDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => f.replace(/\.css$/, ''));
  return sortByOfficialThemeOrder(ids).map((id) => ({
    id,
    label: humanizeId(id),
    description: desc.get(id) ?? '',
    previewUrl: htmlPptThemePreviewUrl(id),
    previewImageUrl: htmlPptThemePreviewImageUrl(id, skillRoot),
  }));
}

export function scanHtmlPptFullDecks(skillRoot = HTML_PPT_ROOT) {
  const decksDir = path.join(skillRoot, 'templates', 'full-decks');
  if (!existsSync(decksDir)) return [];
  return readdirSync(decksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((id) => existsSync(path.join(decksDir, id, 'index.html')))
    .sort()
    .map((id) => ({
      id,
      label: humanizeId(id),
      previewUrl: htmlPptDeckPreviewUrl(id),
      previewKind: 'deck',
    }));
}

export function scanHtmlPptLayouts(skillRoot = HTML_PPT_ROOT) {
  const layoutsDir = path.join(skillRoot, 'templates', 'single-page');
  if (!existsSync(layoutsDir)) return [];
  return readdirSync(layoutsDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace(/\.html$/, ''))
    .sort()
    .map((id) => ({
      id,
      label: humanizeId(id),
      previewUrl: htmlPptLayoutPreviewUrl(id),
      previewKind: 'layout',
    }));
}

function loadJsonCatalog(absPath) {
  if (!existsSync(absPath)) return null;
  return JSON.parse(readFileSync(absPath, 'utf8'));
}

export function scanPreflightOdCatalog() {
  const catalog = loadJsonCatalog(OD_CATALOG_PATH);
  if (!catalog?.entries) return [];
  return catalog.entries.map((e) => ({
    id: e.id,
    label: e.label ?? humanizeId(e.id),
    accent: e.accent,
    category: e.category,
    recommended: Boolean(e.recommended),
  }));
}

export function scanPreflightPptCanvas() {
  const catalog = loadJsonCatalog(PPT_CATALOG_PATH);
  return (catalog?.canvas ?? []).map((c) => ({
    id: c.id,
    label: c.label ?? humanizeId(c.id),
    dim: c.dim,
  }));
}

export function scanPreflightPptModes() {
  const catalog = loadJsonCatalog(PPT_CATALOG_PATH);
  return (catalog?.modes ?? []).map((m) => ({
    id: m.id,
    label: m.label ?? humanizeId(m.id),
    description: m.desc,
  }));
}

export function scanPreflightPptStyles() {
  const catalog = loadJsonCatalog(PPT_CATALOG_PATH);
  return (catalog?.styles ?? []).map((s) => ({
    id: s.id,
    label: s.label ?? humanizeId(s.id),
    description: s.desc,
    recommended: Boolean(s.recommended),
  }));
}

export function loadLaunchProfile(slug) {
  const entry = getLaunchEntry(slug);
  if (!entry?.launch_profile_ref) return null;
  const abs = path.join(REPO_ROOT, entry.launch_profile_ref.replace(/\//g, path.sep));
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, 'utf8'));
}

export function resolveLaunchProfile(slug) {
  const profile = loadLaunchProfile(slug);
  if (!profile) return null;
  const skillRoot = profile.skill_root
    ? path.join(REPO_ROOT, profile.skill_root)
    : HTML_PPT_ROOT;

  const steps = (profile.steps ?? []).map((step) => {
    if (step.source === 'html-ppt-themes') {
      return { ...step, options: scanHtmlPptThemes(skillRoot) };
    }
    if (step.source === 'html-ppt-full-decks') {
      return { ...step, options: scanHtmlPptFullDecks(skillRoot) };
    }
    if (step.source === 'html-ppt-layouts') {
      return { ...step, options: scanHtmlPptLayouts(skillRoot) };
    }
    if (step.source === 'preflight-od-catalog') {
      return { ...step, options: scanPreflightOdCatalog() };
    }
    if (step.source === 'preflight-ppt-canvas') {
      return { ...step, options: scanPreflightPptCanvas() };
    }
    if (step.source === 'preflight-ppt-modes') {
      return { ...step, options: scanPreflightPptModes() };
    }
    if (step.source === 'preflight-ppt-styles') {
      return { ...step, options: scanPreflightPptStyles() };
    }
    return step;
  });

  return { slug, ...profile, steps };
}

function selectionMap(selections) {
  const map = Object.create(null);
  for (const s of selections ?? []) {
    if (s.stepId && s.optionId) map[s.stepId] = s;
    if (s.key) map[s.key] = s;
  }
  return map;
}

export function compileLaunchResult(slug, body) {
  const profile = resolveLaunchProfile(slug);
  if (!profile) {
    throw new Error(`No launch profile for ${slug}`);
  }
  const sel = selectionMap(body.selections);
  const theme = sel.theme?.optionId ?? sel.theme?.id;
  const deck = sel.deck?.optionId ?? sel.deck?.id;
  const layout = sel.layout?.optionId ?? sel.layout?.id;
  const surface = sel.surface?.optionId ?? sel.surface?.id;
  const canvas = sel.canvas?.optionId ?? sel.canvas?.id;
  const mode = sel.mode?.optionId ?? sel.mode?.id;
  const style = sel.style?.optionId ?? sel.style?.id;
  const brief = String(body.brief ?? sel.brief?.value ?? '').trim();
  const pageCount = String(body.page_count ?? sel.page_count?.value ?? '8').trim();

  const themeLabel = theme ? humanizeId(theme) : '默认主题';
  const deckLabel = deck ? humanizeId(deck) : '默认整稿';
  const surfaceLabel = surface ? (sel.surface?.label ?? humanizeId(surface)) : '默认设计系统';
  const canvasLabel = canvas ? (sel.canvas?.label ?? humanizeId(canvas)) : '16:9';
  const modeLabel = mode ? (sel.mode?.label ?? humanizeId(mode)) : '金字塔';
  const styleLabel = style ? (sel.style?.label ?? humanizeId(style)) : '瑞士极简';

  const compiledPrompt =
    profile.compile?.prompt_template
      ?.replace(/\{brief\}/g, brief || '【在此填写演讲主题与要点】')
      ?.replace(/\{theme\}/g, theme ?? 'minimal-white')
      ?.replace(/\{theme_label\}/g, themeLabel)
      ?.replace(/\{deck\}/g, deck ?? 'tech-sharing')
      ?.replace(/\{deck_label\}/g, deckLabel)
      ?.replace(/\{layout\}/g, layout ?? '')
      ?.replace(/\{surface\}/g, surface ?? 'linear-app')
      ?.replace(/\{surface_label\}/g, surfaceLabel)
      ?.replace(/\{canvas\}/g, canvas ?? 'ppt169')
      ?.replace(/\{canvas_label\}/g, canvasLabel)
      ?.replace(/\{mode\}/g, mode ?? 'pyramid')
      ?.replace(/\{mode_label\}/g, modeLabel)
      ?.replace(/\{style\}/g, style ?? 'swiss-minimal')
      ?.replace(/\{style_label\}/g, styleLabel)
      ?.replace(/\{page_count\}/g, pageCount)
      ?? `用「${profile.display_name ?? slug}」制作成果：${brief || '【主题】'}。写入系统分配任务目录，跳过模板问卷。`;

  if (brief && !compiledPrompt.includes(brief)) {
    compiledPrompt = `${brief}。${compiledPrompt}`;
  }

  let launchContextXml;
  if (slug === 'open-design') {
    launchContextXml = [
      '<launch-context capability="open-design">',
      '  <selections>',
      surface ? `    <surface id="${surface}" label="${surfaceLabel}"/>` : '',
      brief ? `    <field key="brief" value="${brief.replace(/"/g, '&quot;')}"/>` : '',
      '  </selections>',
      '  <directives>已选设计系统，按 SKILL 工作流执行，跳过模板问卷。</directives>',
      '</launch-context>',
    ].filter(Boolean).join('\n');
  } else if (slug === 'ppt-master') {
    launchContextXml = [
      `<launch-context capability="ppt-master"${body.slotId ? ` slotId="${body.slotId}"` : ''}>`,
      '  <selections>',
      canvas ? `    <canvas id="${canvas}" label="${canvasLabel}"/>` : '',
      mode ? `    <mode id="${mode}" label="${modeLabel}"/>` : '',
      style ? `    <style id="${style}" label="${styleLabel}"/>` : '',
      `    <field key="page_count" value="${pageCount}"/>`,
      brief ? `    <field key="brief" value="${brief.replace(/"/g, '&quot;')}"/>` : '',
      '  </selections>',
      '  <directives>已确认画幅/模式/风格，Web 路径跳过 Flask 确认，禁止 ask_user 模板问卷。</directives>',
      '</launch-context>',
    ].filter(Boolean).join('\n');
  } else {
    launchContextXml = [
      '<launch-context capability="html-ppt">',
      '  <selections>',
      theme ? `    <theme id="${theme}" label="${themeLabel}"/>` : '',
      deck ? `    <full_deck id="${deck}" label="${deckLabel}"/>` : '',
      layout ? `    <layout id="${layout}"/>` : '',
      `    <field key="page_count" value="${pageCount}"/>`,
      brief ? `    <field key="brief" value="${brief.replace(/"/g, '&quot;')}"/>` : '',
      '  </selections>',
      '  <directives>已选主题与整稿模板，按 SKILL 工作流 scaffold，跳过主题问卷。</directives>',
      '</launch-context>',
    ].filter(Boolean).join('\n');
  }

  return {
    compiledPrompt,
    launchContext: launchContextXml,
    capability: { slug, displayName: profile.display_name ?? slug },
  };
}

export function getHtmlPptPreviewPath(kind, id) {
  const safe = String(id).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safe) return null;
  if (kind === 'deck') {
    const p = path.join(HTML_PPT_ROOT, 'templates', 'full-decks', safe, 'index.html');
    return existsSync(p) ? p : null;
  }
  if (kind === 'layout') {
    const p = path.join(HTML_PPT_ROOT, 'templates', 'single-page', `${safe}.html`);
    return existsSync(p) ? p : null;
  }
  if (kind === 'theme') {
    if (!existsSync(path.join(HTML_PPT_ROOT, 'assets', 'themes', `${safe}.css`))) return null;
    return path.join(HTML_PPT_ROOT, 'docs', 'readme', '_theme-cell.html');
  }
  return null;
}

export function getHtmlPptStaticRoot(relativePath) {
  const normalized = relativePath.replace(/^\/+/, '').replace(/\.\./g, '');
  const abs = path.join(HTML_PPT_ROOT, normalized);
  if (!abs.startsWith(HTML_PPT_ROOT)) return null;
  return existsSync(abs) ? abs : null;
}
