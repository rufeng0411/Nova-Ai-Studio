/**
 * PD-SAAS-FORK: serve project binary via OSS signed URL (SaaS) or local stream.
 */
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { ensureMirroredAndGetSignedUrl } from '../saas/storage/ossObjectStorage.js';
import { applyProjectMediaCacheHeaders, applyProjectPreviewCacheHeaders } from './projectFileCacheHeaders.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{
 *   absPath: string;
 *   download?: boolean;
 *   cacheMode?: 'media' | 'preview';
 * }} options
 * @returns {Promise<boolean>} true if response was handled
 */
export async function serveProjectBinary(req, res, options) {
  const { absPath, download = false, cacheMode = 'media' } = options;

  try {
    await access(absPath);
  } catch {
    res.status(404).json({ error: 'File not found' });
    return true;
  }

  try {
    const signedUrl = await ensureMirroredAndGetSignedUrl(absPath, {
      download,
      basename: path.basename(absPath),
    });
    if (signedUrl) {
      res.redirect(302, signedUrl);
      return true;
    }
  } catch (error) {
    console.warn('[oss] signed URL failed, fallback to local stream:', error instanceof Error ? error.message : error);
  }

  const mimeType = mime.lookup(absPath) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  if (cacheMode === 'preview') {
    applyProjectPreviewCacheHeaders(res, absPath);
  } else {
    applyProjectMediaCacheHeaders(res, absPath);
  }

  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(absPath))}"`);
  }

  const fileStream = createReadStream(absPath);
  fileStream.pipe(res);
  fileStream.on('error', (error) => {
    console.error('Error streaming file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error reading file' });
    }
  });
  return true;
}
