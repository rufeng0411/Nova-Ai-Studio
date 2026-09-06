// PD-SAAS-FORK: one-line pointer from latest turn footer to session sticky summary bar.
import { ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';

type DeliverableTurnPointerProps = {
  done: number;
  total: number;
  onScrollToSummary?: () => void;
  className?: string;
  /** Historical turn snapshot — not the live session manifest. */
  historical?: boolean;
};

export default function DeliverableTurnPointer({
  done,
  total,
  onScrollToSummary,
  className,
  historical = false,
}: DeliverableTurnPointerProps) {
  const { t } = useTranslation('chat');

  const progressLabel = total > 0
    ? t('deliverables.sessionSummaryProgress', {
      defaultValue: '{{done}}/{{total}} 项成果',
      done: Math.min(done, total),
      total,
    })
    : t('deliverables.sessionSummaryEmpty', { defaultValue: '成果清单对齐中…' });

  return (
    <div
      className={cn(
        'deliverable-turn-pointer rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground',
        className,
      )}
      data-testid="deliverable-turn-pointer"
      data-historical={historical ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {historical ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {t('deliverables.historicalSummarySnapshot', { defaultValue: '非当前清单' })}
          </span>
        ) : null}
        <span>{progressLabel}</span>
        {!historical ? (
          <button
            type="button"
            onClick={onScrollToSummary}
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
            data-testid="deliverable-turn-pointer-link"
          >
            {t('deliverables.turnPointerToSessionBar', { defaultValue: '查看会话成果清单' })}
            <ChevronUp className="h-3 w-3" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
