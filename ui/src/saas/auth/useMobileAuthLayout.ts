/**
 * PD-SAAS-FORK: mobile login layout follows viewport width, not `/m` route alone.
 * `/m/login` on desktop keeps the side-by-side auth shell.
 */
import { useDeviceSettings } from '../../hooks/useDeviceSettings';

const AUTH_MOBILE_BREAKPOINT = 901;

export function useMobileAuthLayout(): boolean {
  const { isMobile } = useDeviceSettings({
    mobileBreakpoint: AUTH_MOBILE_BREAKPOINT,
    trackPWA: false,
  });
  return isMobile;
}
