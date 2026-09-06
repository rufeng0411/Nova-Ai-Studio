// PD-SAAS-FORK: read Nova slide-manifest.json / plan.json for export scope enrichment
import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED = new Set(['16:9', '4:3', '1:1', '9:16', '3:4']);

function normalizeManifestImagePath(imagePath, bundleDir) {
  const raw = String(imagePath || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('artifacts/')) return raw;
  const base = path.posix.basename(raw);
  return bundleDir ? `${bundleDir}/${base}` : raw;
}

/** Ordered workspace-relative slide paths from manifest `pages[]`. */
export function bundleImagePathsFromManifest(manifest, bundleDir) {
  if (!manifest || typeof manifest !== 'object' || !bundleDir) return [];
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (pages.length === 0) return [];

  const sorted = [...pages].sort(
    (a, b) => (Number(a?.page_index) || 0) - (Number(b?.page_index) || 0),
  );
  const paths = [];
  for (const page of sorted) {
    const normalized = normalizeManifestImagePath(page?.image_path || page?.imagePath, bundleDir);
    if (normalized) paths.push(normalized);
  }
  return paths;
}

function applyManifestFields(scope, manifest, bundleDir) {
  if (!manifest || typeof manifest !== 'object') return scope;
  const ratio = String(manifest.aspect_ratio || '').trim();
  if (SUPPORTED.has(ratio)) {
    scope.aspectRatio = ratio;
  }
  const title = String(manifest.deck_title || manifest.title || '').trim();
  if (title) {
    scope.deckTitle = title;
  }
  const fromPages = bundleImagePathsFromManifest(manifest, bundleDir);
  if (fromPages.length > 0) {
    scope.bundleImagePaths = fromPages;
    scope.pageCount = fromPages.length;
    scope.bundle = fromPages.length > 1;
  } else if (Number.isInteger(manifest.page_count) && manifest.page_count > 0) {
    scope.pageCount = manifest.page_count;
    scope.bundle = manifest.page_count > 1;
  }
  return scope;
}

export function enrichSlideDeckScopeFromManifest(projectRoot, scope) {
  if (!scope || scope.scopeId !== 'slide_deck_png') {
    return scope;
  }
  const dir = scope.bundleDir;
  if (!dir) return scope;
  const dirParts = dir.split('/');
  for (const name of ['slide-manifest.json', 'plan.json']) {
    const manifestPath = path.join(projectRoot, ...dirParts, name);
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      applyManifestFields(scope, manifest, dir);
    } catch {
      // optional manifest
    }
  }
  return scope;
}
