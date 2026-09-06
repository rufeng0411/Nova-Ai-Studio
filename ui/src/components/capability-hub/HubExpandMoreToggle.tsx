// PD-SAAS-FORK: 能力/模板分组「更多」展开控件
import { ChevronDown, ChevronUp, Layers2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

type HubExpandMoreToggleProps = {
  expanded: boolean;
  count: number;
  expandLabel: string;
  collapseLabel: string;
  onToggle: () => void;
  className?: string;
};

export default function HubExpandMoreToggle({
  expanded,
  count,
  expandLabel,
  collapseLabel,
  onToggle,
  className,
}: HubExpandMoreToggleProps) {
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded ? 'true' : 'false'}
      title={expanded ? collapseLabel : expandLabel}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
        expanded
          ? 'border-primary/25 bg-primary/8 text-primary hover:bg-primary/12'
          : 'border-border/70 bg-muted/50 text-muted-foreground hover:border-primary/20 hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {expanded ? (
        <ChevronUp className="h-3 w-3" strokeWidth={2} aria-hidden />
      ) : (
        <Layers2 className="h-3 w-3" strokeWidth={1.75} aria-hidden />
      )}
      <span>{expanded ? collapseLabel : expandLabel}</span>
      {!expanded ? (
        <span className="tabular-nums text-muted-foreground/80">{count}</span>
      ) : null}
    </button>
  );
}
