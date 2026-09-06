/**
 * PD-SAAS-FORK: true when the viewport is below the mobile breakpoint.
 * Route prefix `/m` is kept in sync via `MobileBrowserRedirect` on resize.
 */
import { useDeviceSettings } from './useDeviceSettings';
import { MOBILE_SHELL_BREAKPOINT_PX } from '../mobile/mobileRoute';

export function useMobileShell(): boolean {
  const { isMobile } = useDeviceSettings({
    mobileBreakpoint: MOBILE_SHELL_BREAKPOINT_PX,
    trackPWA: false,
  });
  return isMobile;
}
