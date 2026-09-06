import { describe, expect, it } from 'vitest';
import {
  isMobileRoutePath,
  isMobileViewportWidth,
  MOBILE_SHELL_BREAKPOINT_PX,
  resolveAppPath,
  stripMobileRoutePrefix,
  withMobileRoutePrefix,
} from './mobileRoute';

describe('mobileRoute', () => {
  it('detects mobile viewport below breakpoint', () => {
    expect(isMobileViewportWidth(MOBILE_SHELL_BREAKPOINT_PX - 1)).toBe(true);
    expect(isMobileViewportWidth(MOBILE_SHELL_BREAKPOINT_PX)).toBe(false);
  });

  it('strips and adds /m prefix', () => {
    expect(stripMobileRoutePrefix('/m/p/demo')).toBe('/p/demo');
    expect(withMobileRoutePrefix('/p/demo')).toBe('/m/p/demo');
  });

  it('resolveAppPath follows mobile flag not stale pathname', () => {
    expect(resolveAppPath('/p/demo', true)).toBe('/m/p/demo');
    expect(resolveAppPath('/m/p/demo', false)).toBe('/p/demo');
  });

  it('isMobileRoutePath matches /m namespace', () => {
    expect(isMobileRoutePath('/m')).toBe(true);
    expect(isMobileRoutePath('/m/p/x')).toBe(true);
    expect(isMobileRoutePath('/p/x')).toBe(false);
  });
});
