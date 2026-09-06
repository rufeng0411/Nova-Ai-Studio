// PD-SAAS-FORK: tldraw/Figma-style dot grid synced to pan/zoom viewport
type DesignCanvasGridProps = {
  viewport: { x: number; y: number; zoom: number };
  /** Page-space grid step (px at zoom 1). */
  gridSize?: number;
  dark?: boolean;
};

export default function DesignCanvasGrid({
  viewport,
  gridSize = 24,
  dark = true,
}: DesignCanvasGridProps) {
  const step = Math.max(8, gridSize * viewport.zoom);
  const majorStep = step * 10;
  const dot = dark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.22)';
  const major = dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
  const offsetX = ((viewport.x % majorStep) + majorStep) % majorStep;
  const offsetY = ((viewport.y % majorStep) + majorStep) % majorStep;
  const minorOffsetX = ((viewport.x % step) + step) % step;
  const minorOffsetY = ((viewport.y % step) + step) % step;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${major} 1px, transparent 1px),
            linear-gradient(to bottom, ${major} 1px, transparent 1px)
          `,
          backgroundSize: `${majorStep}px ${majorStep}px`,
          backgroundPosition: `${offsetX}px ${offsetY}px`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, ${dot} 1px, transparent 1px)`,
          backgroundSize: `${step}px ${step}px`,
          backgroundPosition: `${minorOffsetX}px ${minorOffsetY}px`,
        }}
      />
    </div>
  );
}
