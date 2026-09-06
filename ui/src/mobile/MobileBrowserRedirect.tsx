/**
 * PD-SAAS-FORK: keeps URL namespace in sync with viewport — narrow → `/m/*`,
 * wide → desktop paths (strip `/m`). Preserves path, query, and hash.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeviceSettings } from '../hooks/useDeviceSettings';
import {
  isMobileRoutePath,
  MOBILE_SHELL_BREAKPOINT_PX,
  stripMobileRoutePrefix,
  withMobileRoutePrefix,
} from './mobileRoute';

export default function MobileBrowserRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useDeviceSettings({
    mobileBreakpoint: MOBILE_SHELL_BREAKPOINT_PX,
    trackPWA: false,
  });

  useEffect(() => {
    const onMobileRoute = isMobileRoutePath(location.pathname);

    if (!isMobile && onMobileRoute) {
      const desktopPath = stripMobileRoutePrefix(location.pathname);
      const next = desktopPath + location.search + location.hash;
      if (next !== location.pathname + location.search + location.hash) {
        navigate(next, { replace: true });
      }
      return;
    }

    if (isMobile) {
      if (onMobileRoute) return;
      const next =
        withMobileRoutePrefix(location.pathname) + location.search + location.hash;
      if (next !== location.pathname + location.search + location.hash) {
        navigate(next, { replace: true });
      }
    }
  }, [isMobile, location.hash, location.pathname, location.search, navigate]);

  return null;
}
