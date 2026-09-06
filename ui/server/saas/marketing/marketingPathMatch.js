// PD-SAAS-FORK: marketing site path matching (pure, testable)

import {
  getShowcaseSiteMode,
  isMarketingI18nEnabled,
} from './showcaseFlags.js';

const CORE_EXACT = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/llms.txt': 'llms.txt',
  '/robots.txt': 'robots.txt',
  '/sitemap.xml': 'sitemap.xml',
  '/manifest.webmanifest': 'manifest.webmanifest',
  '/sw.js': 'sw.js',
  '/docs': 'docs/index.html',
  '/docs/': 'docs/index.html',
  '/docs/index.html': 'docs/index.html',
  '/contact': 'contact/index.html',
  '/contact/': 'contact/index.html',
  '/contact/index.html': 'contact/index.html',
  '/geo': 'geo/index.html',
  '/geo/': 'geo/index.html',
  '/geo/index.html': 'geo/index.html',
  '/for-ai': 'geo/index.html',
  '/for-ai/': 'geo/index.html',
  '/faq': 'faq/index.html',
  '/faq/': 'faq/index.html',
  '/faq/index.html': 'faq/index.html',
  '/compare': 'compare/index.html',
  '/compare/': 'compare/index.html',
  '/compare/index.html': 'compare/index.html',
  '/claims': 'claims/index.html',
  '/claims/': 'claims/index.html',
  '/claims/index.html': 'claims/index.html',
  '/about': 'about/index.html',
  '/about/': 'about/index.html',
  '/about/index.html': 'about/index.html',
  '/copyright': 'copyright/index.html',
  '/copyright/': 'copyright/index.html',
  '/copyright/index.html': 'copyright/index.html',
};

const SHOWCASE_EXACT = {
  '/showcase': 'showcase/index.html',
  '/showcase/': 'showcase/index.html',
  '/showcase/index.html': 'showcase/index.html',
  '/showcase/fullcase-campaign.html': 'showcase/fullcase-campaign.html',
  '/showcase/fullcase-flywheel.html': 'showcase/fullcase-flywheel.html',
  '/showcase/fullcase-geo.html': 'showcase/fullcase-geo.html',
  '/showcase/fullcase-viewer.html': 'showcase/fullcase-viewer.html',
  '/showcase/md-viewer.html': 'showcase/md-viewer.html',
  '/showcase/copy-reader.html': 'showcase/copy-reader.html',
  '/showcase/ppt-viewer.html': 'showcase/ppt-viewer.html',
  '/showcase/video-viewer.html': 'showcase/video-viewer.html',
};

const CORE_PREFIXES = [
  '/shared/',
  '/assets/',
  '/docs/',
  '/contact/',
  '/geo/',
  '/faq/',
  '/compare/',
  '/claims/',
  '/about/',
  '/copyright/',
  '/pages/',
];

/**
 * Express may leave percent-encoding in req.path for non-ASCII filenames.
 * Decode before disk lookup so showcase 中文成果名 (…执行摘要.md) resolve.
 * @param {string} pathname
 * @returns {string}
 */
export function decodeMarketingPathname(pathname) {
  const raw = String(pathname || '');
  if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * @param {string} pathname
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ skipEn?: boolean }} [opts]
 * @returns {string | null}
 */
export function matchMarketingPath(pathname, env = process.env, opts = {}) {
  if (!pathname || typeof pathname !== 'string') return null;
  let p = decodeMarketingPathname(pathname.split('?')[0].split('#')[0]);
  if (!p.startsWith('/')) p = `/${p}`;
  // After decode: reject traversal / Windows separators / NUL
  if (p.includes('..') || p.includes('\\') || p.includes('\0')) return null;

  if (!opts.skipEn && isMarketingI18nEnabled(env) && (p === '/en' || p.startsWith('/en/') || p === '/en')) {
    if (p === '/en' || p === '/en/') return 'en/index.html';
    const rest = p.slice('/en'.length) || '/';
    if (rest.includes('..')) return null;
    const inner = matchMarketingPath(rest, env, { skipEn: true });
    if (inner) {
      if (inner.startsWith('shared/') || inner.startsWith('assets/')) return inner;
      // Showcase viewers / media / shared JS are locale-shared; only index is under en/.
      if (inner.startsWith('showcase/') && inner !== 'showcase/index.html') {
        return inner;
      }
      return `en/${inner}`;
    }
    const rel = `en${rest}`.replace(/\/+/g, '/').replace(/^\//, '');
    if (rel.endsWith('/')) return `${rel}index.html`;
    return rel;
  }

  if (CORE_EXACT[p]) return CORE_EXACT[p];

  if (getShowcaseSiteMode(env) === 'on') {
    if (SHOWCASE_EXACT[p]) return SHOWCASE_EXACT[p];
    if (p.startsWith('/showcase/')) {
      const rel = p.slice(1);
      if (rel.includes('..')) return null;
      return rel;
    }
  }

  for (const prefix of CORE_PREFIXES) {
    if (p.startsWith(prefix)) {
      const rel = p.slice(1);
      if (rel.includes('..')) return null;
      return rel;
    }
  }
  return null;
}

export function isMarketingSiteEnabled(env = process.env) {
  const raw = env.PILOTDECK_MARKETING_SITE;
  return raw === '1' || raw === 'true' || raw === 'on';
}

export function isMarketingContactEnabled(env = process.env) {
  const raw = env.PILOTDECK_MARKETING_CONTACT;
  if (raw === undefined || raw === '') return true;
  return raw === '1' || raw === 'true' || raw === 'on';
}

export function isMarketingAnalyticsEnabled(env = process.env) {
  const raw = env.PILOTDECK_MARKETING_ANALYTICS;
  if (raw === undefined || raw === '') return true;
  return raw === '1' || raw === 'true' || raw === 'on';
}

export function isRegisterInviteCodeEnabled(env = process.env) {
  const raw = env.PILOTDECK_REGISTER_INVITE_CODE;
  if (raw === undefined || raw === '') return true;
  return raw === '1' || raw === 'true' || raw === 'on';
}
