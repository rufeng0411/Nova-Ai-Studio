// PD-SAAS-FORK: in-progress deliverables badge for composer chrome
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

type DeliverablesInProgressIconProps = {
  done: number;
  total: number;
  active?: boolean;
  className?: string;
};

export function DeliverablesInProgressIcon({
  done,
  total,
  active = false,
  className,
}: DeliverablesInProgressIconProps) {
  if (total <= 0) return null;

  const label = total > 0 ? `${Math.min(done, total)}/${total}` : '';

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[2rem] items-center justify-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
        className,
      )}
      aria-hidden
    >
      {active ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} />
      ) : null}
      {label}
    </span>
  );
}
