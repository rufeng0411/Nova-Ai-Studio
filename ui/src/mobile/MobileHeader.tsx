/**
 * PD-SAAS-FORK: Mobile top header (V1 "Glass Dock" design).
 * Persistent logo + drawer trigger + contextual title (left-aligned).
 */
import { Menu, Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils.js';
import novaLogoMark from '../saas/brand/novaLogoMark';

export type MobileHeaderHubSearchProps = {
  open: boolean;
  query: string;
  placeholder: string;
  onToggle: () => void;
  onQueryChange: (value: string) => void;
};

type MobileHeaderProps = {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  onNewSession?: () => void;
  hubSearch?: MobileHeaderHubSearchProps;
};

export default function MobileHeader({
  title,
  subtitle,
  onMenuClick,
  onNewSession,
  hubSearch,
}: MobileHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className={cn('mobile-header shrink-0 border-b border-border')}>
      <div className="flex items-center gap-1 px-2 pr-3.5">
        <div className="flex shrink-0 items-center">
          <div
            className="mobile-touch-target flex h-9 w-9 shrink-0 items-center justify-center"
            aria-hidden
          >
            <img
              src={novaLogoMark}
              alt=""
              className="mobile-header-logo h-[1.08rem] w-auto max-w-[1.68rem] select-none object-contain"
              draggable={false}
            />
          </div>
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={t('sidebar:tooltips.showSidebar', { defaultValue: '打开菜单' }) as string}
            className="mobile-touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground active:bg-accent"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight text-foreground">{title}</div>
          {subtitle ? (
            <div className="truncate text-[10px] leading-tight text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {hubSearch ? (
          <button
            type="button"
            onClick={hubSearch.onToggle}
            aria-label={hubSearch.open ? (t('common:buttons.close', { defaultValue: '关闭' }) as string) : hubSearch.placeholder}
            aria-expanded={hubSearch.open}
            className={cn(
              'mobile-touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] active:bg-accent',
              hubSearch.open ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {hubSearch.open ? (
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            ) : (
              <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
            )}
          </button>
        ) : onNewSession ? (
          <button
            type="button"
            onClick={onNewSession}
            aria-label={t('sidebar:newChat', { defaultValue: '新对话' }) as string}
            className="mobile-touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground active:bg-accent"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
      {hubSearch?.open ? (
        <div className="border-t border-border/60 px-3.5 py-2">
          <label className="mobile-hub-search flex min-h-[40px] w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <input
              type="search"
              value={hubSearch.query}
              onChange={(event) => hubSearch.onQueryChange(event.target.value)}
              placeholder={hubSearch.placeholder}
              autoComplete="off"
              inputMode="search"
              enterKeyHint="search"
              autoFocus
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      ) : null}
    </header>
  );
}
