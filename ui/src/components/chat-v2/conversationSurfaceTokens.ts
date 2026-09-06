// PD-SAAS-FORK: Nova Surface System — A (control surface) + D (nav-glass) tokens for conversation UI
import { cn } from '../../lib/utils';

/** Base control surface — rounded-xl, muted tint, light border (A structure). */
export const SURFACE_CONTROL =
  'rounded-xl border border-border/45 bg-muted/20 transition-colors duration-150';

/** Glass overlay — nav-glass blur + card transparency (D material). */
export const SURFACE_GLASS =
  'bg-[hsl(var(--nav-glass-bg))] backdrop-blur-[var(--nav-glass-blur)] backdrop-saturate-[var(--nav-glass-saturate,1.4)]';

/** Control surface with progress tint (sticky bar, live strip when active). */
export const SURFACE_CONTROL_ACTIVE =
  'rounded-xl border border-success/22 bg-success/[0.05] transition-colors duration-150 hover:bg-success/[0.08]';

/** Control surface when all deliverables complete. */
export const SURFACE_CONTROL_COMPLETE =
  'rounded-xl border border-success/30 bg-success/[0.07] transition-colors duration-150';

/** Composer / user bubble: control + glass. */
export const SURFACE_COMPOSER = cn(
  SURFACE_CONTROL,
  SURFACE_GLASS,
  'border-border/30 shadow-none focus-within:border-ring/20 focus-within:shadow-[0_0_0_1px_hsl(var(--ring)/0.12)]',
);

export const SURFACE_USER_BUBBLE = cn(
  SURFACE_CONTROL,
  SURFACE_GLASS,
  'border-border/30 bg-card/55',
);

export const SURFACE_REFERENCES = cn(
  SURFACE_CONTROL,
  SURFACE_GLASS,
  'border-border/30 hover:border-border/45',
);

export const SURFACE_LIVE_STRIP = cn(
  SURFACE_CONTROL,
  SURFACE_GLASS,
  'border-border/30',
);

/** Unified conversation content width (align with sticky bar + composer).
 * PD-SAAS-FORK: 720 → 936 (+30%) for wider chat/composer column. */
export const CONTENT_WIDTH = 'mx-auto w-full max-w-[936px]';

export const TEXT_CONTROL = 'text-[12px] text-foreground/90';
export const TEXT_INFORMAL = 'text-[12px] text-muted-foreground/70';
export const TEXT_BODY = 'text-[14px] leading-[1.65] text-foreground/95';

/** Badge pulse class — defined in index.css as .deliverable-badge-pulse */
export const BADGE_PULSE_CLASS = 'deliverable-badge-pulse';
