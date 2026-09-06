import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { formatElapsedLabel, useElapsedSeconds } from './useElapsedSeconds';

describe('useElapsedSeconds', () => {
  it('increments while running', () => {
    vi.useFakeTimers();
    const started = Date.now() - 5000;
    const { result } = renderHook(() => useElapsedSeconds(started, true));
    expect(result.current).toBeGreaterThanOrEqual(5000);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBeGreaterThanOrEqual(7000);
    vi.useRealTimers();
  });
});

describe('formatElapsedLabel', () => {
  it('uses calm copy after 20s without alarming countdown phrasing', () => {
    expect(formatElapsedLabel(25)).toBe('仍在继续处理，请稍候');
    expect(formatElapsedLabel(19)).toBe('已用时 19s');
  });
});
