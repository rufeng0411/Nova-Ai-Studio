// PD-SAAS-FORK: serve deploy/marketing HTML for SEO/GEO product site (flag-gated)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMarketingSiteEnabled, matchMarketingPath } from './marketingPathMatch.js';
import {
  getShowcaseAdminMode,
  isShowcaseCatalogPath,
  resolveShowcaseDataRoot,
} from './showcaseFlags.js';
import { getDataRoot } from '../tenant/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {number} */
let marketingSiteHit = 0;

export function getMarketingSiteHitCount() {
  return marketingSiteHit;
}

export function resetMarketingSiteHitCountForTests() {
  marketingSiteHit = 0;
}

function resolveMarketingRoot() {
  const fromEnv = process.env.PILOTDECK_MARKETING_ROOT?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    path.resolve(__dirname, '../../../../deploy/marketing'),
    path.resolve(process.cwd(), 'deploy/marketing'),
    path.resolve(process.cwd(), '../deploy/marketing'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * Resolve absolute file for a marketing-relative path.
 * Showcase overlay (DATA_ROOT) wins only when SHOWCASE_ADMIN=enforce.
 * @param {string} rel
 * @param {string} marketingRoot
 */
export function resolveMarketingFileAbs(rel, marketingRoot) {
  let normalized = String(rel || '').replace(/\\/g, '/');
  // PD-SAAS-FORK: belt-and-suspenders decode (matchMarketingPath also decodes)
  if (/%[0-9A-Fa-f]{2}/.test(normalized)) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      /* keep */
    }
  }
  if (normalized.includes('..') || normalized.includes('\0')) return null;
  const adminMode = getShowcaseAdminMode();
  const dataRoot = resolveShowcaseDataRoot(process.env, getDataRoot(process.env));

  if (dataRoot && (normalized.startsWith('showcase/') || normalized.startsWith('en/showcase/'))) {
    const underShowcase = normalized.startsWith('en/showcase/')
      ? normalized.slice('en/'.length)
      : normalized;
    // overlay layout mirrors showcase/…
    const overlayRel = underShowcase.startsWith('showcase/')
      ? underShowcase.slice('showcase/'.length)
      : underShowcase;
    // Media thumbs always overlay when present (admin preview in shadow);
    // catalog/html overlay only when SHOWCASE_ADMIN=enforce.
    const allowOverlay =
      adminMode === 'enforce' || overlayRel.startsWith('media/');
    if (allowOverlay) {
      const overlayAbs = path.resolve(dataRoot, overlayRel);
      if (
        overlayAbs.startsWith(path.resolve(dataRoot) + path.sep) &&
        fs.existsSync(overlayAbs) &&
        fs.statSync(overlayAbs).isFile()
      ) {
        return overlayAbs;
      }
    }
  }

  const abs = path.resolve(marketingRoot, normalized);
  if (!abs.startsWith(path.resolve(marketingRoot) + path.sep) && abs !== path.resolve(marketingRoot)) {
    return null;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return abs;
}

/**
 * Express middleware — must mount before SPA catch-all and before dist static index.
 */
export function marketingStaticMiddleware(req, res, next) {
  if (!isMarketingSiteEnabled()) return next();
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const rel = matchMarketingPath(req.path);
  if (!rel) return next();

  const root = resolveMarketingRoot();
  if (!root) return next();

  const abs = resolveMarketingFileAbs(rel, root);
  if (!abs) return next();

  marketingSiteHit += 1;
  const ext = path.extname(abs).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  const base = path.basename(abs).toLowerCase();
  // shell/i18n change often during marketing polish — avoid sticky capsule CSS
  if (
    isShowcaseCatalogPath(rel)
    || ext === '.html'
    || ext === '.txt'
    || ext === '.xml'
    || base === 'shell.css'
    || base === 'i18n.js'
  ) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  res.setHeader('X-Nova-Marketing', '1');
  res.setHeader('X-Showcase-Mode', getShowcaseAdminMode());
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }
  fs.createReadStream(abs).pipe(res);
}

export { matchMarketingPath, isMarketingSiteEnabled };
