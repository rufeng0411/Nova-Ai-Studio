// PD-SAAS-FORK: virtual window for Preflight card grid (max 24 DOM nodes)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const PREFLIGHT_MAX_VISIBLE_CARDS = 24;

export type PreflightVirtualWindow<T> = {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  onScroll: (scrollTop: number, clientHeight: number) => void;
  registerContainer: (el: HTMLElement | null) => void;
};

export function usePreflightVirtualWindow<T>(
  items: T[],
  rowHeight = 168,
  maxVisible = PREFLIGHT_MAX_VISIBLE_CARDS,
): PreflightVirtualWindow<T> {
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, maxVisible) });
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setRange({ start: 0, end: Math.min(items.length, maxVisible) });
  }, [items.length, maxVisible]);

  const onScroll = useCallback((scrollTop: number, clientHeight: number) => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) * 3);
    const visibleRows = Math.ceil(clientHeight / rowHeight) + 1;
    const count = Math.min(maxVisible, visibleRows * 3);
    const end = Math.min(items.length, start + count);
    setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [items.length, maxVisible, rowHeight]);

  const registerContainer = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
  }, []);

  const visibleItems = useMemo(
    () => items.slice(range.start, range.end),
    [items, range.end, range.start],
  );

  return {
    visibleItems,
    startIndex: range.start,
    endIndex: range.end,
    onScroll,
    registerContainer,
  };
}
