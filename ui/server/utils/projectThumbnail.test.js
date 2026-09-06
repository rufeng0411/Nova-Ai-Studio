import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import {
  createProjectThumbnail,
  isSupportedThumbnailSource,
  normalizeThumbnailOptions,
} from './projectThumbnail.js';

describe('projectThumbnail', () => {
  it('normalizes thumbnail options to bounded webp defaults', () => {
    expect(normalizeThumbnailOptions({ max: '9999', q: '-5', format: 'png' })).toEqual({
      max: 1200,
      q: 30,
      format: 'png',
    });
    expect(normalizeThumbnailOptions({})).toEqual({ max: 320, q: 75, format: 'webp' });
  });

  it('only accepts raster formats sharp can resize safely', () => {
    expect(isSupportedThumbnailSource('slide.png')).toBe(true);
    expect(isSupportedThumbnailSource('photo.jpeg')).toBe(true);
    expect(isSupportedThumbnailSource('deck.svg')).toBe(false);
    expect(isSupportedThumbnailSource('movie.mp4')).toBe(false);
  });

  it('creates and reuses a cached thumbnail under the server cache root', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'pilotdeck-thumb-'));
    const source = path.join(dir, 'slide.png');
    const cacheRoot = path.join(dir, 'cache');
    await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: '#4466aa',
      },
    })
      .png()
      .toFile(source);

    const first = await createProjectThumbnail({
      sourcePath: source,
      cacheRoot,
      options: { max: 320, q: 70, format: 'webp' },
    });
    const firstMeta = await sharp(first.path).metadata();
    expect(first.contentType).toBe('image/webp');
    expect(firstMeta.width).toBeLessThanOrEqual(320);
    expect(firstMeta.height).toBeLessThanOrEqual(320);

    const before = await stat(first.path);
    const second = await createProjectThumbnail({
      sourcePath: source,
      cacheRoot,
      options: { max: 320, q: 70, format: 'webp' },
    });
    const after = await stat(second.path);

    expect(second.path).toBe(first.path);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });
});
