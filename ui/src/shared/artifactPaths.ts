import {
  compileDeliverableSlotPath,
  deliverablePathCandidates,
  isBareDeliverableFilename,
  isSlugDeliverablePath,
  sanitizeDeliverableLookupPath,
  stripLeakedStoragePath,
} from '../../shared/deliverablePathResolve.mjs';

export { compileDeliverableSlotPath } from '../../shared/deliverablePathResolve.mjs';

/** PD-SAAS-FORK: re-scope corrupted cross-task SDM paths to the active turn directory. */
export function scopeDeliverablePathToTurnDir(
  filePath: string,
  turnArtifactDir?: string | null,
): string {
  const raw = String(filePath || '').trim();
  if (!raw || !turnArtifactDir) return raw;
  return compileDeliverableSlotPath(raw, turnArtifactDir) || raw;
}
import { isSkillResourceUri } from './skillResourcePaths';
import { isDeliverableCertificateUiEnabled } from './perfFeatureFlags';
import { isThinkingTextPseudoPath } from '../../../src/saas/taskState/deliverableIntent.js';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';

export type DeliverableKind =
  | 'html'
  | 'image'
  | 'video'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'code'
  | 'file'
  | 'design_canvas'
  | 'url';

const DELIVERABLE_EXTENSIONS =
  'html?|png|jpe?g|webp|gif|svg|bmp|ico|mp4|mov|webm|avi|mkv|mp3|wav|m4a|ogg|pdf|md|markdown|txt|docx?|rtf|csv|xlsx?|tsv|pptx?|zip|tar|gz|7z|rar|json|xml|ya?ml|tsx?|jsx?|py|css|scss|less|vue|svelte|php|rb|go|rs|java|kt|swift|sql|sh|bat|ps1';

// PD-SAAS-FORK: CJK-aware path character class so Chinese filenames
// (e.g. 发烧硬件用户研究报告.md) are recognized as deliverables. CJK names do
// not allow space-joined segments to avoid gluing preceding prose words.
const CJK_PATH_CHAR = String.raw`[\w./\\\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff-]`;

const FILE_PATH_WITH_EXT = new RegExp(
  // Latin paths: require `/` in the first segment (or a bare `name.ext`) so prose like
  // "Saved to output/landing.html" does not capture `to output/landing.html`.
  // Use horizontal whitespace only so multiline chat text does not glue paths across lines.
  String.raw`([\w./\\-]*[/\\][\w./\\-]*(?:[ \t]+[\w./\\-]+)*\.(?:${DELIVERABLE_EXTENSIONS})|[\w.-]+\.(?:${DELIVERABLE_EXTENSIONS})|${CJK_PATH_CHAR}+\.(?:${DELIVERABLE_EXTENSIONS}))`,
  'gi',
);

const WINDOWS_ABSOLUTE_PATH = new RegExp(
  String.raw`([A-Za-z]:[\\/][^\s"'<>|]+?\.(?:${DELIVERABLE_EXTENSIONS}))`,
  'gi',
);

const UNIX_ABSOLUTE_PATH = new RegExp(
  String.raw`((?:/[\w.\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff-]+)+/[\w.\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff-]+\.(?:${DELIVERABLE_EXTENSIONS}))`,
  'gi',
);

const SAVED_TO_PATTERN = new RegExp(
  String.raw`(?:saved to|written to|output(?:ted)? to|wrote to|created at|生成(?:于|到)?|保存(?:到|至)?|文件(?:在|位于)?|(?:报告)?文件路径|路径)[:：]\s*["']?([^\s"'<>|]+?\.(?:${DELIVERABLE_EXTENSIONS}))["']?`,
  'gi',
);

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

/** Prefer markdown link targets over label text (`[label](href)`). */
const MARKDOWN_LINK_PATH_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;

const PILOTDECK_LINK_PATTERN = /^pilotdeck:\/\/(open|reveal|preview)\/(.+)$/i;

