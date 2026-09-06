import { describe, expect, it, vi } from 'vitest';
import {
  beginPrimarySessionMessageLoad,
  bumpPrefetchGeneration,
  endPrimarySessionMessageLoad,
  getActivePrimarySessionId,
  getPrefetchGeneration,
  shouldAllowSidebarTailPrefetch,
} from './sessionMessagePrefetchGate';

describe('sessionMessagePrefetchGate', () => {
  it('blocks sidebar prefetch during primary session load', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false });
    vi.stubGlobal('window', { matchMedia } as unknown as Window);
    beginPrimarySessionMessageLoad('web:s_primary');
    expect(shouldAllowSidebarTailPrefetch()).toBe(false);
    expect(getActivePrimarySessionId()).toBe('web:s_primary');
    endPrimarySessionMessageLoad();
    expect(shouldAllowSidebarTailPrefetch()).toBe(true);
    expect(getActivePrimarySessionId()).toBeNull();
    vi.unstubAllGlobals();
  });

  it('bumps generation to invalidate in-flight prefetch', () => {
    const before = getPrefetchGeneration();
    expect(bumpPrefetchGeneration()).toBe(before + 1);
  });
});
