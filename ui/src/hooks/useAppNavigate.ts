/**
 * PD-SAAS-FORK: navigation that keeps users inside `/m` when the viewport is mobile-width.
 * Also preserves `/app-1.1-beta` prefix when already inside the Beta workbench (no-op on /app).
 */
import { useCallback } from 'react';
import {
  type NavigateOptions,
  type To,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { resolveAppPath } from '../mobile/mobileRoute';
import { resolveNavigatePathPreservingBeta } from '../saas/workbench-beta/betaRoute';
import { useMobileShell } from './useMobileShell';

export function useAppNavigate() {
  const navigate = useNavigate();
  const mobileApp = useMobileShell();
  const location = useLocation();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        navigate(to);
        return;
      }
      if (typeof to === 'string') {
        navigate(
          resolveNavigatePathPreservingBeta(to, location.pathname, mobileApp),
          options,
        );
        return;
      }
      const next: To =
        typeof to === 'object' && to !== null && 'pathname' in to && typeof to.pathname === 'string'
          ? {
              ...to,
              pathname: resolveNavigatePathPreservingBeta(
                to.pathname,
                location.pathname,
                mobileApp,
              ),
            }
          : to;
      navigate(next, options);
    },
    [location.pathname, mobileApp, navigate],
  );
}
