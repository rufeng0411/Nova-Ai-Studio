// PD-SAAS-FORK: Markdown 公开分享 — POST 建链后复制/打开（禁 JWT）
import { copyTextToClipboard } from '../utils/clipboard';
import { authenticatedFetch } from '../utils/api';
import {
  buildPublicShareUrl,
  normalizePublicMdShareMode,
  type MarkdownShareTarget,
  type PublicMdShareMode,
} from './markdownShareUrl';

export type MarkdownShareOutcome =
  | 'shared'
  | 'opened'
  | 'copied'
  | 'cancelled'
  | 'disabled'
  | 'shadow'
  | 'error';

export type MarkdownShareResult = {
  outcome: MarkdownShareOutcome;
  url?: string;
  shareId?: string;
  mode?: PublicMdShareMode;
  error?: string;
};

function isMobileShareSurface(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

async function fetchPublicMdShareMode(): Promise<PublicMdShareMode> {
  try {
    const res = await fetch('/api/runtime/public-flags', { credentials: 'same-origin' });
    if (!res.ok) return 'off';
    const body = await res.json();
    return normalizePublicMdShareMode(body?.PILOTDECK_PUBLIC_MD_SHARE);
  } catch {
    return 'off';
  }
}

export async function createMarkdownShareLink(
  input: MarkdownShareTarget,
): Promise<{ shareId: string; url: string; mode: PublicMdShareMode }> {
  const res = await authenticatedFetch(
    `/api/projects/${encodeURIComponent(input.projectName)}/share/markdown`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: input.apiPath,
        hintDir: input.hintDir || undefined,
        seoIndexable: Boolean(input.seoIndexable),
      }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error || 'Failed to create share');
    throw err;
  }
  const shareId = String(body.shareId || '');
  const mode = normalizePublicMdShareMode(body.mode);
  const url = String(body.url || buildPublicShareUrl(shareId));
  if (!shareId || /[?&]token=/i.test(url)) {
    throw new Error('Invalid share url');
  }
  return { shareId, url, mode };
}

export async function revokeMarkdownShareLink(
  projectName: string,
  shareId: string,
): Promise<boolean> {
  const res = await authenticatedFetch(
    `/api/projects/${encodeURIComponent(projectName)}/share/markdown/${encodeURIComponent(shareId)}`,
    { method: 'DELETE' },
  );
  const body = await res.json().catch(() => ({}));
  return Boolean(res.ok && body?.ok);
}

export async function shareMarkdownDocument(input: MarkdownShareTarget): Promise<MarkdownShareResult> {
  const mode = await fetchPublicMdShareMode();
  if (mode === 'off') {
    return { outcome: 'disabled', mode };
  }

  try {
    const created = await createMarkdownShareLink(input);
    if (created.mode === 'shadow' || mode === 'shadow') {
      await copyTextToClipboard(created.url);
      return {
        outcome: 'shadow',
        url: created.url,
        shareId: created.shareId,
        mode: 'shadow',
      };
    }

    const url = created.url;
    const title = (input.title || input.fileName || '').trim();

    if (isMobileShareSurface() && canUseNativeShare()) {
      try {
        await navigator.share({
          title: title || undefined,
          text: title || undefined,
          url,
        });
        return { outcome: 'shared', url, shareId: created.shareId, mode: 'enforce' };
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return { outcome: 'cancelled', url, shareId: created.shareId, mode: 'enforce' };
        }
      }
    }

    const copied = await copyTextToClipboard(url);
    if (typeof window !== 'undefined') {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (opened) {
        return { outcome: 'opened', url, shareId: created.shareId, mode: 'enforce' };
      }
    }
    return {
      outcome: copied ? 'copied' : 'cancelled',
      url,
      shareId: created.shareId,
      mode: 'enforce',
    };
  } catch (error) {
    return {
      outcome: 'error',
      mode,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
