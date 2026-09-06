// PD-SAAS-FORK: Hub 插件 chip — 我的收藏右侧，新窗外开 Markdown 浏览器
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import novaLogoMark from '../../saas/brand/novaLogoMark';
import { isMdBrowserToolEnabled, subscribeMdBrowserToolEnabled } from '../../shared/mdBrowserGate';
import { openMdBrowserWindow } from '../../shared/mdBrowserOpen';

type MdBrowserPluginChipProps = {
  className?: string;
  compact?: boolean;
  projectName?: string | null;
};

export default function MdBrowserPluginChip({
  className,
  compact,
  projectName,
}: MdBrowserPluginChipProps) {
  const { t } = useTranslation('templatesHub');
  const [enabled, setEnabled] = useState(() => isMdBrowserToolEnabled());

  useEffect(() => {
    setEnabled(isMdBrowserToolEnabled());
    return subscribeMdBrowserToolEnabled(() => setEnabled(isMdBrowserToolEnabled()));
  }, []);

  if (!enabled) return null;

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <div className="h-5 w-px shrink-0 bg-border/70" aria-hidden />
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/90 bg-card px-2.5 py-1.5',
          'text-xs font-medium text-foreground shadow-sm',
          'transition-colors hover:border-primary/40 hover:bg-muted/60',
          compact ? 'mobile-touch-target' : 'min-h-[32px]',
        )}
        title={t('mdBrowserPluginTitle', { defaultValue: '在新窗口打开 Markdown 浏览器' })}
        aria-label={t('mdBrowserPluginTitle', { defaultValue: '在新窗口打开 Markdown 浏览器' })}
        data-testid="md-browser-plugin-chip"
        onClick={() => {
          openMdBrowserWindow({ project: projectName ?? undefined });
        }}
      >
        <img
          src={novaLogoMark}
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 shrink-0 object-contain"
          draggable={false}
        />
        <span>{t('mdBrowserPluginLabel', { defaultValue: 'Markdown' })}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}
