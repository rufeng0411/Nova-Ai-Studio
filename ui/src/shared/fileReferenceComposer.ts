// PD-SAAS-FORK: split legacy path-in-text references from composer prompt body

export function normalizeReferencePath(path: string): string {
  return path.replace(/\\/g, '/').trim();
}

const REFERENCE_FILE_EXT = /\.[a-z0-9]{1,8}$/i;
const KNOWN_REFERENCE_ROOT =
  /^(?:artifacts|assets|drafts|pages|cloud-storage|general|projects|skills|vendor|tests|docs|scripts|ui|src|config)(?:\/|$)/i;

function segmentLooksLikeProse(segment: string): boolean {
  if (/[；，。！？、：""''（）【】]/.test(segment)) return true;
  // Slash-separated Chinese alternatives (e.g. 生图/生视频或外部) — not file paths.
  if (/[或且与及]/.test(segment) && !REFERENCE_FILE_EXT.test(segment)) return true;
  return false;
}

function isValidReferencePathSegment(segment: string): boolean {
  if (!segment) return false;
  return !segmentLooksLikeProse(segment);
}

function uniqueReferencePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of paths) {
    const path = normalizeReferencePath(raw);
    if (!isValidReferencePath(path) || seen.has(path.toLowerCase())) continue;
    seen.add(path.toLowerCase());
    ordered.push(path);
  }
  return ordered;
}

export function isValidReferencePath(path: string): boolean {
  const normalized = normalizeReferencePath(path);
  if (!normalized || /\s/.test(normalized)) return false;
  if (normalized.includes('/')) {
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0 || !segments.every(isValidReferencePathSegment)) {
      return false;
    }
    const last = segments[segments.length - 1]!;
    if (REFERENCE_FILE_EXT.test(last)) return true;
    return KNOWN_REFERENCE_ROOT.test(normalized);
  }
  // Project-root files (e.g. index.html) — single segment with extension only.
  return REFERENCE_FILE_EXT.test(normalized) && /^[\w.\u3400-\u4dbf\u4e00-\u9fff-]+$/i.test(normalized);
}

/** If the user still has paths pasted into the textarea, peel them into chip paths. */
export function splitPromptAndLegacyReferencePaths(input: string): {
  prompt: string;
  paths: string[];
} {
  const raw = String(input || '');
  const trimmed = raw.trimStart();
  if (!trimmed) {
    return { prompt: raw, paths: [] };
  }

  const blankSplit = trimmed.split(/\n\n+/);
  if (blankSplit.length >= 2) {
    const headPaths = uniqueReferencePaths(
      blankSplit[0].split(/\s+/).map(normalizeReferencePath).filter(isValidReferencePath),
    );
    if (headPaths.length > 0) {
      return {
        prompt: blankSplit.slice(1).join('\n\n').trimStart(),
        paths: headPaths,
      };
    }
  }

  const tokens = trimmed.split(/\s+/);
  const tokenPaths = tokens.filter(isValidReferencePath);
  if (tokenPaths.length >= 2 && tokenPaths.length === tokens.length) {
    return { prompt: '', paths: tokenPaths };
  }

  return { prompt: raw, paths: [] };
}

export function buildReferenceIntentNote(paths: string[], language: string): string {
  if (paths.length === 0) {
    return '';
  }
  const lines = paths.map((path) => `- ${normalizeReferencePath(path)}`);
  if (language === 'zh-CN') {
    return `\n\n[用户已通过 @ 引用以下项目文件，请先 read_file 阅读再执行任务：]\n${lines.join('\n')}`;
  }
  return `\n\n[User referenced these project files via @ — read them before executing:]\n${lines.join('\n')}`;
}
