// PD-SAAS-FORK: shared capabilities + process-templates hub (dialog + main-menu discover tab)
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import CapabilityHub from '../main-content-v2/CapabilityHub.js';
import ProcessTemplateGallery from '../process-templates/ProcessTemplateGallery.js';
import { HubFavoritesProvider } from './HubFavoritesContext.js';
import HubFavoritesPanel from './HubFavoritesPanel.js';
import MdBrowserPluginChip from '../md-browser/MdBrowserPluginChip.js';
import { useMobileShell } from '../../hooks/useMobileShell';
import type { CapabilityBindingContext } from '../../shared/capabilityBinding.js';
import type { Project } from '../../types/app';

export type TemplatesHubTab = 'capabilities' | 'workflows' | 'favorites';

type TemplatesHubPanelProps = {
  variant: 'dialog' | 'page';
  selectedProject: Project | null;
  initialTab?: TemplatesHubTab;
  onTryPrompt: (prompt: string, capability?: CapabilityBindingContext) => void;
};

export default function TemplatesHubPanel({
  variant,
  selectedProject,
  initialTab = 'capabilities',
  onTryPrompt,
}: TemplatesHubPanelProps) {
  const { t } = useTranslation('templatesHub');
  const isMobileShell = useMobileShell();
  const [activeTab, setActiveTab] = useState<TemplatesHubTab>(initialTab);

  const tabs: Array<{ id: TemplatesHubTab; label: string; hint: string }> = useMemo(
    () => [
      { id: 'capabilities', label: t('tabCapabilities'), hint: t('capabilitiesHint') },
      { id: 'workflows', label: t('tabWorkflows'), hint: t('workflowsHint') },
      {
        id: 'favorites',
        label: t('tabFavorites', { defaultValue: '我的收藏' }),
        hint: t('favoritesHint', { defaultValue: '你标星的能力与全案模板，一键复用' }),
      },
    ],
    [t],
  );

  const activeHint = tabs.find((tab) => tab.id === activeTab)?.hint ?? '';
  const tabLayoutId = variant === 'page' ? 'discoverHubTabIndicator' : 'templatesHubTabIndicator';

  return (
    <HubFavoritesProvider>
      <div
        className={cn(
          'flex min-h-0 flex-col overflow-hidden',
          variant === 'dialog' ? 'flex-1' : 'h-full',
        )}
      >
        {variant === 'page' ? (
          <div
            className={cn(
              'shrink-0 border-b border-border/80',
              'px-4 py-3 max-md:px-3.5 md:px-6',
            )}
          >
            <p className="text-xs leading-relaxed text-muted-foreground">{t('subtitle')}</p>
          </div>
        ) : null}

        <div
          className={cn(
            'shrink-0 border-b border-border/60',
            variant === 'page' ? 'px-4 py-3 max-md:px-3.5 md:px-6' : 'px-5 py-3',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2',
              isMobileShell ? 'w-full min-w-0' : 'w-full sm:w-auto',
            )}
          >
            <div
              className={cn(
                'rounded-lg border border-border bg-muted/80 p-0.5',
                isMobileShell
                  ? 'scrollbar-hide flex min-w-0 flex-1 overflow-x-auto scroll-px-3.5 gap-0.5'
                  : 'inline-flex min-w-0 flex-1 sm:flex-none',
              )}
              role="tablist"
              aria-label={t('title')}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id ? 'true' : 'false'}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    isMobileShell
                      ? 'mobile-touch-target shrink-0 whitespace-nowrap px-3.5 text-[13px]'
                      : 'flex-1 max-md:min-h-[44px] max-md:py-2.5 sm:flex-none sm:min-w-[6.5rem]',
                    activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {activeTab === tab.id ? (
                    <motion.span
                      layoutId={tabLayoutId}
                      className="absolute inset-0 rounded-md bg-card shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
            <MdBrowserPluginChip
              compact={isMobileShell}
              projectName={selectedProject?.name ?? null}
            />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {activeHint}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className={cn('h-full', activeTab !== 'capabilities' && 'hidden')}>
            <CapabilityHub
              embedded
              selectedProject={selectedProject}
              onTryPrompt={onTryPrompt}
            />
          </div>
          <div className={cn('h-full', activeTab !== 'workflows' && 'hidden')}>
            <ProcessTemplateGallery
              embedded
              hubLayout={variant === 'page' ? 'page' : 'dialog'}
              selectedProject={selectedProject}
              onTryTemplate={(prompt) => onTryPrompt(prompt)}
            />
          </div>
          <div className={cn('h-full flex flex-col', activeTab !== 'favorites' && 'hidden')}>
            <HubFavoritesPanel
              variant={variant}
              selectedProject={selectedProject}
              onTryPrompt={onTryPrompt}
              onTryTemplate={(prompt) => onTryPrompt(prompt)}
            />
          </div>
        </div>
      </div>
    </HubFavoritesProvider>
  );
}
