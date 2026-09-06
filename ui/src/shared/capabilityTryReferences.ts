// PD-SAAS-FORK: filter auto @ paths on Hub「试一下」per capability (Nova slides vs HTML decks)
import { isNonUserDeliverablePath } from './nonDeliverablePaths';
import { isCanvasManifestPath } from './designCanvasManifest';

const NOVA_PPT_AESTHETIC_SLIDES = 'nova-ppt-aesthetic-slides';
const NOVA_BENTO_SLIDES = 'nova-bento-slides';

/** Process / layout files from design-canvas flows — not useful as auto @ for most capabilities. */
const CAPABILITY_TRY_PROCESS_BASENAMES = new Set([
  'layout.md',
  'poster.md',
  'design-brief.md',
  'canvas-manifest.json',
  'manifest.json',
]);

/** Fresh-create capabilities: user did not pick attachments; do not bulk @ prior session artifacts. */
const NO_AUTO_REFERENCE_EXACT_SLUGS = new Set([
  'image-generation',
  'df-image-generation',
  'od-image-gen',
  'tool-generate-image',
  'mkt-image-gen',
  'edu-sci-generate-image',
]);

const NO_AUTO_REFERENCE_SLUG_PREFIXES = [
  'image-generation',
  'mkt-image-gen',
  'seedance',
  'seedream',
  'imagen',
  'veo',
];

function normalizePath(raw: string): string {
  return String(raw || '').replace(/\\/g, '/').trim();
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function extractSlideDeckDir(path: string): string | null {
  const normalized = normalizePath(path).toLowerCase();
  const match = normalized.match(/(?:^|\/)((?:artifacts\/)?slides-[^/]+)/);
  if (!match) return null;
  const segment = match[1];
  return segment.startsWith('artifacts/') ? segment : `artifacts/${segment}`;
}

/** Strip process / internal paths before any capability-specific rules. */
export function filterNonReferenceableDeliverablePaths(paths: string[]): string[] {
  return paths.filter((raw) => {
    const path = normalizePath(raw);
    if (!path) return false;
    if (isNonUserDeliverablePath(path)) return false;
    if (isCanvasManifestPath(path)) return false;

    const base = basename(path).toLowerCase();
    if (CAPABILITY_TRY_PROCESS_BASENAMES.has(base)) return false;

    return true;
  });
}

export function isFreshCreateCapabilityTry(slug?: string | null): boolean {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return false;
  if (NO_AUTO_REFERENCE_EXACT_SLUGS.has(normalized)) return true;
  return NO_AUTO_REFERENCE_SLUG_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}-`),
  );
}

/**
 * When user clicks「试一下」on Nova aesthetic slides inside an existing chat,
 * do not auto-@ unrelated HTML/README or **prior slide decks** from other tasks.
 * Keep research documents (.md/.pdf/.docx) only — user may manually @ a deck to continue.
 *
 * Fresh-create capabilities (image-generation, etc.) never auto-@ — user adds @ manually.
 * Does NOT affect transcript, project memory, or user manual @ picks.
 */
export function filterPathsForCapabilityTry(
  paths: string[],
  capabilitySlug?: string | null,
): string[] {
  const filtered = filterNonReferenceableDeliverablePaths(paths);
  const slug = String(capabilitySlug || '').trim().toLowerCase();

  if (isFreshCreateCapabilityTry(slug)) {
    return [];
  }

  if (slug === NOVA_BENTO_SLIDES) {
    return filtered.filter((raw) => {
      const path = normalizePath(raw);
      if (!path) return false;
      if (/\.bento\.html$/i.test(path)) return true;
      const base = basename(path).toLowerCase();
      if (/\.(md|pdf|docx)$/i.test(base)) return true;
      if (/\.html?$/i.test(base)) return false;
      if (base === 'readme.md') return false;
      if (extractSlideDeckDir(path)) return false;
      return false;
    });
  }

  if (slug !== NOVA_PPT_AESTHETIC_SLIDES) {
    return filtered;
  }

  return filtered.filter((raw) => {
    const path = normalizePath(raw);
    if (!path) return false;

    if (extractSlideDeckDir(path)) {
      return false;
    }

    const base = basename(path).toLowerCase();
    if (/\.html?$/i.test(base)) {
      return false;
    }
    if (base === 'readme.md') {
      return false;
    }
    if (/\/artifacts\/design\//i.test(path)) {
      return false;
    }

    // Reference decks/docs for strict per-page remakes (exclude prior PNG slide decks above).
    if (/\.(md|pdf|docx|ppt|pptx|xlsx)$/i.test(base)) {
      return true;
    }

    return false;
  });
}

export function isNovaPptAestheticSlidesCapability(slug?: string | null): boolean {
  return String(slug || '').trim().toLowerCase() === NOVA_PPT_AESTHETIC_SLIDES;
}
