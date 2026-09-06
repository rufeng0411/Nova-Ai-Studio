// PD-SAAS-FORK: favorites tab — starred capabilities + process templates
import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';
import { cn } from '../../lib/utils.js';
import CapabilityCard from '../capability-hub/CapabilityCard.js';
import {
  localizeCapabilityFields,
  resolveCapabilityTryPrompt,
} from '../../shared/capabilityLocale.js';
import { buildCapabilityBindingFromItem } from '../../shared/capabilityBinding.js';
import { appendCapabilityPrerequisiteHint } from '../../shared/capabilityPrerequisiteHint.js';
import { iconForCapability, themeForCapability } from '../../shared/capabilityHubTheme.js';
import {
  fetchProcessTemplates,
  getBundledProcessTemplates,
  type ProcessTemplate,
} from '../../shared/processTemplates.js';
import { getBundledCapabilitiesHub } from '../../shared/capabilitiesBundled.js';
import type { CapabilityBindingContext } from '../../shared/capabilityBinding.js';
import type { Project } from '../../types/app';
import { ProcessTemplateCard } from '../process-templates/ProcessTemplateGallery.js';
import { useHubFavorites } from './HubFavoritesContext.js';

type CapabilityRecord = {
  slug: string;
  name: string;
  display_name?: string;
  task_summary: string;
  description: string;
  status: 'available' | 'pending' | 'unavailable' | 'needs_config';
  major_category?: string;
  secondary_categories?: string[];
  [key: string]: unknown;
};

type HubFavoritesPanelProps = {
  variant: 'dialog' | 'page';
  selectedProject: Project | null;
  onTryPrompt: (prompt: string, capability?: CapabilityBindingContext) => void;
  onTryTemplate: (prompt: string) => void;
};