/**
 * Repair Windows paths where `\r` in `\rufen` was interpreted as a carriage
 * return (common when agent/user paths pass through JS `\r` escapes).
 */
/** When `\r` in `\rog`, `\rufen`, etc. is parsed as carriage return, restore `/r`. */
export function repairEatenBackslashRSegments(filePath: string): string {
  let s = String(filePath || '');
  s = s.replace(/\r(?=[a-zA-Z])/g, '/r');
  s = s.replace(/(\.pilotdeck)\s+og([\w.-]+)/gi, '$1/rog$2');
  s = s.replace(/([/\\])\s+og([\w./\\-]+)/gi, '$1rog$2');
  s = s.replace(/([/\\])\s+(e(lease|ferences|sources|adme|po|port|sults))([\w./\\-]*)/gi, '$1r$2$4');
  return s;
}

export function repairCorruptedWindowsPath(filePath: string): string {
  let s = repairEatenBackslashRSegments(String(filePath || ''));
  s = s.replace(/Users\\?\r(?=ufen)/gi, 'Users/r');
  s = s.replace(/Users\/+\r(?=ufen)/gi, 'Users/r');
  s = s.replace(/Users\s+(?=ufen)/gi, 'Users/r');
  return s;
}

/** Reconstruct `C:/Users/...` when the drive letter was lost after `\r` corruption. */
export function inferAbsoluteFromProfileTail(filePath: string, projectRoot?: string): string {
  const normalized = String(filePath || '').replace(/\\/g, '/').trim();
  if (/^[A-Za-z]:\//.test(normalized)) {
    return normalized;
  }
  const profileTail = normalized.match(/^Users\/r?ufen\/(.+)$/i);
  if (!profileTail) {
    return normalized;
  }
  const root = String(projectRoot || '').replace(/\\/g, '/').trim();
  const driveMatch = root.match(/^([A-Za-z]:)\//);
  if (driveMatch) {
    return `${driveMatch[1]}/Users/rufen/${profileTail[1]}`;
  }
  return normalized;
}

export function normalizeArtifactPath(filePath: string, projectRoot?: string): string {
  return inferAbsoluteFromProfileTail(
    repairCorruptedWindowsPath(sanitizeDeliverableLookupPath(String(filePath || ''))),
    projectRoot,
  )
    .replace(/\\/g, '/')
    .trim();
}

export type ExpandDeliverablePathOptions = {
  hintDir?: string;
};

/** Agents often cite shortened paths; expand to the first likely artifacts location. */
export function expandAmbiguousDeliverablePath(
  filePath: string,
  options?: ExpandDeliverablePathOptions,
): string {
  const normalized = stripLeakedStoragePath(normalizeArtifactPath(filePath));
  if (!normalized) {
    return normalized;
  }
  const hintDir = options?.hintDir?.replace(/\\/g, '/').replace(/\/+$/, '');
  if (hintDir) {
    const compiled = compileDeliverableSlotPath(normalized, hintDir);
    if (compiled) {
      return compiled;
    }
  }
  if (normalized.includes('artifacts/')) {
    return normalized;
  }
  // Bare filenames like `keywords.md` are resolved on the server via artifacts search.
  if (isBareDeliverableFilename(normalized)) {
    if (hintDir) {
      const base = getArtifactFileName(normalized);
      return base ? `${hintDir}/${base}` : normalized;
    }
    return normalized;
  }
  const candidates = deliverablePathCandidates(normalized);
  if (/^ai-video-template(?:[-/]|$)/i.test(normalized)) {
    return normalized;
  }
  if (/^ai-[\w-]+\//i.test(normalized)) {
    const social = candidates.find((c) => c.startsWith('artifacts/social-matrix/'));
    if (social) {
      return social;
    }
  }
  if (isSlugDeliverablePath(normalized)) {
    const artifactCandidate = candidates.find((c) => c.startsWith('artifacts/'));
    if (artifactCandidate) {
      return artifactCandidate;
    }
  }
  return normalized;
}

export function getArtifactFileName(filePath: string): string {
  const normalized = normalizeArtifactPath(filePath);
  return normalized.split('/').pop() || normalized;
}

export function getArtifactDirectory(filePath: string): string {
  const normalized = normalizeArtifactPath(filePath);
  const index = normalized.lastIndexOf('/');
  return index > 0 ? normalized.slice(0, index) : '';
}

/**
 * Group key for folder-level grouping of deliverables: the immediate parent
 * directory of the file. Files that share the same key (and there are at least
 * two of them) are folded into a single folder card in the chat. Returns '' for
 * files at the project root or values without a directory segment.
 */
export function getDeliverableGroupKey(filePath: string): string {
  return getArtifactDirectory(normalizeArtifactPath(filePath));
}

export function isHtmlArtifactPath(filePath: string): boolean {
  return /\.html?$/i.test(normalizeArtifactPath(filePath));
}

export function isImageArtifactPath(filePath: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(normalizeArtifactPath(filePath));
}

export function isVideoArtifactPath(filePath: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv)$/i.test(normalizeArtifactPath(filePath));
}

