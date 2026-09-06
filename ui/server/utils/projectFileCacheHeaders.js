// PD-SAAS-FORK: browser + nginx edge cache for project media (chat / deliverables / preview)
import path from 'path';

const CACHEABLE_MEDIA_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.avif',
  '.mp4', '.webm', '.mov', '.m4v',
  '.mp3', '.wav', '.ogg', '.m4a',
  '.pdf',
]);

/**
 * @param {import('express').Response} res
 * @param {string} filePath absolute or relative path on disk
 */
export function applyProjectMediaCacheHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!CACHEABLE_MEDIA_EXT.has(ext)) return;
  res.setHeader('Cache-Control', 'private, max-age=604800, stale-while-revalidate=86400');
}

/**
 * Preview route: HTML stays uncached; raster/video/pdf can cache.
 * @param {import('express').Response} res
 * @param {string} filePath
 */
export function applyProjectPreviewCacheHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return;
  }
  applyProjectMediaCacheHeaders(res, filePath);
}
