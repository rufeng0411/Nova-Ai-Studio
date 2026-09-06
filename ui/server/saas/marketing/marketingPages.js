// PD-SAAS-FORK: marketing site CMS pages (about / copyright)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ALLOWED_SLUGS = new Set(['about', 'copyright']);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.resolve(__dirname, '../../../../deploy/marketing/pages');
const require = createRequire(import.meta.url);

/** @returns {{ parse: (src: string, opts?: object) => unknown } | null} */
function loadMarked() {
  try {
    const mod = require('marked');
    return mod?.marked ?? mod;
  } catch (err) {
    console.warn('[marketing] marked not installed — CMS markdown degraded:', err?.message || err);
    return null;
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isMarketingPagesCmsEnabled(env = process.env) {
  const raw = env.PILOTDECK_MARKETING_PAGES_CMS;
  if (raw === undefined || raw === '') return true;
  return raw === '1' || raw === 'true' || raw === 'on';
}

/**
 * @param {string} slug
 */
export function assertMarketingPageSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (!ALLOWED_SLUGS.has(s)) {
    const err = new Error('invalid_slug');
    err.code = 'invalid_slug';
    throw err;
  }
  return s;
}

/**
 * Strip scripts / event handlers / iframes from rendered HTML.
 * @param {string} html
 */
export function sanitizeMarketingHtml(html) {
  let out = String(html || '');
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(/<object[\s\S]*?<\/object>/gi, '');
  out = out.replace(/<embed\b[^>]*>/gi, '');
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/javascript:/gi, '');
  return out;
}

/**
 * @param {string} md
 */
export function renderMarketingMarkdown(md) {
  const marked = loadMarked();
  if (!marked?.parse) {
    const escaped = String(md || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return sanitizeMarketingHtml(`<pre>${escaped}</pre>`);
  }
  const raw = marked.parse(String(md || ''), { async: false });
  return sanitizeMarketingHtml(typeof raw === 'string' ? raw : String(raw));
}

/**
 * @param {string} [dataRoot]
 */
export function resolveMarketingPagesDir(dataRoot) {
  const root = String(dataRoot || process.env.DATA_ROOT || '').trim();
  if (!root) return null;
  return path.join(root.replace(/[\\/]+$/, ''), 'marketing', 'pages');
}

function readJsonFile(abs) {
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} slug
 * @param {{ dataRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function loadMarketingPage(slug, opts = {}) {
  const id = assertMarketingPageSlug(slug);
  const env = opts.env || process.env;
  const seedPath = path.join(SEED_DIR, `${id}.json`);
  let doc = readJsonFile(seedPath);
  if (isMarketingPagesCmsEnabled(env)) {
    const dir = resolveMarketingPagesDir(opts.dataRoot);
    if (dir) {
      const overlay = readJsonFile(path.join(dir, `${id}.json`));
      if (overlay) doc = overlay;
    }
  }
  if (!doc || typeof doc !== 'object') {
    doc = {
      title_zh: id === 'about' ? '关于我们' : '版权声明',
      title_en: id === 'about' ? 'About' : 'Copyright',
      body_zh_md: '',
      body_en_md: '',
      updated_at: null,
    };
  }
  return {
    slug: id,
    title_zh: String(doc.title_zh || ''),
    title_en: String(doc.title_en || ''),
    body_zh_md: String(doc.body_zh_md || ''),
    body_en_md: String(doc.body_en_md || ''),
    updated_at: doc.updated_at || null,
  };
}

/**
 * @param {string} slug
 * @param {'zh'|'en'} lang
 * @param {{ dataRoot?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function getMarketingPagePublic(slug, lang, opts = {}) {
  const page = loadMarketingPage(slug, opts);
  const isEn = String(lang || 'zh').toLowerCase().startsWith('en');
  return {
    slug: page.slug,
    lang: isEn ? 'en' : 'zh',
    title: isEn ? page.title_en || page.title_zh : page.title_zh || page.title_en,
    html: renderMarketingMarkdown(isEn ? page.body_en_md : page.body_zh_md),
    updated_at: page.updated_at,
  };
}

/**
 * @param {string} slug
 * @param {{ title_zh?: string, title_en?: string, body_zh_md?: string, body_en_md?: string }} body
 * @param {{ dataRoot?: string }} [opts]
 */
export function saveMarketingPage(slug, body, opts = {}) {
  const id = assertMarketingPageSlug(slug);
  const dir = resolveMarketingPagesDir(opts.dataRoot);
  if (!dir) {
    const err = new Error('data_root_missing');
    err.code = 'data_root_missing';
    throw err;
  }
  fs.mkdirSync(dir, { recursive: true });
  const prev = loadMarketingPage(id, opts);
  const next = {
    title_zh: body.title_zh != null ? String(body.title_zh) : prev.title_zh,
    title_en: body.title_en != null ? String(body.title_en) : prev.title_en,
    body_zh_md: body.body_zh_md != null ? String(body.body_zh_md) : prev.body_zh_md,
    body_en_md: body.body_en_md != null ? String(body.body_en_md) : prev.body_en_md,
    updated_at: new Date().toISOString(),
  };
  const abs = path.join(dir, `${id}.json`);
  fs.writeFileSync(abs, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { slug: id, ...next };
}

export { ALLOWED_SLUGS, SEED_DIR };
