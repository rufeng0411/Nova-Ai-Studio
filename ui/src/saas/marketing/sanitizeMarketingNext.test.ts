import { describe, expect, it } from 'vitest';
import { sanitizeMarketingNext } from './sanitizeMarketingNext';

describe('sanitizeMarketingNext', () => {
  it('allows allowlisted relative paths', () => {
    expect(sanitizeMarketingNext('/app')).toBe('/app');
    expect(sanitizeMarketingNext('/app/foo')).toBe('/app/foo');
    expect(sanitizeMarketingNext('/p/general')).toBe('/p/general');
    expect(sanitizeMarketingNext('/m/chat')).toBe('/m/chat');
    expect(sanitizeMarketingNext('/admin')).toBe('/admin');
    expect(sanitizeMarketingNext('/m/admin/users')).toBe('/m/admin/users');
    expect(sanitizeMarketingNext('/app-1.1-beta')).toBe('/app-1.1-beta');
    expect(sanitizeMarketingNext('/app-1.1-beta/p/demo')).toBe('/app-1.1-beta/p/demo');
    expect(sanitizeMarketingNext('/m/app-1.1-beta/p/demo')).toBe('/m/app-1.1-beta/p/demo');
  });

  it('rejects open redirects', () => {
    expect(sanitizeMarketingNext('https://evil.com')).toBeNull();
    expect(sanitizeMarketingNext('//evil.com')).toBeNull();
    expect(sanitizeMarketingNext('/\\evil')).toBeNull();
    expect(sanitizeMarketingNext('javascript:alert(1)')).toBeNull();
    expect(sanitizeMarketingNext('/login')).toBeNull();
    expect(sanitizeMarketingNext('../etc/passwd')).toBeNull();
  });

  it('decodes and keeps query on allowlisted path', () => {
    expect(sanitizeMarketingNext('/app?tab=1')).toBe('/app?tab=1');
    expect(sanitizeMarketingNext('%2Fapp%2Fx')).toBe('/app/x');
  });
});
