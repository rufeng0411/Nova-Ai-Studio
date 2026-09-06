/**
 * PD-SAAS-FORK: minimal cloud-sync indicator (animation only, no label).
 */
import { Cloud } from 'lucide-react';
import { cn } from '../../lib/utils.js';

type CloudSyncPulseProps = {
  className?: string;
};

export default function CloudSyncPulse({ className }: CloudSyncPulseProps) {
  return (
    <span
      className={cn('cloud-sync-pulse inline-flex shrink-0 items-center justify-center', className)}
      aria-hidden
    >
      <Cloud className="h-3 w-3 text-primary/80" strokeWidth={2} />
    </span>
  );
}
