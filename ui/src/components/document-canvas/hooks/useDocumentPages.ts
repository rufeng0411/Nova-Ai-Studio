// PD-SAAS-FORK: page navigation state for document canvas
import { useCallback, useEffect, useState } from 'react';

export function clampPageIndex(pageIndex: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.max(0, Math.min(pageCount - 1, pageIndex));
}

export type UseDocumentPagesOptions = {
  pageCount: number;
  initialPageIndex?: number;
  onPageChange?: (pageIndex: number) => void;
  enableKeyboard?: boolean;
};

export function useDocumentPages({
  pageCount,
  initialPageIndex = 0,
  onPageChange,
  enableKeyboard = true,
}: UseDocumentPagesOptions) {
  const [pageIndex, setPageIndex] = useState(() => clampPageIndex(initialPageIndex, pageCount));

  useEffect(() => {
    if (pageCount <= 0) {
      setPageIndex((prev) => (prev === 0 ? prev : 0));
      return;
    }
    setPageIndex((prev) => {
      const next = Math.min(prev, pageCount - 1);
      return prev === next ? prev : next;
    });
  }, [pageCount]);

  const goToPage = useCallback((nextIndex: number) => {
    if (pageCount <= 0) return;
    const clamped = clampPageIndex(nextIndex, pageCount);
    setPageIndex((prev) => (prev === clamped ? prev : clamped));
    onPageChange?.(clamped);
  }, [onPageChange, pageCount]);

  const goNext = useCallback(() => {
    goToPage(pageIndex >= pageCount - 1 ? pageCount - 1 : pageIndex + 1);
  }, [goToPage, pageCount, pageIndex]);

  const goPrev = useCallback(() => {
    goToPage(pageIndex <= 0 ? 0 : pageIndex - 1);
  }, [goToPage, pageIndex]);

  useEffect(() => {
    if (!enableKeyboard || pageCount <= 1) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.stopPropagation();
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.stopPropagation();
        event.preventDefault();
        goPrev();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enableKeyboard, goNext, goPrev, pageCount]);

  return {
    pageIndex,
    pageCount,
    goToPage,
    goNext,
    goPrev,
    canGoNext: pageIndex < pageCount - 1,
    canGoPrev: pageIndex > 0,
  };
}
