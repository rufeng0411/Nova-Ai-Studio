/**
 * PD-SAAS-FORK: Mobile bottom tab bar (V1 "Glass Dock" design).
 * Four primary destinations: chat / capability hub / files / me.
 */
import { useTranslation } from 'react-i18next';
import { Folder, MessageSquare, Sparkles, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils.js';

export type MobileTab = 'chat' | 'discover' | 'files' | 'me';

type TabDef = { id: MobileTab; labelKey: string; fallback: string; icon: LucideIcon };

const MOBILE_TABS: TabDef[] = [
  { id: 'chat', labelKey: 'tabs.chat', fallback: '对话', icon: MessageSquare },
  { id: 'discover', labelKey: 'tabs.discover', fallback: '能力', icon: Sparkles },
  { id: 'files', labelKey: 'tabs.files', fallback: '文件', icon: Folder },
  { id: 'me', labelKey: 'tabs.me', fallback: '我的', icon: UserRound },
];

type MobileTabBarProps = {
  active: MobileTab;
  onSelect: (tab: MobileTab) => void;
};

export default function MobileTabBar({ active, onSelect }: MobileTabBarProps) {
  const { t } = useTranslation();

  return (
    <nav
      className="mobile-tabbar flex shrink-0 border-t border-border"
      aria-label={t('tabsNavLabel', { defaultValue: '主导航' }) as string}
    >
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground active:bg-accent',
            )}
          >
            <Icon
              className={cn('h-[21px] w-[21px] transition-transform', isActive && '-translate-y-px')}
              strokeWidth={isActive ? 2 : 1.75}
            />
            <span className="text-[10px] font-medium leading-none">
              {t(tab.labelKey, { defaultValue: tab.fallback })}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
