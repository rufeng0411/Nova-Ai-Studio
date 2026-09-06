import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SUPPORTED_SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const SUPPORTED_OUTPUT_FORMATS = new Set(['webp', 'jpeg', 'png']);
const DEFAULT_THUMBNAIL_OPTIONS = {
  max: 320,
  q: 75,
  format: 'webp',
};

// PD-SAAS-FORK: server-side raster thumbnails keep large deliverable images out of first paint.
export function isSupportedThumbnailSource(filePath) {
  return SUPPORTED_SOURCE_EXTENSIONS.has(path.extname(String(filePath || '')).toLowerCase());
}

export function normalizeThumbnailOptions(raw = {}) {
  const parsedMax = Number.parseInt(String(raw.max ?? DEFAULT_THUMBNAIL_OPTIONS.max), 10);
  const parsedQuality = Number.parseInt(String(raw.q ?? DEFAULT_THUMBNAIL_OPTIONS.q), 10);
  const requestedFormat = String(raw.format ?? DEFAULT_THUMBNAIL_OPTIONS.format).toLowerCase();
  const format = SUPPORTED_OUTPUT_FORMATS.has(requestedFormat)
    ? requestedFormat
    : DEFAULT_THUMBNAIL_OPTIONS.format;

  return {
    max: Math.min(1200, Math.max(64, Number.isFinite(parsedMax) ? parsedMax : DEFAULT_THUMBNAIL_OPTIONS.max)),
    q: Math.min(95, Math.max(30, Number.isFinite(parsedQuality) ? parsedQuality : DEFAULT_THUMBNAIL_OPTIONS.q)),
    format,
  };
}

export function contentTypeForThumbnailFormat(format) {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  return 'image/webp';
}

function extensionForThumbnailFormat(format) {
  if (format === 'jpeg') return 'jpg';
  return format;
}

const THUMBNAIL_GEN_LIMIT = Math.min(
  4,
  Math.max(1, Number(process.env.PILOTDECK_THUMBNAIL_CONCURRENCY || 2)),
);
let thumbnailGenInflight = 0;
/** @type {Array<() => void>} */
const thumbnailGenWaiters = [];

async function withThumbnailGenerationSlot(run) {
  if (thumbnailGenInflight >= THUMBNAIL_GEN_LIMIT) {
    await new Promise((resolve) => {
      thumbnailGenWaiters.push(resolve);
    });
  }
  thumbnailGenInflight += 1;
  try {
    return await run();
  } finally {
    thumbnailGenInflight -= 1;
    const next = thumbnailGenWaiters.shift();
    if (next) next();
  }
}

function thumbnailCacheKey(sourcePath, sourceStat, options) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      sourcePath: path.resolve(sourcePath),
      mtimeMs: sourceStat.mtimeMs,
      size: sourceStat.size,
      max: options.max,
      q: options.q,
      format: options.format,
    }))
    .digest('hex');
}

export async function createProjectThumbnail({ sourcePath, cacheRoot, options: rawOptions = {} }) {
  if (!isSupportedThumbnailSource(sourcePath)) {
    const error = new Error('Unsupported thumbnail source');
    error.code = 'UNSUPPORTED_THUMBNAIL_SOURCE';
    throw error;
  }

  const options = normalizeThumbnailOptions(rawOptions);
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) {
    const error = new Error('Thumbnail source is not a file');
    error.code = 'INVALID_THUMBNAIL_SOURCE';
    throw error;
  }

  await mkdir(cacheRoot, { recursive: true });
  const key = thumbnailCacheKey(sourcePath, sourceStat, options);
  const cachePath = path.join(cacheRoot, `${key}.${extensionForThumbnailFormat(options.format)}`);

  try {
    await access(cachePath);
    return {
      path: cachePath,
      contentType: contentTypeForThumbnailFormat(options.format),
      fromCache: true,
    };
  } catch {
    // Cache miss: generate below.
  }

  let pipeline = sharp(sourcePath, { failOn: 'none' })
    .rotate()
    .resize({
      width: options.max,
      height: options.max,
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (options.format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 8 });
  } else if (options.format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: options.q, mozjpeg: true });
  } else {
    pipeline = pipeline.webp({ quality: options.q });
  }

  await withThumbnailGenerationSlot(() => pipeline.toFile(cachePath));
  return {
    path: cachePath,
    contentType: contentTypeForThumbnailFormat(options.format),
    fromCache: false,
  };
}

export function streamThumbnailFile(thumbnailPath) {
  return createReadStream(thumbnailPath);
}