export function isPdfArtifactPath(filePath: string): boolean {
  return /\.pdf$/i.test(normalizeArtifactPath(filePath));
}

export function classifyDeliverablePath(filePath: string): DeliverableKind {
  const normalized = normalizeArtifactPath(filePath);
  if (!normalized) return 'file';
  if (isHtmlArtifactPath(normalized)) return 'html';
  if (isImageArtifactPath(normalized)) return 'image';
  if (isVideoArtifactPath(normalized)) return 'video';
  if (isPdfArtifactPath(normalized)) return 'pdf';
  if (/\.(md|markdown|txt|docx?|rtf)$/i.test(normalized)) return 'document';
  if (/\.(csv|xlsx?|tsv)$/i.test(normalized)) return 'spreadsheet';
  if (/\.(pptx?)$/i.test(normalized)) return 'presentation';
  if (/\.(zip|tar|gz|7z|rar)$/i.test(normalized)) return 'archive';
  if (/\.jsonld$/i.test(normalized)) return 'document';
  if (/\.(jsonl?|ndjson|ya?ml|xml|tsx?|jsx?|py|css|scss|less|vue|svelte|php|rb|go|rs|java|kt|swift|sql|sh|bat|ps1|mjs|cjs)$/i.test(normalized)) {
    return 'code';
  }
  return 'file';
}

export function isLikelyDeliverablePath(value: string): boolean {
  const trimmed = sanitizeDeliverableLookupPath(String(value || '').trim());
  if (!trimmed || trimmed.includes('\n')) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  // PD-SAAS-FORK: skill reference URIs (diagram-maker:references:…) are not project files.
  if (isSkillResourceUri(trimmed)) return false;
  if (PILOTDECK_LINK_PATTERN.test(trimmed)) return true;
  WINDOWS_ABSOLUTE_PATH.lastIndex = 0;
  if (WINDOWS_ABSOLUTE_PATH.test(trimmed)) return true;
  UNIX_ABSOLUTE_PATH.lastIndex = 0;
  if (UNIX_ABSOLUTE_PATH.test(trimmed)) return true;
  if (new RegExp(String.raw`\.(?:${DELIVERABLE_EXTENSIONS})$`, 'i').test(trimmed)) {
    // Colon paths without a Windows drive letter are skill URIs, not deliverables.
    if (trimmed.includes(':') && !/^[A-Za-z]:[\\/]/.test(trimmed)) return false;
    return trimmed.includes('/') || trimmed.includes('\\') || trimmed.length <= 120;
  }
  return false;
}

