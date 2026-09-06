// PD-SAAS-FORK: actionable guidance when recovery budget is exhausted

import { useTranslation } from 'react-i18next';

type RecoveryGuidanceCardProps = {
  category?: string;
  rawDetail?: string;
  budgetRemaining?: number;
  onRetry?: () => void;
  onContinueAlternate?: () => void;
  className?: string;
};

export function RecoveryGuidanceCard({
  budgetRemaining = 0,
  onRetry,
  onContinueAlternate,
  className = '',
}: RecoveryGuidanceCardProps) {
  const { t } = useTranslation('chat');

  if (budgetRemaining > 0) return null;

  const hint = t('recovery.formalStop.hint', {
    defaultValue: '系统已尝试多种方式，仍未能自动完成本步。',
  });

  return (
    <div
      className={`rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed shadow-sm ${className}`.trim()}
      data-testid="recovery-guidance-card"
      role="status"
    >
      <p className="font-medium text-foreground/85">
        {t('recovery.formalStop.title', { defaultValue: '暂时未能自动完成' })}
      </p>
      <p className="mt-1 text-muted-foreground">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {onRetry ? (
          <button
            type="button"
            className="rounded-md bg-primary/90 px-2.5 py-1 text-[12px] font-medium text-primary-foreground hover:bg-primary"
            onClick={onRetry}
          >
            {t('recovery.formalStop.retry', { defaultValue: '换种方式继续' })}
          </button>
        ) : null}
        {onContinueAlternate ? (
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1 text-[12px] text-foreground/90 hover:bg-muted/40"
            onClick={onContinueAlternate}
          >
            {t('recovery.guidance.alternate', { defaultValue: '换个方式继续' })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default RecoveryGuidanceCard;
