// PD-SAAS-FORK: /app-1.1-beta URL helpers (parallel workbench; zero impact on /app defaults)

import {
  isMobileRoutePath,
  resolveAppPath,
  stripMobileRoutePrefix,
  withMobileRoutePrefix,
} from '../../mobile/mobileRoute';

export const WORKBENCH_BETA_PREFIX = '/app-1.1-beta';

export function isWorkbenchBetaPath(pathname: string): boolean {
  const canonical = stripMobileRoutePrefix(pathname || '');
  return (
    canonical === WORKBENCH_BETA_PREFIX
    || canonical.startsWith(`${WORKBENCH_BETA_PREFIX}/`)
  );
}

/** Strip /m and /app-1.1-beta → desktop-style path (/ or /p/...). */
export function stripWorkbenchBetaPrefix(pathname: string): string {
  const canonical = stripMobileRoutePrefix(pathname || '');
  if (!isWorkbenchBetaPath(canonical)) return canonical || '/';
  const rest = canonical.slice(WORKBENCH_BETA_PREFIX.length);
  return rest || '/';
}

export function withWorkbenchBetaPrefix(desktopPath: string): string {
  const bare = stripWorkbenchBetaPrefix(
    desktopPath.startsWith('/') ? desktopPath : `/${desktopPath}`,
  );
  if (!bare || bare === '/') return WORKBENCH_BETA_PREFIX;
  return `${WORKBENCH_BETA_PREFIX}${bare.startsWith('/') ? bare : `/${bare}`}`;
}

/** Resolve beta-aware path for current mobile/desktop mode. */
export function resolveBetaAppPath(path: string, useMobilePrefix: boolean): string {
  const withBeta = withWorkbenchBetaPrefix(path);
  if (!useMobilePrefix) {
    return isMobileRoutePath(withBeta) ? stripMobileRoutePrefix(withBeta) : withBeta;
  }
  return withMobileRoutePrefix(stripMobileRoutePrefix(withBeta));
}

export function resolveNavigatePathPreservingBeta(
  to: string,
  currentPathname: string,
  useMobilePrefix: boolean,
): string {
  const onBeta = isWorkbenchBetaPath(currentPathname);
  const viaMobile = resolveAppPath(to, useMobilePrefix);
  if (!onBeta) return viaMobile;
  const bare = stripWorkbenchBetaPrefix(viaMobile);
  return resolveBetaAppPath(bare, useMobilePrefix);
}
