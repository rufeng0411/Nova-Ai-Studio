// PD-SAAS-FORK: per-turn copy / token / credits footer (Beta surface only)

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTurnUsageFooterMode } from '../flags/workbenchBetaFlags';
import { emitBetaEvent } from '../telemetry/workbenchBetaTelemetry';
import { formatTokenCount } from './turnUsageFormat';

export type TurnUsageFooterProps = {
  content: string;
  tokens?: number | null;
  credits?: number | null;
  isLive?: boolean;
  sessionId?: string | null;
};

export default function TurnUsageFooter({
  content,
  tokens,
  credits,
  isLive,
  sessionId,
}: TurnUsageFooterProps) {
  const { t } = useTranslation('common');
  const mode = getTurnUsageFooterMode();
  const [copied, setCopied] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  if (mode === 'off') return null;

  const showUsage = !isLive && (tokens != null || credits != null);
  const tokenLabel = formatTokenCount(tokens ?? undefined);
  const previewSuffix = mode === 'shadow' ? ` (${t('workbenchBeta.turn.preview', '预览')})` : '';

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
    } catch {
      /* ignore */
    }
    setCopied(true);
    emitBetaEvent('beta_turn_footer_copy', { sessionId });
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="wb-beta-turn-footer"
      data-beta-turn-footer="1"
      data-testid="wb-beta-turn-footer"
    >
      <div className="wb-beta-turn-inner">
        <button
          type="button"
          className={`wb-beta-turn-act${copied ? ' is-copied' : ''}`}
          data-turn-act="copy"
          onClick={() => void onCopy()}
        >
          {copied
            ? t('workbenchBeta.toast.copied', '已复制')
            : t('workbenchBeta.turn.copy', '复制')}
        </button>
        {showUsage && tokenLabel ? (
          <button
            type="button"
            className="wb-beta-turn-act"
            data-turn-act="tokens"
            title={t('workbenchBeta.turn.tokensTip', '本对话累计模型用量（≠上下文窗口）') + previewSuffix}
            onClick={() => setTip(t('workbenchBeta.turn.tokensTip', '本对话累计模型用量（≠上下文窗口）') + previewSuffix)}
          >
            <span className="val">{tokenLabel}</span>
            <span className="lab">Token</span>
          </button>
        ) : null}
        {showUsage && credits != null ? (
          <button
            type="button"
            className="wb-beta-turn-act"
            data-turn-act="credits"
            title={t('workbenchBeta.turn.creditsTip', '本回合消耗积分（每完成一轮约 1 积分）') + previewSuffix}
            onClick={() => setTip(t('workbenchBeta.turn.creditsTip', '本回合消耗积分（每完成一轮约 1 积分）') + previewSuffix)}
          >
            <span className="val">{credits}</span>
            <span className="lab">{t('workbenchBeta.turn.credits', '积分')}</span>
          </button>
        ) : null}
      </div>
      {tip ? (
        <span className="wb-beta-turn-tip" role="status">
          {tip}
        </span>
      ) : null}
    </div>
  );
}
