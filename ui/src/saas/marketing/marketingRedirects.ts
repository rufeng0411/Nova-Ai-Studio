// PD-SAAS-FORK: unauth / post-login redirect helpers for marketing site

import { isMarketingSiteUiEnabled, sanitizeMarketingNext } from './sanitizeMarketingNext';

export type UnauthRedirectInput = {
  marketingEnabled?: boolean;
  isMobile: boolean;
  fromPath: string;
  search?: string;
};

export function resolveUnauthRedirect(input: UnauthRedirectInput): string {
  const enabled = input.marketingEnabled ?? isMarketingSiteUiEnabled();
  if (!enabled) {
    return input.isMobile ? '/m/login' : '/login';
  }
  // Marketing owns `/` as product home — land there (not /login). Preserve next for post-login.
  const next = sanitizeMarketingNext(input.fromPath + (input.search || ''))
    ?? sanitizeMarketingNext(input.fromPath);
  if (next) {
    return `/?next=${encodeURIComponent(next)}`;
  }
  return '/';
}

export type PostLoginPathInput = {
  marketingEnabled?: boolean;
  isMobile: boolean;
  nextRaw?: string | null;
};

export function resolvePostLoginPath(input: PostLoginPathInput): string {
  const safe = sanitizeMarketingNext(input.nextRaw);
  if (safe) return safe;
  if (input.isMobile) return '/m';
  // N2-COMMUNITY-OVERLAY: workbench is always /app (never SPA root)
  return '/app';
}
