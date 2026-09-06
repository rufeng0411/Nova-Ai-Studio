// PD-SAAS-FORK: Launch Profile API — profile / preview / compile
import express from 'express';
import {
  compileLaunchResult,
  getHtmlPptPreviewPath,
  getHtmlPptStaticRoot,
  htmlPptDeckPreviewUrl,
  htmlPptLayoutPreviewUrl,
  htmlPptThemePreviewUrl,
  resolveLaunchProfile,
} from '../../../scripts/lib/launchProfileProviders.mjs';
import { getLaunchEntry } from '../../../scripts/lib/launchRegistry.mjs';
import { appendPreflightTelemetry } from '../../../src/saas/preflight/preflightTelemetry.js';
import {
  getOpenDesignStaticRoot,
  getPptCanvasStaticRoot,
  getPptMasterStaticRoot,
} from '../../../scripts/lib/preflightPreviewAssets.mjs';
import { getPreflightRasterStaticRoot } from '../../../scripts/lib/preflightPreviewRaster.mjs';

const router = express.Router();
export const launchStaticRouter = express.Router();
export const openDesignStaticRouter = express.Router();
export const pptMasterStaticRouter = express.Router();
export const pptCanvasStaticRouter = express.Router();
export const preflightRasterStaticRouter = express.Router();

const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const PREVIEW_CSP =
  "default-src 'self' 'unsafe-inline' https: data: blob:; frame-ancestors 'self'; img-src 'self' https: data: blob:; font-src 'self' https: data:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:;";

function appendQueryToken(targetUrl, token) {
  if (!token) return targetUrl;
  const separator = targetUrl.includes('?') ? '&' : '?';
  return `${targetUrl}${separator}token=${encodeURIComponent(token)}`;
}

router.get('/profile/:slug', (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'invalid slug' });
  }
  const entry = getLaunchEntry(slug);
  if (!entry || entry.launch_mode === 'skip') {
    return res.status(404).json({ error: 'launch not registered' });
  }
  try {
    const profile = resolveLaunchProfile(slug);
    if (!profile) return res.status(404).json({ error: 'profile not found' });
    return res.json(profile);
  } catch (err) {
    console.error('[launch] profile error', err);
    return res.status(500).json({ error: 'profile load failed' });
  }
});

/** Serve html-ppt vendor tree (no auth — iframe sub-resources cannot attach JWT headers). */
launchStaticRouter.get(/^\/(.+)$/, (req, res) => {
  const relativePath = String(req.params[0] || '');
  const filePath = getHtmlPptStaticRoot(relativePath);
  if (!filePath) {
    return res.status(404).send('<!-- static asset not found -->');
  }
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  return res.sendFile(filePath);
});

/** Open Design preflight HTML previews (ui/public/vendor/preflight/od). */
openDesignStaticRouter.get(/^\/(.+)$/, (req, res) => {
  const relativePath = String(req.params[0] || '');
  const filePath = getOpenDesignStaticRoot(relativePath);
  if (!filePath) {
    return res.status(404).send('<!-- od preview not found -->');
  }
  if (relativePath.endsWith('.webp')) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  return res.sendFile(filePath);
});

/** ppt-master comparison PNGs for Preflight style/mode cards. */
pptMasterStaticRouter.get(/^\/(.+)$/, (req, res) => {
  const relativePath = String(req.params[0] || '');
  const filePath = getPptMasterStaticRoot(relativePath);
  if (!filePath) {
    return res.status(404).send('<!-- ppt preview not found -->');
  }
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  return res.sendFile(filePath);
});

/** PPT canvas HTML previews (ui/public/vendor/preflight/ppt/canvas). */
pptCanvasStaticRouter.get(/^\/(.+)$/, (req, res) => {
  const relativePath = String(req.params[0] || '');
  const filePath = getPptCanvasStaticRoot(relativePath);
  if (!filePath) {
    return res.status(404).send('<!-- ppt canvas preview not found -->');
  }
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  return res.sendFile(filePath);
});

/** Preflight raster WebP thumbs (ui/public/vendor/preflight/ppt/...). */
preflightRasterStaticRouter.get(/^\/(.+)$/, (req, res) => {
  const relativePath = String(req.params[0] || '');
  const filePath = getPreflightRasterStaticRoot(relativePath);
  if (!filePath) {
    return res.status(404).send('<!-- preflight raster not found -->');
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  return res.sendFile(filePath);
});

router.get('/preview/html-ppt/:kind/:id', (req, res) => {
  const kind = String(req.params.kind || '');
  const id = String(req.params.id || '');
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (kind === 'theme') {
    const target = appendQueryToken(htmlPptThemePreviewUrl(id), token);
    return res.redirect(302, target);
  }
  if (kind === 'deck') {
    const target = appendQueryToken(htmlPptDeckPreviewUrl(id), token);
    return res.redirect(302, target);
  }
  if (kind === 'layout') {
    const target = appendQueryToken(htmlPptLayoutPreviewUrl(id), token);
    return res.redirect(302, target);
  }

  const filePath = getHtmlPptPreviewPath(kind, id);
  if (!filePath) {
    return res.status(404).send('<!-- preview not found -->');
  }
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  return res.sendFile(filePath);
});

router.post('/compile', express.json({ limit: '256kb' }), (req, res) => {
  const slug = String(req.body?.slug || '').trim();
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'invalid slug' });
  }
  const entry = getLaunchEntry(slug);
  if (!entry || entry.launch_mode === 'skip') {
    return res.status(404).json({ error: 'launch not registered' });
  }
  try {
    const result = compileLaunchResult(slug, req.body ?? {});
    const selections = Array.isArray(req.body?.selections) ? req.body.selections : [];
    if (selections.length > 0) {
      appendPreflightTelemetry({
        event: 'preflight_confirm',
        profileRef: slug,
        catalogId: selections[0]?.optionId ?? selections[0]?.id,
        meta: { via: 'launch_compile', selectionCount: selections.length },
      });
    }
    return res.json(result);
  } catch (err) {
    console.error('[launch] compile error', err);
    return res.status(400).json({ error: 'compile failed' });
  }
});

export default router;