export default function HubFavoritesPanel({
  variant,
  selectedProject,
  onTryPrompt,
  onTryTemplate,
}: HubFavoritesPanelProps) {
  const { t } = useTranslation('templatesHub');
  const { t: tc } = useTranslation('capabilities');
  const { i18n } = useTranslation();
  const {
    ready,
    capabilitySlugs,
    templateIds,
    isCapabilityFavorite,
    isTemplateFavorite,
    toggleCapabilityFavorite,
    toggleTemplateFavorite,
  } = useHubFavorites();

  const [capabilities, setCapabilities] = useState<CapabilityRecord[]>(() => {
    return getBundledCapabilitiesHub(i18n.language).capabilities as CapabilityRecord[];
  });
  const [templates, setTemplates] = useState<ProcessTemplate[]>(() => {
    return getBundledProcessTemplates(i18n.language).templates;
  });

  const projectPath = selectedProject?.fullPath || selectedProject?.path || undefined;

  useEffect(() => {
    let cancelled = false;
    const loadCapabilities = async () => {
      try {
        const response = await api.capabilities({
          projectPath,
          locale: i18n.language,
        });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (Array.isArray(data?.capabilities)) {
          setCapabilities(data.capabilities as CapabilityRecord[]);
        }
      } catch {
        // bundled fallback already set
      }
    };
    void loadCapabilities();
    return () => {
      cancelled = true;
    };
  }, [i18n.language, projectPath]);

  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      try {
        const payload = await fetchProcessTemplates(i18n.language);
        if (!cancelled) {
          setTemplates(payload.templates);
        }
      } catch {
        if (!cancelled) {
          setTemplates(getBundledProcessTemplates(i18n.language).templates);
        }
      }
    };
    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const capabilityBySlug = useMemo(() => {
    const map = new Map<string, CapabilityRecord>();
    for (const item of capabilities) {
      map.set(item.slug, item);
    }
    return map;
  }, [capabilities]);

  const templateById = useMemo(() => {
    const map = new Map<string, ProcessTemplate>();
    for (const item of templates) {
      map.set(item.id, item);
    }
    return map;
  }, [templates]);

  const favoriteCapabilities = useMemo(
    () =>
      capabilitySlugs
        .map((slug) => capabilityBySlug.get(slug))
        .filter((item): item is CapabilityRecord => Boolean(item)),
    [capabilityBySlug, capabilitySlugs],
  );

  const favoriteTemplates = useMemo(
    () =>
      templateIds
        .map((id) => templateById.get(id))
        .filter((item): item is ProcessTemplate => Boolean(item)),
    [templateById, templateIds],
  );

  const totalCount = favoriteCapabilities.length + favoriteTemplates.length;
  const disabled = !selectedProject;

  const handleCapabilityUse = (item: CapabilityRecord) => {
    const localized = localizeCapabilityFields(item, i18n.language);
    const prompt = resolveCapabilityTryPrompt(item, i18n.language);
    if (!prompt) return;
    if (!selectedProject) {
      window.alert(tc('tryItNoProject'));
      return;
    }
    onTryPrompt(prompt, buildCapabilityBindingFromItem(item, localized.display_name));
  };

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
        {t('favoritesLoading', { defaultValue: '正在加载收藏…' })}
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <Star className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {t('favoritesEmptyTitle', { defaultValue: '还没有收藏' })}
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {t('favoritesEmptyHint', {
            defaultValue: '在「能力中心」或「全案模板」卡片右上角点星标，常用项会出现在这里。',
          })}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto pb-4 pt-3',
        variant === 'page' ? 'px-4 max-md:px-3 md:px-6' : 'px-5',
        'bg-muted/25',
      )}
    >
      {favoriteCapabilities.length > 0 ? (
        <section className="mb-5">
          <h2 className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
            {t('favoritesCapabilitiesSection', { defaultValue: '能力' })}
            <span className="ml-1.5 tabular-nums text-muted-foreground/50">
              {favoriteCapabilities.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {favoriteCapabilities.map((item) => {
              const localized = localizeCapabilityFields(item, i18n.language);
              const status =
                item.status === 'available' || item.status === 'needs_config' ? item.status : 'pending';
              const statusKey =
                status === 'available'
                  ? 'status.available'
                  : status === 'needs_config'
                    ? 'status.needs_config'
                    : 'status.pending';
              return (
                <CapabilityCard
                  key={item.slug}
                  icon={iconForCapability(item)}
                  theme={themeForCapability(item)}
                  title={localized.display_name}
                  description={appendCapabilityPrerequisiteHint(
                    item.description || item.task_summary,
                    item.slug,
                    i18n.language,
                  )}
                  statusLabel={tc(statusKey)}
                  status={status}
                  tryLabel={tc('tryIt')}
                  disabled={disabled}
                  disabledTitle={tc('tryItNoProject')}
                  isFavorite={isCapabilityFavorite(item.slug)}
                  onToggleFavorite={() => toggleCapabilityFavorite(item.slug)}
                  favoriteLabel={
                    isCapabilityFavorite(item.slug)
                      ? t('favoriteRemove', { defaultValue: '从我的收藏移除' })
                      : t('favoriteAdd', { defaultValue: '加入我的收藏' })
                  }
                  onUse={() => handleCapabilityUse(item)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {favoriteTemplates.length > 0 ? (
        <section>
          <h2 className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
            {t('favoritesWorkflowsSection', { defaultValue: '全案模板' })}
            <span className="ml-1.5 tabular-nums text-muted-foreground/50">
              {favoriteTemplates.length}
            </span>
          </h2>
          <div
            className={cn(
              'grid gap-2.5',
              variant === 'page' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
            {favoriteTemplates.map((item) => (
              <ProcessTemplateCard
                key={item.id}
                item={item}
                disabled={disabled}
                isFavorite={isTemplateFavorite(item.id)}
                onToggleFavorite={() => toggleTemplateFavorite(item.id)}
                favoriteAddLabel={t('favoriteAdd', { defaultValue: '加入我的收藏' })}
                favoriteRemoveLabel={t('favoriteRemove', { defaultValue: '从我的收藏移除' })}
                onTry={() => {
                  if (disabled) return;
                  onTryTemplate(item.prompt);
                }}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
