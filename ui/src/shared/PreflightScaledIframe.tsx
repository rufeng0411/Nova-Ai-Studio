// PD-SAAS-FORK: Fit-to-container iframe preview for Preflight cards & detail panel
import { useEffect, useRef, useState } from 'react';

type PreflightScaledIframeProps = {
  src: string;
  title: string;
  variant: 'card' | 'detail';
  loading?: 'eager' | 'lazy';
};

const VARIANT_BASE = {
  card: { width: 1280, height: 800 },
  detail: { width: 1280, height: 720 },
} as const;

export function PreflightScaledIframe({
  src,
  title,
  variant,
  loading = 'lazy',
}: PreflightScaledIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const base = VARIANT_BASE[variant];

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const { clientWidth, clientHeight } = node;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      const fit = Math.min(clientWidth / base.width, clientHeight / base.height);
      setScale(Math.min(fit, variant === 'detail' ? 1 : 0.72));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [base.height, base.width, variant]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#0b0c10]">
      <iframe
        title={title}
        src={src}
        className="pointer-events-none absolute left-1/2 top-0 border-0"
        style={{
          width: base.width,
          height: base.height,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
        }}
        sandbox="allow-scripts allow-same-origin"
        loading={loading}
      />
    </div>
  );
}
