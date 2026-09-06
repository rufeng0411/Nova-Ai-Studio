// PD-SAAS-FORK: simplified process template card — aligned with CapabilityHub style
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Fuse from 'fuse.js';
import { ArrowRight, Eye, EyeOff, Pin, Search, Star, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import {
  fetchProcessTemplates,
  getBundledProcessTemplates,
  type ProcessTemplate,
  type ProcessTemplateCategory,
  type ProcessTemplateComplexity,
} from '../../shared/processTemplates.js';
import {
  readCachedProcessTemplates,
  writeCachedProcessTemplates,
} from '../../shared/templatesHubCache.js';
import type { Project } from '../../types/app';
import { useMobileShell } from '../../hooks/useMobileShell';
import { useHubFavoritesOptional } from '../templates-hub/HubFavoritesContext.js';
import ProcessTemplateSearchHints from './ProcessTemplateSearchHints.js';
import HubExpandMoreToggle from '../capability-hub/HubExpandMoreToggle.js';
import { splitHubSectionItems } from '../../shared/hubPinnedSections.js';

function compactSearchText(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

function templateSearchBlob(item: ProcessTemplate): string {
  return compactSearchText(
    [
      item.title,
      item.outcome,
      item.scenario,
      item.outputs,
      ...(item.relatedSkills || []),
      ...(item.stageBadges || []),
      ...(item.geoStages || []),
      item.geoFlywheel ? 'geo' : '',
    ].join(' '),
  );
}

const COMPLEXITY_THEME: Record<
  ProcessTemplateComplexity,
  { badge: string; dot: string; stepDot: string }
> = {
  light: {
    badge: 'bg-teal-100/80 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
    dot: 'bg-teal-500',
    stepDot: 'bg-teal-400/70',
  },
  standard: {
    badge: 'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    dot: 'bg-indigo-500',
    stepDot: 'bg-indigo-400/70',
  },
  full: {
    badge: 'bg-violet-100/80 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    dot: 'bg-violet-500',
    stepDot: 'bg-violet-400/70',
  },
};

type ProcessTemplateGalleryProps = {
  selectedProject: Project | null;
  onTryTemplate: (prompt: string) => void;
  onClose?: () => void;
  embedded?: boolean;
  /** embedded 时布局：主菜单全页 3 列，弹层 2 列 */
  hubLayout?: 'page' | 'dialog';
};

type ProcessTemplateCardProps = {
  item: ProcessTemplate;
  disabled: boolean;
  onTry: (item: ProcessTemplate) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteAddLabel?: string;
  favoriteRemoveLabel?: string;
  featured?: boolean;
  featuredLabel?: string;
  hubVisible?: boolean;
  onToggleHubVisible?: () => void;
  hubVisibleLabel?: string;
  /** PD-SAAS-FORK: mobile shell — full-width readable card */
  mobileLayout?: boolean;
};

export function ProcessTemplateCard({
  item,
  disabled,
  onTry,
  isFavorite = false,
  onToggleFavorite,
  favoriteAddLabel,
  favoriteRemoveLabel,
  featured = false,
  featuredLabel,
  hubVisible = true,
  onToggleHubVisible,
  hubVisibleLabel,
  mobileLayout = false,
}: ProcessTemplateCardProps) {
  const { t } = useTranslation('processTemplates');
  const reduceMotion = useReducedMotion();
  const theme = COMPLEXITY_THEME[item.complexity];
  const favoriteLabel = isFavorite ? favoriteRemoveLabel : favoriteAddLabel;

  const handleActivate = () => {
    if (disabled || onToggleHubVisible) return;
    onTry(item);
  };

  const handleFavoriteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    onToggleFavorite?.();
  };

  const handleVisibilityClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    onToggleHubVisible?.();
  };

  return (
    <motion.article
      layout={reduceMotion ? false : 'position'}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? 'true' : 'false'}
      aria-label={item.title}
      title={disabled ? t('tryItNoProject') : undefined}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      className={cn(
        'group flex flex-col gap-2.5 rounded-[var(--radius)] border border-border/60 bg-card outline-none',
        mobileLayout
          ? 'mobile-template-card mobile-touch-target p-3.5'
          : 'min-h-[88px] p-3.5 max-md:active:border-primary/25',
        'transition-all duration-150 ease-out hover:border-primary/35 hover:shadow-sm',
        !hubVisible && onToggleHubVisible && 'opacity-50',
        disabled ? 'cursor-not-allowed opacity-80' : onToggleHubVisible ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      {/* 标题行 */}
      <div className={cn('flex gap-2', mobileLayout ? 'flex-col' : 'items-start')}>
        <div className="flex min-w-0 items-start gap-2">
          <span
            className={cn('relative mt-[3px] h-2 w-2 shrink-0 rounded-full', theme.dot)}
            aria-hidden
          >
            {featured ? (
              <span
                className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                title={featuredLabel}
                aria-label={featuredLabel}
              >
                <Pin className="h-2 w-2" strokeWidth={2.5} aria-hidden />
              </span>
            ) : null}
          </span>
          <h3
            className={cn(
              'min-w-0 flex-1 font-semibold tracking-tight text-foreground',
              mobileLayout
                ? 'text-[14px] leading-snug [overflow-wrap:anywhere]'
                : 'text-[13px] leading-snug',
            )}
          >
            {item.title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', theme.badge)}>
            {t(`complexity.${item.complexity}`)}
          </span>
          {onToggleHubVisible ? (
            <button
              type="button"
              onClick={handleVisibilityClick}
              aria-pressed={hubVisible ? 'true' : 'false'}
              aria-label={hubVisibleLabel}
              title={hubVisibleLabel}
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                hubVisible ? 'text-primary hover:text-primary' : 'text-muted-foreground/50 hover:text-foreground',
              )}
            >
              {hubVisible ? (
                <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </button>
          ) : onToggleFavorite ? (
            <button
              type="button"
              onClick={handleFavoriteClick}
              aria-pressed={isFavorite ? 'true' : 'false'}
              aria-label={favoriteLabel}
              title={favoriteLabel}
              className={cn(
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
                'hover:bg-muted hover:text-foreground',
                isFavorite && 'text-amber-500 hover:text-amber-600',
              )}
            >
              <Star
                className="h-3.5 w-3.5"
                strokeWidth={1.75}
                fill={isFavorite ? 'currentColor' : 'none'}
              />
            </button>
          ) : null}
        </div>
      </div>

      {/* 成果一句话 */}
      <p
        className={cn(
          'text-[12px] leading-relaxed text-muted-foreground',
          mobileLayout && 'line-clamp-3 [overflow-wrap:anywhere]',
        )}
      >
        {item.outcome}
      </p>

      {/* 步骤链路 */}
      <div
        className={cn(
          mobileLayout
            ? 'flex flex-col gap-1.5'
            : 'flex flex-wrap items-center gap-x-0.5 gap-y-1.5',
        )}
      >
        {item.flow.map((step, idx) => (
          <span
            key={step.step}
            className={cn(
              'flex items-center gap-1',
              mobileLayout && 'rounded-md bg-muted/50 px-2 py-1',
            )}
          >
            {!mobileLayout && idx > 0 ? (
              <ArrowRight
                className="mx-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground/35"
                strokeWidth={2}
                aria-hidden
              />
            ) : null}
            {mobileLayout ? (
              <span className="text-[10px] tabular-nums text-muted-foreground/70">{idx + 1}.</span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-foreground/75">
              <span className={cn('h-1 w-1 shrink-0 rounded-full', theme.stepDot)} aria-hidden />
              <span className={mobileLayout ? '[overflow-wrap:anywhere] leading-snug' : undefined}>
                {step.title}
              </span>
            </span>
          </span>
        ))}
      </div>

      {item.outputs ? (
        <p
          className={cn(
            'text-[10px] leading-relaxed text-muted-foreground/60',
            mobileLayout ? 'line-clamp-3 [overflow-wrap:anywhere]' : 'truncate',
          )}
          title={item.outputs}
        >
          {item.outputs}
        </p>
      ) : null}
    </motion.article>
  );
}

export default function ProcessTemplateGallery({
  selectedProject,
  onTryTemplate,
  onClose,
  embedded = false,
  hubLayout = 'dialog',
}: ProcessTemplateGalleryProps) {
  const { t, i18n } = useTranslation('processTemplates');
  const { t: th } = useTranslation('templatesHub');
  const hubFavorites = useHubFavoritesOptional();
  const isMobileShell = useMobileShell();
  const [templates, setTemplates] = useState<ProcessTemplate[]>(() => {
    const cached = readCachedProcessTemplates(i18n.language);
    if (cached?.length) return cached;
    return getBundledProcessTemplates(i18n.language).templates;
  });
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProcessTemplateCategory>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showMoreTemplates, setShowMoreTemplates] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimer = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  const handleSearchBlur = () => {
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => setSearchFocused(false), 140);
  };

  const handlePickKeyword = (keyword: string) => {
    setQuery(keyword);
    clearBlurTimer();
    searchInputRef.current?.focus();
  };

  useEffect(() => () => clearBlurTimer(), []);

  useEffect(() => {
    setShowMoreTemplates(false);
  }, [query, categoryFilter]);

  useEffect(() => {
    const cached = readCachedProcessTemplates(i18n.language);
    const bundled = getBundledProcessTemplates(i18n.language).templates;
    setTemplates(cached?.length ? cached : bundled);

    let cancelled = false;
    const refresh = async () => {
      try {
        const payload = await fetchProcessTemplates(i18n.language);
        if (cancelled) return;
        const next = payload.templates || bundled;
        setTemplates(next);
        writeCachedProcessTemplates(i18n.language, next);
      } catch {
        if (!cancelled) {
          setTemplates(bundled);
          writeCachedProcessTemplates(i18n.language, bundled);
        }
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const fuse = useMemo(() => {
    if (!templates.length) return null;
    return new Fuse(templates, {
      keys: [
        {
          name: 'searchBlob',
          weight: 1,
          getFn: (item) => templateSearchBlob(item as ProcessTemplate),
        },
      ],
      threshold: 0.35,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [templates]);

  const filtered = useMemo(() => {
    const trimmed = query.trim();
    // PD-SAAS-FORK: 有搜索词时跨全部类别检索；无搜索词才按当前类别筛选
    if (trimmed) {
      const compactQuery = compactSearchText(trimmed);
      const directMatches = templates.filter((item) =>
        templateSearchBlob(item).includes(compactQuery),
      );
      if (directMatches.length > 0) return directMatches;
      if (!fuse) return [];
      return fuse.search(trimmed).map((result) => result.item);
    }
    if (categoryFilter === 'all') return templates;
    return templates.filter((item) => (item.category || 'marketing') === categoryFilter);
  }, [templates, categoryFilter, query, fuse]);

  const bypassTemplateCollapse = Boolean(query.trim());
  const templateSplit = useMemo(
    () => splitHubSectionItems(filtered, { bypassCollapse: bypassTemplateCollapse }),
    [filtered, bypassTemplateCollapse],
  );
  const visibleTemplates =
    templateSplit.collapseActive && !showMoreTemplates
      ? templateSplit.pinned
      : filtered;

  const handleTry = (template: ProcessTemplate) => {
    if (!selectedProject || !template.prompt?.trim()) return;
    onTryTemplate(template.prompt.trim());
    onClose?.();
  };

  const renderTemplateCard = (item: ProcessTemplate) => (
    <ProcessTemplateCard
      key={item.id}
      item={item}
      disabled={!selectedProject}
      onTry={handleTry}
      isFavorite={hubFavorites?.isTemplateFavorite(item.id)}
      onToggleFavorite={
        hubFavorites ? () => hubFavorites.toggleTemplateFavorite(item.id) : undefined
      }
      favoriteAddLabel={th('favoriteAdd', { defaultValue: '加入我的收藏' })}
      favoriteRemoveLabel={th('favoriteRemove', { defaultValue: '从我的收藏移除' })}
      featured={Boolean(item.hub_pinned)}
      featuredLabel={t('hubPinnedBadge', { defaultValue: '必留模板' })}
      mobileLayout={isMobileShell}
    />
  );

  const categoryOptions: Array<'all' | ProcessTemplateCategory> = [
    'all',
    'marketing',
    'enterprise',
    'geo',
    'office',
    'creation',
  ];

  return (
    <div
      className={cn(
        'flex flex-col',
        embedded ? 'h-full min-h-0 bg-sidebar' : 'max-h-[min(85vh,720px)] w-full max-w-[960px]',
      )}
    >
      {!embedded ? (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('subtitle')}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label={t('close')}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 搜索 + 类别筛选（复杂度仅作卡片徽章） */}
      <div
        className={cn(
          'shrink-0 space-y-2 border-b border-border/60 py-3',
          isMobileShell ? 'px-3.5' : 'px-5 max-md:px-3',
        )}
      >
        <div ref={searchWrapRef} className="relative">
          <Search
            className={cn(
              'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground/70',
              isMobileShell ? 'left-3.5 h-4 w-4' : 'left-3 h-3.5 w-3.5',
            )}
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              clearBlurTimer();
              setSearchFocused(true);
            }}
            onBlur={handleSearchBlur}
            placeholder={t('searchPlaceholder')}
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            aria-expanded={searchFocused ? 'true' : 'false'}
            aria-controls="process-template-search-hints"
            className={cn(
              'w-full rounded-[var(--radius)] text-sm outline-none placeholder:text-muted-foreground focus:border-ring',
              isMobileShell
                ? 'mobile-hub-search min-h-[44px] border-none py-2.5 pl-10 pr-3.5'
                : 'rounded-lg border border-border bg-card py-1.5 pl-9 pr-3',
            )}
          />
          {searchFocused ? (
            <div
              id="process-template-search-hints"
              className={cn(
                'absolute left-0 right-0 z-20 mt-1.5 max-h-[min(42vh,320px)] overflow-y-auto',
              )}
              onMouseDown={(event) => event.preventDefault()}
            >
              <ProcessTemplateSearchHints query={query} onPickKeyword={handlePickKeyword} />
            </div>
          ) : null}
        </div>
        <div
          className="scrollbar-hide flex overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-0.5"
          role="tablist"
          aria-label={t('categoryFilterLabel', { defaultValue: '类别筛选' })}
        >
          {categoryOptions.map((option) => {
            const active = categoryFilter === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active ? 'true' : 'false'}
                title={t(`categoryHint.${option}`)}
                onClick={() => setCategoryFilter(option)}
                className={cn(
                  'relative flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg transition-colors duration-200',
                  'px-2.5 py-1.5',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="ptCategoryIndicator"
                    className="absolute inset-0 rounded-lg bg-card shadow-xs ring-1 ring-border"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden
                  />
                ) : null}
                <span className={cn('relative z-10 font-medium text-xs')}>
                  {t(`category.${option}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto py-4',
          isMobileShell ? 'px-3.5' : 'px-4 max-md:px-3',
          embedded && 'bg-muted/20',
        )}
      >
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templateSplit.collapseActive ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {t('hubPinnedCount', {
                    defaultValue: '推荐 {{pinned}} / 共 {{total}} 条',
                    pinned: templateSplit.pinned.length,
                    total: filtered.length,
                  })}
                </p>
                <HubExpandMoreToggle
                  expanded={showMoreTemplates}
                  count={templateSplit.secondary.length}
                  expandLabel={t('hubExpandMore', { defaultValue: '更多模板' })}
                  collapseLabel={t('hubCollapseMore', { defaultValue: '收起' })}
                  onToggle={() => setShowMoreTemplates((prev) => !prev)}
                />
              </div>
            ) : null}
            <div
              className={cn(
                'grid items-start gap-3',
                isMobileShell
                  ? 'grid-cols-1'
                  : embedded && hubLayout === 'page'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 lg:grid-cols-2',
              )}
            >
              {visibleTemplates.map((item) => renderTemplateCard(item))}
            </div>
            {templateSplit.collapseActive && showMoreTemplates && templateSplit.secondary.length > 0 ? (
              <div>
                <p className="mb-2 text-[11px] text-muted-foreground/75">
                  {t('hubSecondaryHint', { defaultValue: '补充模板' })}
                </p>
                <div
                  className={cn(
                    'grid items-start gap-3 opacity-[0.92]',
                    isMobileShell
                      ? 'grid-cols-1'
                      : embedded && hubLayout === 'page'
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        : 'grid-cols-1 lg:grid-cols-2',
                  )}
                >
                  {templateSplit.secondary.map((item) => renderTemplateCard(item))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
