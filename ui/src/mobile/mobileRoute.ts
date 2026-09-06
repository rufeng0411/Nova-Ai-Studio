/**
 * PD-SAAS-FORK: `/m` is the canonical mobile app entry. Desktop paths stay
 * unprefixed; phones auto-redirect into the `/m` namespace when narrow.
 */
export const MOBILE_ROUTE_PREFIX = '/m';

/** Viewport width at or above this uses the desktop shell (matches Tailwind `md`). */
export const MOBILE_SHELL_BREAKPOINT_PX = 768;

export function isMobileViewportWidth(width: number): boolean {
  return width < MOBILE_SHELL_BREAKPOINT_PX;
}

export function isMobileRoutePath(pathname: string): boolean {
  return pathname === MOBILE_ROUTE_PREFIX || pathname.startsWith(`${MOBILE_ROUTE_PREFIX}/`);
}

/** Strip the `/m` prefix so route matchers can use the same patterns as desktop. */
export function stripMobileRoutePrefix(pathname: string): string {
  if (!isMobileRoutePath(pathname)) return pathname;
  const rest = pathname.slice(MOBILE_ROUTE_PREFIX.length);
  return rest || '/';
}

/** Add `/m` when absent (idempotent). */
export function withMobileRoutePrefix(path: string): string {
  if (!path || path === '/') return MOBILE_ROUTE_PREFIX;
  if (isMobileRoutePath(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${MOBILE_ROUTE_PREFIX}${normalized}`;
}

/** Resolve a desktop-style path for the current app mode. */
export function resolveAppPath(path: string, useMobilePrefix: boolean): string {
  const canonical = stripMobileRoutePrefix(path);
  if (!useMobilePrefix) return canonical;
  return withMobileRoutePrefix(canonical);
}

/** Phone-class user agents (excludes iPad / desktop-mode tablets). */
export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}
