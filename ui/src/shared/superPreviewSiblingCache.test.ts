import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSuperPreviewSiblingCache,
  loadSuperPreviewSiblingsCached,
  readSuperPreviewSiblingCache,
  writeSuperPreviewSiblingCache,
} from './superPreviewSiblingCache';

describe('superPreviewSiblingCache', () => {
  afterEach(() => {
    clearSuperPreviewSiblingCache();
    vi.useRealTimers();
  });

  it('returns cached siblings within ttl', () => {
    writeSuperPreviewSiblingCache('general', 'artifacts/task-1/a.png', ['artifacts/task-1/a.png']);
    expect(readSuperPreviewSiblingCache('general', 'artifacts/task-1/a.png')).toEqual([
      'artifacts/task-1/a.png',
    ]);
  });

  it('dedupes concurrent loads for the same dir', async () => {
    const loader = vi.fn(async () => ['artifacts/deck/slide-01.png']);
    const [a, b] = await Promise.all([
      loadSuperPreviewSiblingsCached('general', 'artifacts/deck/slide-01.png', loader),
      loadSuperPreviewSiblingsCached('general', 'artifacts/deck/slide-01.png', loader),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it('expires stale entries', () => {
    vi.useFakeTimers();
    writeSuperPreviewSiblingCache('general', 'artifacts/task-2/b.md', ['artifacts/task-2/b.md']);
    vi.advanceTimersByTime(61_000);
    expect(readSuperPreviewSiblingCache('general', 'artifacts/task-2/b.md')).toBeNull();
  });
});
