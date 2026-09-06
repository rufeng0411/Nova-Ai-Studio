// PD-SAAS-FORK: Cursor-like live process step viewport — smooth upward scroll, no hard slice
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { INFORMAL_PROCESS } from './processVisualTokens';

export type ProcessTimelineLiveViewportProps = {
  stepCount: number;
  /** Last step identity — re-scroll when running step title updates */
  scrollAnchorKey: string;
  maxVisibleRows?: number;
  children: ReactNode;
};

export function ProcessTimelineLiveViewport({
  stepCount,
  scrollAnchorKey,
  maxVisibleRows = INFORMAL_PROCESS.liveViewportMaxRows,
  children,
}: ProcessTimelineLiveViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const maxHeightPx = maxVisibleRows * INFORMAL_PROCESS.liveViewportRowPx;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = viewport.scrollHeight;
    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo({
        top,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
      return;
    }
    viewport.scrollTop = top;
  }, [stepCount, scrollAnchorKey, reduceMotion]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const syncFade = () => {
      setShowTopFade(viewport.scrollTop > 6);
    };

    syncFade();
    viewport.addEventListener('scroll', syncFade, { passive: true });
    return () => viewport.removeEventListener('scroll', syncFade);
  }, [stepCount]);

  return (
    <div className="relative" data-testid="process-timeline-live-viewport-wrap">
      {showTopFade ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-background/95 to-transparent"
        />
      ) : null}
      <div
        ref={viewportRef}
        data-testid="process-timeline-live-viewport"
        className="overflow-x-hidden overflow-y-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maxHeight: maxHeightPx }}
      >
        {children}
      </div>
    </div>
  );
}
