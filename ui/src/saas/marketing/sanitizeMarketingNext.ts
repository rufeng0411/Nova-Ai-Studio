// PD-SAAS-FORK: open-redirect safe next= for marketing → login → app

// PD-SAAS-FORK: append-only allowlist — /app-1.1-beta parallel workbench
const ALLOWED_PREFIXES = ['/app', '/p/', '/m/', '/admin', '/m/admin', '/app-1.1-beta'] as const;

/**
 * Sanitize post-login / guard redirect target.
 * Only same-origin relative paths with allowlisted prefixes.
 */
export function sanitizeMarketingNext(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.includes('\\')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;
  if (value.includes('://')) return null;

  const pathOnly = value.split('?')[0].split('#')[0];
  const ok = ALLOWED_PREFIXES.some((prefix) => {
    if (prefix.endsWith('/')) return pathOnly.startsWith(prefix) || pathOnly === prefix.slice(0, -1);
    return pathOnly === prefix || pathOnly.startsWith(`${prefix}/`);
  });
  return ok ? value : null;
}

export function isMarketingSiteUiEnabled(): boolean {
  try {
    const fromRuntime = (window as unknown as { __PILOTDECK_MARKETING_SITE__?: string })
      .__PILOTDECK_MARKETING_SITE__;
    if (fromRuntime === '1' || fromRuntime === 'true') return true;
    if (fromRuntime === '0' || fromRuntime === 'false') return false;
  } catch {
    /* ignore */
  }
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const v = env?.VITE_PILOTDECK_MARKETING_SITE ?? env?.PILOTDECK_MARKETING_SITE;
  return v === '1' || v === 'true' || v === 'on';
}

/** Fetch public Bridge flag (no auth) and cache on window for unauth redirects. */
export async function hydrateMarketingSiteFlagFromBridge(): Promise<boolean> {
  try {
    const res = await fetch('/api/runtime/public-flags', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return isMarketingSiteUiEnabled();
    const data = (await res.json()) as { PILOTDECK_MARKETING_SITE?: boolean };
    const on = data.PILOTDECK_MARKETING_SITE === true;
    (window as unknown as { __PILOTDECK_MARKETING_SITE__?: string }).__PILOTDECK_MARKETING_SITE__ = on
      ? '1'
      : '0';
    return on;
  } catch {
    return isMarketingSiteUiEnabled();
  }
}
