import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { inferStaleTurnStepLabel, useStaleTurnWatchdog } from './useStaleTurnWatchdog';
import type { ChatMessage } from '../../chat/types/types';

describe('inferStaleTurnStepLabel', () => {
  it('returns last tool name from activities', () => {
    const activities = [{ toolName: 'grep' }] as ChatMessage[];
    expect(inferStaleTurnStepLabel(activities, [])).toBe('grep');
  });
});

describe('useStaleTurnWatchdog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onFallback after fallback threshold', () => {
    vi.useFakeTimers();
    const onFallback = vi.fn();
    const started = Date.now() - 200_000;
    const activities = [{ timestamp: new Date(started).toISOString(), toolName: 'bash' }] as ChatMessage[];

    renderHook(() => useStaleTurnWatchdog({
      isWorking: true,
      startedAtMs: started,
      activities,
      chatMessages: [],
      isConnected: true,
      onFallback,
    }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(onFallback).toHaveBeenCalledWith('bash');
  });

  it('does not fire onFallback when suppressFallback is true', () => {
    vi.useFakeTimers();
    const onFallback = vi.fn();
    const started = Date.now() - 200_000;
    const activities = [{ timestamp: new Date(started).toISOString(), toolName: 'bash' }] as ChatMessage[];

    renderHook(() => useStaleTurnWatchdog({
      isWorking: true,
      startedAtMs: started,
      activities,
      chatMessages: [],
      isConnected: true,
      suppressFallback: true,
      onFallback,
    }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(onFallback).not.toHaveBeenCalled();
  });
});
