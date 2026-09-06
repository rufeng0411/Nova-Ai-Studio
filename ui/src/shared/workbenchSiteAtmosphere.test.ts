import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isWorkbenchSiteAtmosphereEnabled,
  setWorkbenchSiteAtmosphereEnabled,
} from './workbenchSiteAtmosphere';

describe('workbenchSiteAtmosphere', () => {
  const originalEnv = import.meta.env.VITE_WORKBENCH_SITE_ATMOSPHERE;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    delete import.meta.env.VITE_WORKBENCH_SITE_ATMOSPHERE;
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    if (originalEnv === undefined) {
      delete import.meta.env.VITE_WORKBENCH_SITE_ATMOSPHERE;
    } else {
      import.meta.env.VITE_WORKBENCH_SITE_ATMOSPHERE = originalEnv;
    }
  });

  it('defaults OFF when unset', () => {
    expect(isWorkbenchSiteAtmosphereEnabled()).toBe(false);
  });

  it('rolls back via localStorage 0', () => {
    setWorkbenchSiteAtmosphereEnabled(false);
    expect(isWorkbenchSiteAtmosphereEnabled()).toBe(false);
  });

  it('URL query overrides storage', () => {
    setWorkbenchSiteAtmosphereEnabled(false);
    window.history.replaceState({}, '', '/?siteAtmosphere=1');
    expect(isWorkbenchSiteAtmosphereEnabled()).toBe(true);
    window.history.replaceState({}, '', '/?siteAtmosphere=0');
    expect(isWorkbenchSiteAtmosphereEnabled()).toBe(false);
  });

  it('Vite env can force off when storage unset', () => {
    import.meta.env.VITE_WORKBENCH_SITE_ATMOSPHERE = '0';
    expect(isWorkbenchSiteAtmosphereEnabled()).toBe(false);
  });
});
