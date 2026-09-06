import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import {
  SHOWCASE_THUMB_HEIGHT,
  SHOWCASE_THUMB_WIDTH,
  normalizeShowcaseThumbBuffer,
} from './showcaseThumbNormalize.js';

describe('normalizeShowcaseThumbBuffer', () => {
  it('center-covers any input to 3:4 JPEG', async () => {
    const landscape = await sharp({
      create: {
        width: 1200,
        height: 600,
        channels: 3,
        background: { r: 40, g: 40, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const out = await normalizeShowcaseThumbBuffer(landscape);
    const meta = await sharp(out).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, SHOWCASE_THUMB_WIDTH);
    assert.equal(meta.height, SHOWCASE_THUMB_HEIGHT);
    assert.ok(Math.abs(meta.width / meta.height - 3 / 4) < 1e-6);
  });

  it('handles portrait inputs without stretch', async () => {
    const portrait = await sharp({
      create: {
        width: 400,
        height: 900,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    })
      .jpeg()
      .toBuffer();

    const out = await normalizeShowcaseThumbBuffer(portrait);
    const meta = await sharp(out).metadata();
    assert.equal(meta.width, 600);
    assert.equal(meta.height, 800);
  });
});
