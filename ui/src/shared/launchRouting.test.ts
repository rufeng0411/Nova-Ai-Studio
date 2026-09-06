// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveLaunchModeForSlug, shouldOpenLaunchSheet } from './launchRouting';

describe('launchRouting registry authority', () => {
  it('open-design uses launch-registry visual even when catalog item says skip', () => {
    expect(resolveLaunchModeForSlug('open-design', 'skip')).toBe('visual');
    expect(resolveLaunchModeForSlug('ppt-master', 'skip')).toBe('visual');
  });

  it('opens preflight route for open-design visual', () => {
    const result = shouldOpenLaunchSheet({ slug: 'open-design', launchMode: 'skip' });
    expect(result.open).toBe(true);
    expect(result.mode).toBe('visual');
  });
});