export function parsePilotdeckLink(href: string): { action: 'open' | 'reveal' | 'preview'; path: string } | null {
  const match = PILOTDECK_LINK_PATTERN.exec(String(href || '').trim());
  if (!match) return null;
  const action = match[1].toLowerCase() as 'open' | 'reveal' | 'preview';
  const path = decodeURIComponent(normalizeArtifactPath(match[2] || ''));
  return path ? { action, path } : null;
}

/** Decode `/api/projects/:name/preview/...` or `files/content?path=...` into a project-relative path. */
export function parseProjectApiFileLink(
  href: string,
): { projectName: string; filePath: string } | null {
  const raw = String(href || '').trim();
  if (!raw) return null;

  let pathname = raw;
  let search = '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      pathname = url.pathname;
      search = url.search;
    } else {
      const q = raw.indexOf('?');
      if (q >= 0) {
        pathname = raw.slice(0, q);
        search = raw.slice(q);
      }
    }
  } catch {
    return null;
  }

  const previewMatch = pathname.match(/^\/api\/projects\/([^/]+)\/preview\/(.+)$/i);
  if (previewMatch) {
    const projectName = decodeURIComponent(previewMatch[1]);
    const filePath = previewMatch[2]
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join('/');
    return filePath ? { projectName, filePath: normalizeArtifactPath(filePath) } : null;
  }

  if (search) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const pathParam = params.get('path');
    const contentMatch = pathname.match(/^\/api\/projects\/([^/]+)\/files\/content$/i);
    if (contentMatch && pathParam) {
      const projectName = decodeURIComponent(contentMatch[1]);
      const filePath = normalizeArtifactPath(decodeURIComponent(pathParam));
      return filePath ? { projectName, filePath } : null;
    }
  }

  return null;
}

/** True when href would navigate the SPA (e.g. `/p/general`) instead of opening a file. */
export function isSpaAppHref(href: string): boolean {
  const raw = String(href || '').trim();
  if (!raw) return false;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      return /^\/(p|session)(\/|$)/.test(url.pathname);
    }
    return /^\/(p|session)(\/|$)/.test(raw);
  } catch {
    return false;
  }
}

/**
 * Normalize markdown `href` values into a project-relative deliverable path when possible.
 * Prevents relative `.md` links from being rendered as `<a href>` (which reloads the SPA).
 */
export function coerceDeliverablePathFromHref(href: string): string | null {
  const raw = String(href || '').trim();
  if (!raw || isSpaAppHref(raw)) return null;
  if (isSkillResourceUri(raw)) return null;

  const pilotdeck = parsePilotdeckLink(raw);
  if (pilotdeck?.path) {
    return expandAmbiguousDeliverablePath(normalizeArtifactPath(pilotdeck.path));
  }

  const projectApi = parseProjectApiFileLink(raw);
  if (projectApi?.filePath) {
    return expandAmbiguousDeliverablePath(normalizeArtifactPath(projectApi.filePath));
  }

  if (/^https?:\/\//i.test(raw)) {
    return null;
  }

  const sanitized = sanitizeDeliverableLookupPath(raw);
  if (isLikelyDeliverablePath(sanitized)) {
    return expandAmbiguousDeliverablePath(normalizeArtifactPath(sanitized));
  }

  const extracted = extractDeliverablePathsFromText(raw);
  if (extracted[0]) {
    return expandAmbiguousDeliverablePath(normalizeArtifactPath(extracted[0]));
  }

  return null;
}

/** Mask http(s) URLs so domain segments like `.gov.cn` are not parsed as `.go` deliverables. */
function maskUrlsForPathExtraction(source: string): string {
  return source.replace(URL_PATTERN, (url) => ' '.repeat(url.length));
}

