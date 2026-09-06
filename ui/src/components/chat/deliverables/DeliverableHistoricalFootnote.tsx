// PD-SAAS-FORK: muted one-line historical turn note when sticky session bar is authoritative.
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { INFORMAL_PROCESS } from '../../chat-v2/processVisualTokens';

type DeliverableHistoricalFootnoteProps = {
  done: number;
  total: number;
  className?: string;
};

export default function DeliverableHistoricalFootnote({
  done,
  total,
  className,
}: DeliverableHistoricalFootnoteProps) {
  const { t } = useTranslation('chat');
  const safeTotal = Math.max(total, 0);
  const safeDone = safeTotal > 0 ? Math.min(done, safeTotal) : Math.max(done, 0);
  const count = safeTotal > 0 ? safeTotal : safeDone;

  const label = count > 0
    ? t('deliverables.historicalTurnFootnote', {
      defaultValue: '本回合曾交付 {{count}} 项 · 以底部成果清单为准',
      count,
      done: safeDone,
      total: safeTotal,
    })
    : t('deliverables.historicalTurnFootnoteEmpty', {
      defaultValue: '本回合曾有成果记录 · 以底部成果清单为准',
    });

  return (
    <p
      className={cn('deliverable-historical-footnote', INFORMAL_PROCESS.deliverableHistoricalFootnote, className)}
      data-testid="deliverable-historical-footnote"
    >
      {label}
    </p>
  );
}
