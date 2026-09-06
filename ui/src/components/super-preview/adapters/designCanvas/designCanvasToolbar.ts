// PD-SAAS-FORK: shared toolbar button styles for design canvas (light/dark contrast)
import { cn } from '../../../../lib/utils';

export const designCanvasToolbarButtonClass = cn(
  'rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm',
  'hover:bg-muted hover:text-foreground',
  'disabled:pointer-events-none disabled:opacity-40',
);

export const designCanvasToolbarIconButtonClass = cn(
  'rounded-md border border-border bg-card p-1.5 text-foreground shadow-sm',
  'hover:bg-muted hover:text-foreground',
);

export function designCanvasToolbarButtonActiveClass(active: boolean): string {
  return cn(
    designCanvasToolbarButtonClass,
    active && 'border-primary/60 bg-primary/10 text-primary',
  );
}