function pushUniquePath(target: string[], seen: Set<string>, raw: string): void {
  const rawText = String(raw || '').trim();
  // PD-SAAS-FORK: `/foo.md` is usually a hallucinated workspace-root link in
  // chat output, not a project deliverable. Real Unix absolute paths have
  // another directory segment and are handled by WINDOWS/UNIX absolute patterns.
  if (/^\/[^/\\]+\.[a-z0-9]+(?:[?#].*)?$/i.test(rawText)) return;
  if (/^https?:\/\//i.test(rawText)) return;
  const sanitized = sanitizeDeliverableLookupPath(raw);
  if (!sanitized || sanitized.startsWith('[')) return;
  if (isSkillResourceUri(sanitized)) return;
  const normalized = expandAmbiguousDeliverablePath(
    normalizeArtifactPath(sanitized),
  );
  if (!normalized || seen.has(normalized.toLowerCase())) return;
  if (isNonUserDeliverablePath(normalized)) return;
  if (isThinkingTextPseudoPath(rawText) || isThinkingTextPseudoPath(normalized)) return;
  if (/^www\.go$/i.test(normalized) || /\.meta-tag\.go$/i.test(normalized)) return;
  if (!isLikelyDeliverablePath(normalized)) return;
  seen.add(normalized.toLowerCase());
  target.push(normalized);
}

function pushUniqueUrl(target: string[], seen: Set<string>, raw: string): void {
  const trimmed = String(raw || '').trim().replace(/[),.;:!?]+$/g, '');
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  target.push(trimmed);
}

export function extractDeliverablePathsFromText(text: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  const source = maskUrlsForPathExtraction(String(text || ''));

  MARKDOWN_LINK_PATH_PATTERN.lastIndex = 0;
  let markdownMatch: RegExpExecArray | null = MARKDOWN_LINK_PATH_PATTERN.exec(source);
  while (markdownMatch) {
    pushUniquePath(paths, seen, markdownMatch[2]);
    markdownMatch = MARKDOWN_LINK_PATH_PATTERN.exec(source);
  }

  for (const pattern of [SAVED_TO_PATTERN, WINDOWS_ABSOLUTE_PATH, UNIX_ABSOLUTE_PATH, FILE_PATH_WITH_EXT]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match) {
      pushUniquePath(paths, seen, match[1] || match[0]);
      match = pattern.exec(source);
    }
  }

  return paths;
}

export function extractExternalUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const source = String(text || '');
  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = URL_PATTERN.exec(source);
  while (match) {
    pushUniqueUrl(urls, seen, match[0]);
    match = URL_PATTERN.exec(source);
  }
  return urls;
}

function readToolResultFilePath(record: Record<string, unknown> | null): string {
  if (!record) return '';
  const written = record.writtenFilePath;
  if (typeof written === 'string' && written.trim()) {
    return normalizeArtifactPath(written);
  }
  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    const fromData = dataRecord.filePath ?? dataRecord.file_path ?? dataRecord.relativePath ?? dataRecord.outputPath;
    if (typeof fromData === 'string' && fromData.trim()) {
      return normalizeArtifactPath(fromData);
    }
  }
  const toolUseResult = record.toolUseResult;
  if (toolUseResult && typeof toolUseResult === 'object') {
    const tur = toolUseResult as Record<string, unknown>;
    const fromTur = tur.filePath ?? tur.file_path;
    if (typeof fromTur === 'string' && fromTur.trim()) {
      return normalizeArtifactPath(fromTur);
    }
    if (tur.data && typeof tur.data === 'object') {
      const turData = tur.data as Record<string, unknown>;
      const fromTurData = turData.filePath ?? turData.file_path ?? turData.relativePath;
      if (typeof fromTurData === 'string' && fromTurData.trim()) {
        return normalizeArtifactPath(fromTurData);
      }
    }
  }
  return '';
}

