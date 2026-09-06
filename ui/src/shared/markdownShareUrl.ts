// PD-SAAS-FORK: Markdown 公开分享 URL — /s/{shareId}（无 JWT）

export type MarkdownShareTarget = {
  projectName: string;
  apiPath: string;
  hintDir?: string;
  fileName: string;
  title?: string;
  seoIndexable?: boolean;
};

/** 公开分享链接：GET /s/:shareId → text/html（无 token） */
export function buildPublicShareUrl(
  shareId: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const id = encodeURIComponent(String(shareId || '').trim());
  return `${origin}/s/${id}`;
}

/** @deprecated 使用 create API + buildPublicShareUrl；保留仅作旧测试兼容 */
export function buildMarkdownShareHtmlUrl(
  input: MarkdownShareTarget & { shareId?: string },
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  if (input.shareId) {
    return buildPublicShareUrl(input.shareId, origin);
  }
  // Legacy path without shareId must not append JWT — return empty marker for callers to POST first.
  return '';
}

/** @deprecated */
export function buildMarkdownSharePageUrl(
  input: MarkdownShareTarget & { shareId?: string },
  origin?: string,
): string {
  return buildMarkdownShareHtmlUrl(input, origin);
}

export function parseMarkdownSharePageSearch(search: string): MarkdownShareTarget | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const projectName = params.get('project')?.trim() || '';
  const apiPath = params.get('path')?.trim() || '';
  if (!projectName || !apiPath) return null;
  const hintDir = params.get('hintDir')?.trim() || undefined;
  const title = params.get('title')?.trim() || undefined;
  const fileName = apiPath.split('/').filter(Boolean).pop() || 'document.md';
  return {
    projectName,
    apiPath,
    hintDir,
    fileName,
    title,
  };
}

export type PublicMdShareMode = 'off' | 'shadow' | 'enforce';

export function normalizePublicMdShareMode(raw: unknown): PublicMdShareMode {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on') return 'enforce';
  if (v === 'shadow') return 'shadow';
  return 'off';
}
