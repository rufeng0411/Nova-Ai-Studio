import { describe, expect, it } from 'vitest';
import { describePlatformFeaturesRequestError } from './platformFeatures';

describe('describePlatformFeaturesRequestError', () => {
  it('maps managed fetch-timeout to a Chinese admin message', () => {
    const message = describePlatformFeaturesRequestError(new Error('fetch-timeout'));
    expect(message).toContain('超时');
    expect(message).not.toContain('fetch-timeout');
  });

  it('maps AbortError to the same admin message', () => {
    const message = describePlatformFeaturesRequestError(new DOMException('aborted', 'AbortError'));
    expect(message).toContain('超时');
  });
});
