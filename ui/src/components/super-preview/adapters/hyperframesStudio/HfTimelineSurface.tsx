// PD-SAAS-FORK: lazy-loaded HyperFrames timeline (edit mode only)
import { useEffect, useRef } from 'react';

type HfTimelineSurfaceProps = {
  previewUrl: string;
};

export default function HfTimelineSurface({ previewUrl }: HfTimelineSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await import('@hyperframes/player');
        await import('@hyperframes/studio');
      } catch {
        // optional — preview iframe still works
      }
      if (cancelled || !hostRef.current) return;
      hostRef.current.dataset.previewUrl = previewUrl;
    })();
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  return (
    <div
      ref={hostRef}
      className="h-16 shrink-0 border-t border-border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground"
      data-testid="hf-studio-timeline"
    >
      Timeline
    </div>
  );
}
