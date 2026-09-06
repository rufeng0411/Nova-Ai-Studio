import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_BETA_PREFIX,
  isWorkbenchBetaPath,
  resolveBetaAppPath,
  resolveNavigatePathPreservingBeta,
  stripWorkbenchBetaPrefix,
  withWorkbenchBetaPrefix,
} from './betaRoute';

describe('betaRoute', () => {
  it('detects beta paths with and without /m', () => {
    expect(isWorkbenchBetaPath('/app-1.1-beta')).toBe(true);
    expect(isWorkbenchBetaPath('/app-1.1-beta/p/demo')).toBe(true);
    expect(isWorkbenchBetaPath('/m/app-1.1-beta/p/demo')).toBe(true);
    expect(isWorkbenchBetaPath('/app')).toBe(false);
    expect(isWorkbenchBetaPath('/p/general')).toBe(false);
    expect(isWorkbenchBetaPath('/m/p/general')).toBe(false);
  });

  it('strips and adds beta prefix', () => {
    expect(stripWorkbenchBetaPrefix('/app-1.1-beta')).toBe('/');
    expect(stripWorkbenchBetaPrefix('/app-1.1-beta/p/a/c/s')).toBe('/p/a/c/s');
    expect(stripWorkbenchBetaPrefix('/m/app-1.1-beta/p/a')).toBe('/p/a');
    expect(withWorkbenchBetaPrefix('/p/a')).toBe(`${WORKBENCH_BETA_PREFIX}/p/a`);
    expect(withWorkbenchBetaPrefix('/')).toBe(WORKBENCH_BETA_PREFIX);
  });

  it('resolves mobile beta paths', () => {
    expect(resolveBetaAppPath('/p/x', false)).toBe('/app-1.1-beta/p/x');
    expect(resolveBetaAppPath('/p/x', true)).toBe('/m/app-1.1-beta/p/x');
  });

  it('preserves beta when navigating from beta shell', () => {
    expect(
      resolveNavigatePathPreservingBeta('/p/foo', '/app-1.1-beta', false),
    ).toBe('/app-1.1-beta/p/foo');
    expect(
      resolveNavigatePathPreservingBeta('/p/foo', '/m/app-1.1-beta', true),
    ).toBe('/m/app-1.1-beta/p/foo');
    expect(
      resolveNavigatePathPreservingBeta('/p/foo', '/app', false),
    ).toBe('/p/foo');
  });
});
