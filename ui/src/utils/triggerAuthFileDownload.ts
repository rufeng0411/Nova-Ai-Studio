// PD-SAAS-FORK: authenticated project file download (blob anchor + mobile fallback)
import { authenticatedFetch, api } from './api';

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function parseFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return fallback;
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;\s]+)/i.exec(header);
  if (plain?.[1]) return plain[1].replace(/"/g, '');
  return fallback;
}

/** iOS / iPadOS often ignores programmatic <a download> — open authenticated URL instead. */
function shouldUseWindowOpenFallback(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Defer revoke so Safari has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

export type TriggerAuthFileDownloadResult =
  | { ok: true; method: 'blob' | 'window' }
  | { ok: false; reason: string };

/**
 * Download a workspace file the user is allowed to read.
 * Prefers fetch+blob+anchor (Chrome/Firefox/Edge/desktop Safari); iOS opens a new tab with auth token.
 */
export async function triggerAuthFileDownload(
  projectName: string,
  filePath: string,
): Promise<TriggerAuthFileDownloadResult> {
  const url = api.fileDownloadUrl(projectName, filePath);
  const fallbackName = basename(filePath);

  if (shouldUseWindowOpenFallback()) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      return { ok: false, reason: 'popup_blocked' };
    }
    return { ok: true, method: 'window' };
  }

  try {
    const response = await authenticatedFetch(url);
    if (!response.ok) {
      return { ok: false, reason: `download_http_${response.status}` };
    }
    const blob = await response.blob();
    const filename = parseFilenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName);
    triggerBlobDownload(blob, filename);
    return { ok: true, method: 'blob' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'download_failed' };
  }
}
