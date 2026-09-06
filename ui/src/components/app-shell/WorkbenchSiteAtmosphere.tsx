// PD-SAAS-FORK: marketing homepage atmosphere layers for workbench preview.
// Inline critical styles so glow/grid stay visible even if the CSS module order fights Tailwind.
import type { CSSProperties } from 'react';
import '../../saas/theme/workbenchSiteAtmosphere.css';

const layerBase: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

export default function WorkbenchSiteAtmosphere() {
  return (
    <div
      className="workbench-site-atmosphere"
      aria-hidden="true"
      data-testid="workbench-site-atmosphere"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Homepage --bg #0a0a0a */}
      <div
        className="workbench-site-atmosphere__base"
        style={{ ...layerBase, background: '#0a0a0a' }}
      />
      <div
        className="workbench-site-atmosphere__glow"
        style={{
          ...layerBase,
          background:
            'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(16, 163, 127, 0.28) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 85% 18%, rgba(99, 102, 241, 0.18) 0%, transparent 50%)',
        }}
      />
      <div
        className="workbench-site-atmosphere__grid"
        style={{
          ...layerBase,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          WebkitMaskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 75%, transparent 100%)',
          maskImage:
            'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 75%, transparent 100%)',
        }}
      />
    </div>
  );
}
