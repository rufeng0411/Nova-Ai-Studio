// PD-SAAS-FORK: Showcase thumbs are always 3:4 cover (bitmap)
import sharp from 'sharp';

/** Canonical showcase preview size — width:height = 3:4 */
export const SHOWCASE_THUMB_WIDTH = 600;
export const SHOWCASE_THUMB_HEIGHT = 800;

/**
 * Center-cover resize to 3:4 JPEG.
 * @param {Buffer} input
 * @returns {Promise<Buffer>}
 */
export async function normalizeShowcaseThumbBuffer(input) {
  return sharp(input)
    .rotate()
    .resize(SHOWCASE_THUMB_WIDTH, SHOWCASE_THUMB_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/**
 * @param {string} filePath
 */
export function isImagePath(filePath) {
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(String(filePath || ''));
}