export function extractDeliverablePath(
  result: unknown,
  toolInput?: unknown,
): string {
  const record = result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
  const fromMeta = readToolResultFilePath(record);
  if (fromMeta) {
    return isNonUserDeliverablePath(fromMeta) ? '' : fromMeta;
  }

  const content = record?.content;
  if (typeof content === 'string' && content.trim()) {
    const fromText = extractDeliverablePathsFromText(content);
    if (fromText[0]) return fromText[0];
  }

  const inputRecord = toolInput && typeof toolInput === 'object' ? (toolInput as Record<string, unknown>) : null;
  const inputPath =
    inputRecord?.file_path
    ?? inputRecord?.filePath
    ?? inputRecord?.html_path
    ?? inputRecord?.htmlPath
    ?? inputRecord?.output_path
    ?? inputRecord?.outputPath;
  if (typeof inputPath === 'string' && inputPath.trim()) {
    const normalized = normalizeArtifactPath(inputPath);
    return isNonUserDeliverablePath(normalized) ? '' : normalized;
  }

  return '';
}

/** Strip SaaS cloud-storage prefix to workspace-relative paths for project APIs. */
function toWorkspaceRelativeApiPath(normalized: string): string | undefined {
  const workspaceRel = normalized.match(/cloud-storage\/users\/[^/]+\/workspaces\/[^/]+\/(.+)$/i);
  if (workspaceRel?.[1]) {
    return workspaceRel[1];
  }
  const artifactsIdx = normalized.toLowerCase().indexOf('/artifacts/');
  if (artifactsIdx >= 0) {
    return normalized.slice(artifactsIdx + 1);
  }
  return undefined;
}

export type ToProjectApiPathOptions = ExpandDeliverablePathOptions;

/** Path to pass to project APIs (preview / reveal / file tree), relative when possible. */
export function toProjectApiPath(
  filePath: string,
  projectRoot?: string,
  options?: ToProjectApiPathOptions,
): string {
  const normalized = stripLeakedStoragePath(normalizeArtifactPath(filePath, projectRoot));
  const root = normalizeArtifactPath(projectRoot || '', projectRoot).replace(/\/+$/, '');

  if (root) {
    const normLower = normalized.toLowerCase();
    const rootLower = root.toLowerCase();
    if (normLower === rootLower) {
      return '';
    }
    if (normLower.startsWith(`${rootLower}/`)) {
      return normalized.slice(root.length + 1);
    }
  }

  // PD-SAAS-FORK: absolute disk paths from the file tree must not be expanded into
  // artifacts/geo/* — strip to project-relative or basename first.
  if (/^[A-Za-z]:\//.test(normalized) || (normalized.startsWith('/') && !normalized.startsWith('//'))) {
    const stripped = stripLeakedStoragePath(normalized);
    const workspaceRelative = toWorkspaceRelativeApiPath(stripped);
    if (workspaceRelative) {
      return workspaceRelative;
    }
    if (!/^[A-Za-z]:\//.test(stripped) && !stripped.startsWith('/')) {
      return stripped;
    }
    const base = stripped.split('/').pop();
    if (base) {
      return base;
    }
  }

  const workspaceRelative = toWorkspaceRelativeApiPath(normalized);
  if (workspaceRelative) {
    return workspaceRelative;
  }

  // PD-SAAS-FORK: workspace folders like assets/pages/ must not be forced into artifacts/geo/*.
  // Preview URLs use project-relative paths; editor readFile must match.
  if (normalized.includes('/') && !isSlugDeliverablePath(normalized)) {
    return normalized;
  }

  return expandAmbiguousDeliverablePath(normalized, options);
}

/** Path for preview/reveal APIs (project-relative when the file is inside the project). */
export function resolveDeliverableApiPath(
  result: unknown,
  toolInput: unknown,
  projectRoot?: string,
  options?: ToProjectApiPathOptions,
): string {
  const record = result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
  const content = typeof record?.content === 'string' ? record.content : '';
  const fromContent = content ? extractDeliverablePath({ content }, undefined) : '';
  const fromMeta = extractDeliverablePath(result, toolInput);
  const raw = fromMeta || fromContent;
  return toProjectApiPath(raw, projectRoot, options);
}
