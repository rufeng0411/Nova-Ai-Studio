import { describe, expect, it } from 'vitest';
import { resolvePostLoginPath, resolveUnauthRedirect } from './marketingRedirects';

describe('resolveUnauthRedirect', () => {
  it('flag off → login', () => {
    expect(resolveUnauthRedirect({
      marketingEnabled: false,
      isMobile: false,
      fromPath: '/app',
    })).toBe('/login');
    expect(resolveUnauthRedirect({
      marketingEnabled: false,
      isMobile: true,
      fromPath: '/m',
    })).toBe('/m/login');
  });

  it('flag on → marketing home with next (not /login)', () => {
    const url = resolveUnauthRedirect({
      marketingEnabled: true,
      isMobile: false,
      fromPath: '/app',
    });
    expect(url.startsWith('/?')).toBe(true);
    expect(url).toContain('next=');
    expect(url).not.toContain('login=1');
    expect(decodeURIComponent(url)).toContain('/app');
  });

  it('flag on bare path → marketing /', () => {
    expect(resolveUnauthRedirect({
      marketingEnabled: true,
      isMobile: false,
      fromPath: '/',
    })).toBe('/');
  });
});

describe('resolvePostLoginPath', () => {
  it('uses sanitized next', () => {
    expect(resolvePostLoginPath({
      marketingEnabled: true,
      isMobile: false,
      nextRaw: '/app/x',
    })).toBe('/app/x');
  });

  it('defaults to /app when marketing on', () => {
    expect(resolvePostLoginPath({
      marketingEnabled: true,
      isMobile: false,
      nextRaw: null,
    })).toBe('/app');
  });

  it('defaults to / when marketing off', () => {
    expect(resolvePostLoginPath({
      marketingEnabled: false,
      isMobile: false,
      nextRaw: null,
    })).toBe('/');
  });

  it('mobile defaults to /m', () => {
    expect(resolvePostLoginPath({
      marketingEnabled: true,
      isMobile: true,
      nextRaw: null,
    })).toBe('/m');
  });
});
