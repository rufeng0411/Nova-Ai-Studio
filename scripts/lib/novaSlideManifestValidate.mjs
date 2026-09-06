// PD-SAAS-FORK: validate Nova slide-manifest.json (aspect_ratio enum, page_count, contiguous indices)
import { existsSync } from 'node:fs';
import path from 'node:path';

export const VALID_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '1:1', '3:4'];
export const VALID_PAGE_STATUSES = ['completed', 'failed', 'pending'];
export const REQUIRED_MANIFEST_FIELDS = [
  'skill_version',
  'deck_title',
  'idea_prompt',
  'preset_id',
  'template_style',
  'aspect_ratio',
  'language',
  'detail_level',
  'page_count',
  'pages',
];

/**
 * @param {unknown} manifest
 * @param {{ deckDir?: string, requireCompletedImages?: boolean }} [options]
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSlideManifest(manifest, options = {}) {
  const errors = [];
  const deckDir = options.deckDir ? path.resolve(options.deckDir) : null;
  const requireCompletedImages = Boolean(options.requireCompletedImages);

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest must be a JSON object'] };
  }

  const record = /** @type {Record<string, unknown>} */ (manifest);

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in record)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  const aspectRatio = record.aspect_ratio;
  if (typeof aspectRatio !== 'string' || !VALID_ASPECT_RATIOS.includes(aspectRatio)) {
    errors.push(
      `aspect_ratio must be one of ${VALID_ASPECT_RATIOS.join(', ')}, got ${JSON.stringify(aspectRatio)}`,
    );
  }

  const pageCount = record.page_count;
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    errors.push(`page_count must be a positive integer, got ${JSON.stringify(pageCount)}`);
  }

  const pages = record.pages;
  if (!Array.isArray(pages) || pages.length < 1) {
    errors.push('pages must be a non-empty array');
    return { ok: errors.length === 0, errors };
  }

  if (Number.isInteger(pageCount) && pageCount !== pages.length) {
    errors.push(`page_count (${pageCount}) must equal pages.length (${pages.length})`);
  }

  const seenIndices = new Set();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const prefix = `pages[${i}]`;

    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    const pageRecord = /** @type {Record<string, unknown>} */ (page);
    const pageIndex = pageRecord.page_index;
    if (!Number.isInteger(pageIndex) || pageIndex < 1) {
      errors.push(`${prefix}.page_index must be a positive integer`);
    } else {
      if (seenIndices.has(pageIndex)) {
        errors.push(`duplicate page_index: ${pageIndex}`);
      }
      seenIndices.add(pageIndex);
      if (Number.isInteger(pageCount) && (pageIndex < 1 || pageIndex > pageCount)) {
        errors.push(`${prefix}.page_index ${pageIndex} out of range 1..${pageCount}`);
      }
    }

    const status = pageRecord.status;
    if (typeof status !== 'string' || !VALID_PAGE_STATUSES.includes(status)) {
      errors.push(`${prefix}.status must be one of ${VALID_PAGE_STATUSES.join(', ')}`);
    }

    const pageDescription = pageRecord.page_description;
    if (typeof pageDescription !== 'string' || pageDescription.trim().length < 1) {
      errors.push(`${prefix}.page_description must be a non-empty string`);
    }

    const imagePath = pageRecord.image_path;
    if (status === 'completed') {
      if (typeof imagePath !== 'string' || imagePath.trim().length < 1) {
        errors.push(`${prefix}.image_path required when status=completed`);
      } else if (deckDir && requireCompletedImages) {
        const abs = path.resolve(deckDir, imagePath);
        if (!existsSync(abs)) {
          errors.push(`${prefix}.image_path file not found: ${imagePath}`);
        }
      }
    }
  }

  if (Number.isInteger(pageCount)) {
    for (let expected = 1; expected <= pageCount; expected += 1) {
      if (!seenIndices.has(expected)) {
        errors.push(`missing page_index ${expected}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
