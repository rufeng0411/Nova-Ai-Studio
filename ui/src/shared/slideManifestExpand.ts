/**
 * PD-SAAS-FORK: Expand Nova slide-manifest pages for partial-delivery summary rows.
 */
import type { SlideManifestPage } from './buildDeliverableSummaryRows';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function padSlideNum(n: number): string {
  return String(n).padStart(2, '0');
}

export function parseSlideManifestPages(manifest: unknown, turnArtifactDir?: string | null): SlideManifestPage[] {
  if (!manifest || typeof manifest !== 'object') return [];
  const record = manifest as Record<string, unknown>;
  const pages = Array.isArray(record.pages) ? record.pages : [];
  const turnDir = turnArtifactDir ? normalizePath(turnArtifactDir) : '';

  return pages.map((page, idx) => {
    if (!page || typeof page !== 'object') {
      return { page: idx + 1, file: `slide-${padSlideNum(idx + 1)}.png` };
    }
    const p = page as Record<string, unknown>;
    const pageNum = typeof p.page === 'number' ? p.page : idx + 1;
    const imagePath = typeof p.image_path === 'string' ? p.image_path
      : typeof p.file === 'string' ? p.file
      : typeof p.path === 'string' ? p.path
      : `slide-${padSlideNum(pageNum)}.png`;
    const norm = normalizePath(imagePath);
    const path = norm.includes('/') ? norm : (turnDir ? `${turnDir}/${norm}` : norm);
    const title = typeof p.title === 'string' ? p.title : undefined;
    return { page: pageNum, file: imagePath, path, title };
  });
}

export function inferNovaSlidePagesFromPaths(
  turnArtifactDir: string,
  paths: string[],
  expectedCount?: number,
): SlideManifestPage[] {
  const turnDir = normalizePath(turnArtifactDir);
  const slidePaths = paths
    .map(normalizePath)
    .filter((p) => p.startsWith(`${turnDir}/`) && /slide-\d+\.png$/i.test(p));

  const byPage = new Map<number, SlideManifestPage>();
  for (const p of slidePaths) {
    const match = /slide-(\d+)\.png$/i.exec(p);
    const pageNum = match ? Number.parseInt(match[1], 10) : 0;
    if (pageNum > 0) {
      byPage.set(pageNum, { page: pageNum, path: p, file: p.split('/').pop() });
    }
  }

  const maxFromPaths = byPage.size > 0 ? Math.max(...byPage.keys()) : 0;
  const total = Math.max(expectedCount ?? 0, maxFromPaths);

  if (total === 0) return [...byPage.values()].sort((a, b) => (a.page ?? 0) - (b.page ?? 0));

  const pages: SlideManifestPage[] = [];
  for (let i = 1; i <= total; i += 1) {
    const existing = byPage.get(i);
    if (existing) {
      pages.push(existing);
    } else {
      pages.push({
        page: i,
        file: `slide-${padSlideNum(i)}.png`,
        path: `${turnDir}/slide-${padSlideNum(i)}.png`,
      });
    }
  }
  return pages;
}

export function expandExpectedManifestSlideCount(
  expectedManifest: Array<{
    count?: unknown;
    kind?: unknown;
    id?: unknown;
  }> | null | undefined,
  turnArtifactDir: string | null | undefined,
): SlideManifestPage[] {
  if (!expectedManifest?.length || !turnArtifactDir) return [];
  const turnDir = normalizePath(turnArtifactDir);

  for (const entry of expectedManifest) {
    const count = typeof entry.count === 'number' ? entry.count : undefined;
    const kind = typeof entry.kind === 'string' ? entry.kind : '';
    if (count && count > 0 && (kind === 'png' || kind === 'image' || /slide/i.test(String(entry.id ?? '')))) {
      return Array.from({ length: count }, (_, idx) => {
        const pageNum = idx + 1;
        return {
          page: pageNum,
          file: `slide-${padSlideNum(pageNum)}.png`,
          path: `${turnDir}/slide-${padSlideNum(pageNum)}.png`,
        };
      });
    }
  }
  return [];
}
