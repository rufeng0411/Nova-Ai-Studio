import { describe, expect, it, vi } from 'vitest';
import {
  handleComposerTextareaClick,
  handleComposerTextareaPointerDown,
  isLegacyEdgeUserAgent,
  shouldBlockComposerAuxClick,
} from './composerInputCompat';

describe('composerInputCompat', () => {
  it('detects EdgeHTML vs Chromium Edge', () => {
    expect(isLegacyEdgeUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 Edge/18.18363',
    )).toBe(true);
    expect(isLegacyEdgeUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    )).toBe(false);
  });

  it('blocks mouse back/forward auxiliary buttons', () => {
    expect(shouldBlockComposerAuxClick(0)).toBe(false);
    expect(shouldBlockComposerAuxClick(1)).toBe(false);
    expect(shouldBlockComposerAuxClick(3)).toBe(true);
    expect(shouldBlockComposerAuxClick(4)).toBe(true);
  });

  it('stops propagation and blocks aux clicks on pointer down', () => {
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    handleComposerTextareaPointerDown({ button: 3, stopPropagation, preventDefault });
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  it('delegates normal clicks after stopping propagation', () => {
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    const onClick = vi.fn();
    handleComposerTextareaClick(
      { button: 0, stopPropagation, preventDefault },
      onClick,
    );
    expect(stopPropagation).toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
  });
});
