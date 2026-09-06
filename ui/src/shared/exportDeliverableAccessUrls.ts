/**
 * PD-SAAS-FORK: build API access URLs for session HTML export (four-line alignment).
 */
import { normalizeArtifactPath, classifyDeliverablePath, getArtifactFileName } from './artifactPaths';
import {
  needsProjectPreviewUrl,
  supportsBrowserInlinePreviewUrl,
} from './projectPreviewCapabilities';
import { authenticatedFetch } from '../utils/api';

export type ExportDeliverableAccess = {
  inputPath: string;
  apiPath: string;
  resolvedPath?: string | null;
  hintDir?: string | null;
  openPath: string;
  resolveUrl: string;
  contentUrl: string;
  previewUrl: string;
  downloadUrl: string;
  inlineMediaUrl: string;
  absoluteResolveUrl: string;
  absoluteContentUrl: string;
  absolutePreviewUrl: string;
  absoluteDownloadUrl: string;
  absoluteInlineMediaUrl: string;
};

function encodePathSegments(relativePath: string): string {
  return String(relativePath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeApiPath(path: string, projectRoot = ''): string {
  return normalizeArtifactPath(path, projectRoot).replace(/^\/+/, '');
}

function toAbsoluteUrl(origin: string | null | undefined, apiPath: string): string {
  if (!apiPath) return '';
  if (/^https?:\/\//i.test(apiPath)) return apiPath;
  if (!origin) return apiPath;
  const base = origin.replace(/\/+$/, '');
  return `${base}${apiPath.startsWith('/') ? apiPath : `/${apiPath}`}`;
}

function buildResolveUrl(projectName: string, filePath: string, hintDir?: string | null): string {
  const params = new URLSearchParams({ filePath });
  if (hintDir) params.set('hintDir', hintDir);
  return `/api/projects/${encodeURIComponent(projectName)}/file/resolve?${params.toString()}`;
}

function buildContentUrl(projectName: string, apiPath: string, download = false): string {
  const params = new URLSearchParams({ path: apiPath });
  if (download) params.set('download', '1');
  return `/api/projects/${encodeURIComponent(projectName)}/files/content?${params.toString()}`;
}

function buildPreviewUrl(projectName: string, apiPath: string): string {
  const encoded = encodePathSegments(apiPath);
  return `/api/projects/${encodeURIComponent(projectName)}/preview/${encoded}`;
}

function buildInlineMediaUrl(
  projectName: string,
  apiPath: string,
  fileName: string,
  kind: ReturnType<typeof classifyDeliverablePath>,
): string {
  if (!projectName || !apiPath) return '';
  if (needsProjectPreviewUrl(fileName, kind)) {
    return buildPreviewUrl(projectName, apiPath);
  }
  if (!supportsBrowserInlinePreviewUrl(fileName, kind)) {
    return '';
  }
  return buildContentUrl(projectName, apiPath);
}

export function buildTaskFolderSnapshotUrl(
  projectName: string,
  scopeDir: string,
): string {
  const params = new URLSearchParams({ scopeDir: scopeDir.replace(/\\/g, '/').replace(/\/+$/, '') });
  return `/api/projects/${encodeURIComponent(projectName)}/deliverables/task-folder-snapshot?${params.toString()}`;
}

export function buildExportDeliverableAccess(input: {
  projectName: string;
  path: string;
  hintDir?: string | null;
  resolvedPath?: string | null;
  exportOrigin?: string | null;
  projectRoot?: string;
}): ExportDeliverableAccess {
  const inputPath = String(input.path ?? '').trim();
  if (/^https?:\/\//i.test(inputPath)) {
    return {
      inputPath,
      apiPath: inputPath,
      resolvedPath: inputPath,
      hintDir: input.hintDir ?? null,
      openPath: inputPath,
      resolveUrl: '',
      contentUrl: inputPath,
      previewUrl: inputPath,
      downloadUrl: inputPath,
      inlineMediaUrl: inputPath,
      absoluteResolveUrl: inputPath,
      absoluteContentUrl: inputPath,
      absolutePreviewUrl: inputPath,
      absoluteDownloadUrl: inputPath,
      absoluteInlineMediaUrl: inputPath,
    };
  }

  const apiPath = normalizeApiPath(input.resolvedPath || inputPath, input.projectRoot ?? '');
  const fileName = getArtifactFileName(apiPath);
  const kind = classifyDeliverablePath(fileName || apiPath);
  const openPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const resolveUrl = buildResolveUrl(input.projectName, inputPath, input.hintDir);
  const contentUrl = apiPath ? buildContentUrl(input.projectName, apiPath) : '';
  const previewUrl = apiPath && needsProjectPreviewUrl(fileName, kind)
    ? buildPreviewUrl(input.projectName, apiPath)
    : '';
  const downloadUrl = apiPath ? buildContentUrl(input.projectName, apiPath, true) : '';
  const inlineMediaUrl = buildInlineMediaUrl(input.projectName, apiPath, fileName, kind);

  return {
    inputPath,
    apiPath,
    resolvedPath: input.resolvedPath ?? null,
    hintDir: input.hintDir ?? null,
    openPath,
    resolveUrl,
    contentUrl,
    previewUrl,
    downloadUrl,
    inlineMediaUrl,
    absoluteResolveUrl: toAbsoluteUrl(input.exportOrigin, resolveUrl),
    absoluteContentUrl: toAbsoluteUrl(input.exportOrigin, contentUrl),
    absolutePreviewUrl: toAbsoluteUrl(input.exportOrigin, previewUrl),
    absoluteDownloadUrl: toAbsoluteUrl(input.exportOrigin, downloadUrl),
    absoluteInlineMediaUrl: toAbsoluteUrl(input.exportOrigin, inlineMediaUrl || contentUrl || previewUrl),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const poolSize = Math.max(1, Math.min(limit, items.length));

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
  return results;
}

const DEFAULT_RESOLVE_CONCURRENCY = 3;

export function exportAccessMapKey(path: string, hintDir?: string | null): string {
  return `${normalizeApiPath(path).toLowerCase()}::${(hintDir ?? '').replace(/\\/g, '/').toLowerCase()}`;
}

async function resolvePathOnServer(
  projectName: string,
  filePath: string,
  hintDir?: string | null,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ filePath });
    if (hintDir) params.set('hintDir', hintDir);
    const response = await authenticatedFetch(
      `/api/projects/${encodeURIComponent(projectName)}/file/resolve?${params.toString()}`,
    );
    const data = await response.json();
    if (response.ok && data?.ok && typeof data.relativePath === 'string' && data.relativePath) {
      return data.relativePath;
    }
  } catch {
    // offline export fallback — use expanded client path only
  }
  return null;
}

export async function buildExportDeliverableAccessMap(input: {
  projectName: string;
  paths: Array<{ path: string; hintDir?: string | null }>;
  exportOrigin?: string | null;
  projectRoot?: string;
  resolveOnServer?: boolean;
}): Promise<Map<string, ExportDeliverableAccess>> {
  const map = new Map<string, ExportDeliverableAccess>();
  const unique = new Map<string, { path: string; hintDir?: string | null }>();
  for (const entry of input.paths) {
    const path = String(entry.path ?? '').trim();
    if (!path) continue;
    const key = exportAccessMapKey(path, entry.hintDir);
    if (!unique.has(key)) unique.set(key, { path, hintDir: entry.hintDir });
  }

  await mapWithConcurrency([...unique.values()], DEFAULT_RESOLVE_CONCURRENCY, async (entry) => {
    let resolvedPath: string | null = null;
    if (input.resolveOnServer !== false && !/^https?:\/\//i.test(entry.path)) {
      resolvedPath = await resolvePathOnServer(input.projectName, entry.path, entry.hintDir);
    }
    const access = buildExportDeliverableAccess({
      projectName: input.projectName,
      path: entry.path,
      hintDir: entry.hintDir,
      resolvedPath,
      exportOrigin: input.exportOrigin,
      projectRoot: input.projectRoot,
    });
    map.set(exportAccessMapKey(entry.path, entry.hintDir), access);
    if (resolvedPath) {
      map.set(exportAccessMapKey(resolvedPath, entry.hintDir), access);
    }
  });

  return map;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderExportAccessLinksHtml(
  access: ExportDeliverableAccess | undefined,
  options?: { preferAbsolute?: boolean },
): string {
  if (!access) return '—';
  const preferAbsolute = options?.preferAbsolute !== false;
  const pick = (relative: string, absolute: string) => {
    const href = (preferAbsolute && absolute) ? absolute : relative;
    if (!href) return '';
    return href;
  };

  const lines: string[] = [];
  const primary = pick(access.inlineMediaUrl || access.contentUrl || access.previewUrl, access.absoluteInlineMediaUrl)
    || pick(access.contentUrl, access.absoluteContentUrl)
    || pick(access.previewUrl, access.absolutePreviewUrl);
  if (primary) {
    lines.push(`<div class="access-line"><span class="access-label">打开</span> <a href="${escapeHtml(primary)}" target="_blank" rel="noopener noreferrer">${escapeHtml(primary)}</a></div>`);
  }
  const content = pick(access.contentUrl, access.absoluteContentUrl);
  if (content && content !== primary) {
    lines.push(`<div class="access-line"><span class="access-label">content</span> <a href="${escapeHtml(content)}" target="_blank" rel="noopener noreferrer">${escapeHtml(content)}</a></div>`);
  }
  const preview = pick(access.previewUrl, access.absolutePreviewUrl);
  if (preview && preview !== primary) {
    lines.push(`<div class="access-line"><span class="access-label">preview</span> <a href="${escapeHtml(preview)}" target="_blank" rel="noopener noreferrer">${escapeHtml(preview)}</a></div>`);
  }
  const resolve = pick(access.resolveUrl, access.absoluteResolveUrl);
  if (resolve) {
    lines.push(`<div class="access-line"><span class="access-label">resolve</span> <code>${escapeHtml(resolve)}</code></div>`);
  }
  if (access.apiPath) {
    lines.push(`<div class="access-line"><span class="access-label">apiPath</span> <code>${escapeHtml(access.apiPath)}</code></div>`);
  }
  if (access.resolvedPath && access.resolvedPath !== access.apiPath) {
    lines.push(`<div class="access-line"><span class="access-label">resolved</span> <code>${escapeHtml(access.resolvedPath)}</code></div>`);
  }
  return lines.length > 0 ? `<div class="access-links">${lines.join('')}</div>` : '—';
}
