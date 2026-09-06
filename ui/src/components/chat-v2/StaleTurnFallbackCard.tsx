// PD-SAAS-FORK: user-visible notice when a turn stalls on file search / tools

import { useTranslation } from 'react-i18next';

type StaleTurnFallbackCardProps = {
  phase: 'warn' | 'fallback';
  stuckStepLabel?: string | null;
  elapsedSec?: number;
  className?: string;
};

export function StaleTurnFallbackCard({
  phase,
  stuckStepLabel,
  elapsedSec = 0,
  className = '',
}: StaleTurnFallbackCardProps) {
  const { t } = useTranslation('chat');

  const stepLine = stuckStepLabel
    ? t('staleTurn.stuckStep', {
        step: stuckStepLabel,
        defaultValue: `可能卡在：${stuckStepLabel}`,
      })
    : t('staleTurn.stuckStepUnknown', {
        defaultValue: '可能卡在资料检索或工具调用',
      });

  const body = phase === 'fallback'
    ? t('staleTurn.fallbackBody', {
        seconds: elapsedSec,
        defaultValue: `已等待 ${elapsedSec}s，系统将中止本步并换备选路径继续；若跳过检索或改用占位，结果可能略有偏差。`,
      })
    : t('staleTurn.warnBody', {
        seconds: elapsedSec,
        defaultValue: `本步已 ${elapsedSec}s 无新进展，若继续卡住将自动换备选方案。`,
      });

  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5 text-[13px] leading-relaxed shadow-sm ${className}`.trim()}
      data-testid="stale-turn-fallback-card"
      role="status"
    >
      <p className="font-medium text-foreground/90">
        {t('staleTurn.title', { defaultValue: '步骤耗时较长' })}
      </p>
      <p className="mt-1 text-muted-foreground">{stepLine}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}

export default StaleTurnFallbackCard;
