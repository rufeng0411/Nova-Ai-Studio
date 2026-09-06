
import {
 Briefcase,
 Code2,
 GraduationCap,
 Megaphone,
 Palette,
 Brain,
 Radar,
 Radio,
 Landmark,
 Scale,
 Eye,
 EyeOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import {
  EDUCATION_BAND_ORDER,
 EDUCATION_STAGE_ID,
 GEO_FLYWHEEL_ORDER,
 MARKETING_FLYWHEEL_ORDER,
 MEDIA_LANE_ORDER,
 defaultStageForCategory,
 stageToCategory,
  type HubMajorCategory,
} from '../../shared/capabilityHubTheme.js';
import {
 HUB_MAJOR_CATEGORY_ORDER,
 defaultStageForMajorCategory,
 defaultMediaLaneForMajorCategory,
 getHubMajorCategoryOrder,
 getMajorCategoriesMeta,
 getMediaLanes,
 getMediaWorkflowSteps,
 majorCategoryFromStage,
 type MajorCategorySubtag,
 type TaskGroupMeta,
} from '../../shared/capabilityHubTaxonomy.js';

export type HubStageOption = {
 id: string;
 label: string;
 stage_order: number;
 summary?: string;
 count?: number;
};

type CapabilityHubCategoryNavProps = {
 activeStage: string;
 onStageChange: (stageId: string) => void;
 flywheelStages: HubStageOption[];
 /** PD-SAAS-FORK: GEO 六段 L2 */
 geoFlywheelStages?: HubStageOption[];
 educationStage: HubStageOption | null;
 educationBands?: HubStageOption[];
 activeEducationBand?: string | 'all';
 onEducationBandChange?: (bandId: string | 'all') => void;
 /** PD-SAAS-FORK: 顶层五 Tab */
 activeMajorCategory?: HubMajorCategory;
 onMajorCategoryChange?: (category: HubMajorCategory) => void;
 majorCategoryCounts?: Partial<Record<HubMajorCategory, number>>;
 /** 飞轮第三层任务子类 */
 taskGroups?: TaskGroupMeta[];
 activeTaskGroup?: string | 'all';
 onTaskGroupChange?: (groupId: string | 'all') => void;
 taskGroupCounts?: Record<string, number>;
 /** 办公/创作/开发/脑爆子类 */
 categorySubtags?: MajorCategorySubtag[];
 categorySubtagCounts?: Record<string, number>;
 activeCategorySubtag?: string | 'all';
 onCategorySubtagChange?: (subtagId: string | 'all') => void;
 /** full：全页能力中心；compact：模板弹层（仅营销+教育） */
 variant?: 'full' | 'compact';
 /** PD-SAAS-FORK: mobile shell uses seg/stage/pill layout from V1 sketch */
 layout?: 'desktop' | 'mobile' | 'sidebar';
 showExtendedCategories?: boolean;
 allowAllInCategory?: boolean;
 activeStageFilter?: string | 'all';
 onStageFilterChange?: (stageId: string | 'all') => void;
 activeEducationBandFilter?: string | 'all';
 onEducationBandFilterChange?: (bandId: string | 'all') => void;
 /** PD-SAAS-FORK: 后台可见性 — 一级/子类前台可见开关 */
 visibilityAdmin?: {
  isCategoryVisible: (categoryId: HubMajorCategory) => boolean;
  onToggleCategory: (categoryId: HubMajorCategory) => void;
  isSubcategoryVisible: (key: string) => boolean;
  onToggleSubcategory: (key: string) => void;
  subcategoryKeyForOption: (optionId: string) => string | null;
 };
 /** PD-SAAS-FORK: 前台 Hub — 按可见性配置隐藏 Tab/子类 Pill（无开关） */
 hubVisibilityFilter?: {
  isCategoryVisible: (categoryId: HubMajorCategory) => boolean;
  isSubcategoryVisible: (key: string) => boolean;
  subcategoryKeyForOption: (optionId: string) => string | null;
 };
};

const MAJOR_CATEGORY_ICONS = {
 marketing: Megaphone,
 media: Radio,
 geo: Radar,
 finance: Landmark,
 enterprise_compliance: Scale,
 office: Briefcase,
 creation: Palette,
 development: Code2,
 brainstorming: Brain,
 education: GraduationCap,
} as const;

function marketingTotal(stages: HubStageOption[]) {
 return stages.reduce((sum, stage) => sum + (stage.count ?? 0), 0);
}

function bandLabel(t: (key: string, opts?: { defaultValue?: string }) => string, band: HubStageOption) {
 return t(`educationBands.${band.id}.label`, { defaultValue: band.label });
}

function bandSummary(t: (key: string, opts?: { defaultValue?: string }) => string, band: HubStageOption) {
 return t(`educationBands.${band.id}.summary`, { defaultValue: band.summary || '' });
}

export default function CapabilityHubCategoryNav({
 activeStage,
 onStageChange,
 flywheelStages,
 geoFlywheelStages = [],
 educationStage,
 educationBands = [],
 activeEducationBand = 'all',
 onEducationBandChange,
 activeMajorCategory: activeMajorCategoryProp,
 onMajorCategoryChange,
 majorCategoryCounts = {},
 taskGroups = [],
 activeTaskGroup = 'all',
 onTaskGroupChange,
 taskGroupCounts = {},
 categorySubtags = [],
 categorySubtagCounts = {},
 activeCategorySubtag = 'all',
 onCategorySubtagChange,
 variant = 'full',
 layout = 'desktop',
 showExtendedCategories = variant === 'full',
 allowAllInCategory = false,
 activeStageFilter,
 onStageFilterChange,
 activeEducationBandFilter,
 onEducationBandFilterChange,
 visibilityAdmin,
 hubVisibilityFilter,
}: CapabilityHubCategoryNavProps) {
 const { t } = useTranslation('capabilities');
 const isCompact = variant === 'compact';
 const isMobileLayout = layout === 'mobile';
 const isSidebarLayout = layout === 'sidebar';
 const majorCategoriesMeta = getMajorCategoriesMeta();

 const resolvedMajorCategory =
 activeMajorCategoryProp ?? (showExtendedCategories ? majorCategoryFromStage(activeStage) : stageToCategory(activeStage));

 const marketingCount = majorCategoryCounts.marketing ?? marketingTotal(flywheelStages);
 const educationCount = majorCategoryCounts.education ?? educationStage?.count ?? 0;
 const showEducation = (majorCategoryCounts.education ?? educationCount) > 0;

 const majorCategoryOrder = getHubMajorCategoryOrder({ forAdmin: Boolean(visibilityAdmin) });

 const visibleMajorCategories = showExtendedCategories
 ? majorCategoryOrder.filter((id) => {
 if (hubVisibilityFilter && !hubVisibilityFilter.isCategoryVisible(id)) return false;
 if (id === 'education') return showEducation;
 return true;
 })
 : (['marketing', ...(showEducation ? (['education'] as const) : [])] as HubMajorCategory[]);

 const subFilter = allowAllInCategory ? activeStageFilter ?? activeStage : activeStage;
 const educationSubFilter = allowAllInCategory
 ? activeEducationBandFilter ?? activeEducationBand
 : activeEducationBand;

 const orderedEducationBands = EDUCATION_BAND_ORDER.map((id) =>
 educationBands.find((band) => band.id === id),
 ).filter(Boolean) as HubStageOption[];

 const switchMajorCategory = (category: HubMajorCategory) => {
 onMajorCategoryChange?.(category);
 const nextStage = showExtendedCategories
 ? defaultStageForMajorCategory(category)
 : defaultStageForCategory(category === 'education' ? 'education' : 'marketing');
 onStageChange(nextStage);
  if (category === 'education') {
    onEducationBandChange?.('all');
    onEducationBandFilterChange?.('all');
 onTaskGroupChange?.('all');
 onCategorySubtagChange?.('all');
 } else if (category === 'marketing') {
 onTaskGroupChange?.('all');
 onCategorySubtagChange?.('all');
 if (allowAllInCategory && onStageFilterChange) {
 onStageFilterChange(category === 'marketing' ? 'all' : nextStage);
 }
 } else if (category === 'geo') {
 onTaskGroupChange?.('all');
 onCategorySubtagChange?.('all');
 } else if (category === 'media') {
 onTaskGroupChange?.(defaultMediaLaneForMajorCategory());
 onStageChange('all');
 onCategorySubtagChange?.('all');
 } else {
 onTaskGroupChange?.('all');
 onCategorySubtagChange?.('all');
 if (category === 'brainstorming') {
 onStageChange('brainstorming');
 }
 }
 };

 const selectMarketingStage = (stageId: string) => {
 onMajorCategoryChange?.('marketing');
 onStageChange(stageId);
 onTaskGroupChange?.('all');
 if (allowAllInCategory && onStageFilterChange) {
 onStageFilterChange(stageId);
 }
 };

 const selectGeoStage = (stageId: string) => {
 onMajorCategoryChange?.('geo');
 onStageChange(stageId);
 onTaskGroupChange?.('all');
 onCategorySubtagChange?.('all');
 };

 const selectMediaLane = (laneId: string) => {
 onMajorCategoryChange?.('media');
 onTaskGroupChange?.(laneId);
 onStageChange('all');
 onCategorySubtagChange?.('all');
 };

 const selectMediaStep = (stepId: string) => {
 onMajorCategoryChange?.('media');
 onStageChange(stepId);
 };

 const mediaLaneActive = (laneId: string) =>
 resolvedMajorCategory === 'media' && (activeTaskGroup === laneId || (activeTaskGroup === 'all' && laneId === MEDIA_LANE_ORDER[0]));

 const mediaLanes = getMediaLanes();
 const mediaWorkflowSteps = getMediaWorkflowSteps(
   resolvedMajorCategory === 'media' && activeTaskGroup !== 'all'
     ? activeTaskGroup
     : defaultMediaLaneForMajorCategory(),
 );

 const geoSubActive = (stageId: string) =>
 resolvedMajorCategory === 'geo' && activeStage === stageId;

 const selectEducationBand = (bandId: string) => {
 onMajorCategoryChange?.('education');
 onEducationBandChange?.(bandId);
 onEducationBandFilterChange?.(bandId);
 onStageChange(EDUCATION_STAGE_ID);
 if (allowAllInCategory && onStageFilterChange) {
 onStageFilterChange(EDUCATION_STAGE_ID);
 }
 };

 const selectAllInMarketing = () => {
 if (!allowAllInCategory || !onStageFilterChange) return;
 onMajorCategoryChange?.('marketing');
 onStageChange(MARKETING_FLYWHEEL_ORDER[0]);
 onStageFilterChange('all');
 onTaskGroupChange?.('all');
 };

  const selectAllInEducation = () => {
    onMajorCategoryChange?.('education');
    onEducationBandChange?.('all');
    onEducationBandFilterChange?.('all');
    onStageChange(EDUCATION_STAGE_ID);
    if (allowAllInCategory && onStageFilterChange) {
      onStageFilterChange(EDUCATION_STAGE_ID);
    }
  };

 const marketingSubActive = (stageId: string) => {
 if (allowAllInCategory) {
 return resolvedMajorCategory === 'marketing' && subFilter === stageId;
 }
 return resolvedMajorCategory === 'marketing' && activeStage === stageId;
 };

 const marketingAllActive =
 allowAllInCategory && resolvedMajorCategory === 'marketing' && subFilter === 'all';

 const majorCategoryLabel = (id: HubMajorCategory) => {
 if (id === 'marketing') return t('categoryMarketing');
 if (id === 'media') return t('categoryMedia');
 if (id === 'geo') return t('categoryGeo');
 if (id === 'finance') return t('categoryFinance', { defaultValue: '金融' });
 if (id === 'enterprise_compliance') {
  return t('categoryEnterpriseCompliance', { defaultValue: '企业合规' });
 }
 if (id === 'education') return t('categoryEducation');
 if (id === 'brainstorming') return t('categoryBrainstorming');
 return majorCategoriesMeta[id]?.label || t(`majorCategories.${id}`, { defaultValue: id });
 };

 const majorCategoryCount = (id: HubMajorCategory) => {
 if (majorCategoryCounts[id] != null) return majorCategoryCounts[id] as number;
 if (id === 'marketing') return marketingCount;
 if (id === 'education') return educationCount;
 return 0;
 };

  // L3 子类导航：纯文字无底色，仅用颜色+字重区分选中，视觉轻于 L2
  const renderSubtagPills = (
    options: Array<{ id: string; label: string; count?: number; title?: string }>,
    activeId: string,
    onSelect: (id: string) => void,
  ) => (
    <>
      {/* PD-SAAS-FORK: max-md:flex-nowrap — L3 pills swipe horizontally on phones */}
      <div
        className={cn(
          'scrollbar-hide flex min-w-0 items-center overflow-x-auto',
          isSidebarLayout
            ? 'ml-1 flex-col items-stretch gap-0.5 border-l border-border/60 pl-2'
            : isMobileLayout
              ? 'mobile-hub-pill-row gap-3 scroll-px-3.5 px-3.5 py-2'
              : cn('flex-wrap gap-x-0.5 gap-y-0.5 max-md:flex-nowrap', isCompact ? '-mx-1 px-1' : ''),
        )}
      >
      {([{ id: 'all', label: t('allInStage') }, ...options]).map((option) => {
        const active = activeId === option.id || (option.id === 'all' && (activeId === 'all' || !activeId));
        const subKey =
          visibilityAdmin?.subcategoryKeyForOption(option.id)
          ?? hubVisibilityFilter?.subcategoryKeyForOption(option.id)
          ?? null;
        if (option.id !== 'all' && hubVisibilityFilter && subKey && !hubVisibilityFilter.isSubcategoryVisible(subKey)) {
          return null;
        }
        const subVisible = subKey
          ? (visibilityAdmin?.isSubcategoryVisible(subKey) ?? hubVisibilityFilter?.isSubcategoryVisible(subKey) ?? true) !== false
          : true;
        return (
          <span key={option.id} className="inline-flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onSelect(option.id)}
            title={option.title || option.label}
            className={cn(
              'shrink-0 whitespace-nowrap transition-colors duration-150',
              isSidebarLayout
                ? cn(
                    'w-full truncate rounded-md px-2 py-1 text-left text-[10px]',
                    active
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    subKey && !subVisible && 'opacity-50',
                  )
                : isMobileLayout
                ? cn(
                    'mobile-hub-pill border-none bg-transparent py-0 text-[13px] leading-snug',
                    active ? 'font-semibold text-primary' : 'text-muted-foreground',
                    subKey && !subVisible && 'opacity-50',
                  )
                : cn(
                    'rounded px-2 py-0.5 max-md:px-2.5 max-md:py-1.5',
                    isCompact ? 'text-[9px] max-md:text-[11px]' : 'text-[10px] max-md:text-[11px]',
                    active
                      ? 'font-semibold text-primary'
                      : 'text-muted-foreground/70 hover:text-muted-foreground',
                    subKey && !subVisible && 'opacity-50 line-through',
                  ),
            )}
          >
            {option.label}
          </button>
          {visibilityAdmin && subKey ? (
            <button
              type="button"
              title={subVisible ? '子分类前台可见' : '子分类前台隐藏'}
              aria-label={subVisible ? '隐藏子分类' : '显示子分类'}
              onClick={(event) => {
                event.stopPropagation();
                visibilityAdmin.onToggleSubcategory(subKey);
              }}
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground',
                subVisible ? 'text-primary' : 'text-muted-foreground/40',
              )}
            >
              {subVisible ? (
                <Eye className="h-3 w-3" strokeWidth={1.75} />
              ) : (
                <EyeOff className="h-3 w-3" strokeWidth={1.75} />
              )}
            </button>
          ) : null}
          </span>
        );
      })}
      </div>
    </>
  );

 const renderTaskGroupNav = () => {
 if ((resolvedMajorCategory !== 'marketing' && resolvedMajorCategory !== 'geo') || taskGroups.length === 0) {
 return null;
 }
 const ordered = [...taskGroups].sort((a, b) => (a.group_order ?? 99) - (b.group_order ?? 99));
 return (
   <div className={isCompact ? 'pt-0.5' : 'pt-1'}>
     {renderSubtagPills(
       ordered.map((group) => ({
         id: group.id,
         label: group.label,
         count: taskGroupCounts[group.id] ?? 0,
       })),
       activeTaskGroup,
       (id) => onTaskGroupChange?.(id),
     )}
   </div>
 );
 };

 const renderMediaStepNav = () => {
 if (resolvedMajorCategory !== 'media' || mediaWorkflowSteps.length === 0) return null;
 const ordered = [...mediaWorkflowSteps].sort((a, b) => (a.step_order ?? 99) - (b.step_order ?? 99));
 return (
   <div className={isCompact ? 'pt-0.5' : 'pt-1'}>
     {renderSubtagPills(
       ordered.map((step) => ({
         id: step.id,
         label: t(`mediaSteps.${step.id}.label`, { defaultValue: step.label }),
         title: step.summary || step.label,
       })),
       activeStage === 'all' || !activeStage ? 'all' : activeStage,
       (id) => selectMediaStep(id),
     )}
   </div>
 );
 };

  const renderCategorySubtagNav = () => {
    if (
      resolvedMajorCategory !== 'office' &&
      resolvedMajorCategory !== 'creation' &&
      resolvedMajorCategory !== 'development' &&
      resolvedMajorCategory !== 'brainstorming' &&
      resolvedMajorCategory !== 'finance' &&
      resolvedMajorCategory !== 'enterprise_compliance'
    ) {
      return null;
    }
    if (categorySubtags.length === 0) return null;
    const ordered = [...categorySubtags].sort((a, b) => (a.subtag_order ?? 99) - (b.subtag_order ?? 99));
    return (
      <div className={isCompact ? 'pt-0.5' : 'pt-1'}>
        {renderSubtagPills(
          ordered.map((subtag) => ({
            id: subtag.id,
            label: subtag.label,
            count: categorySubtagCounts[subtag.id] ?? 0,
          })),
          activeCategorySubtag,
          (id) => onCategorySubtagChange?.(id),
        )}
      </div>
    );
  };

  const renderCategoryVisibilityToggle = (categoryId: HubMajorCategory, categoryVisible: boolean) => {
    if (!visibilityAdmin) return null;
    return (
      <button
        type="button"
        data-testid={`hub-vis-category-toggle-${categoryId}`}
        aria-label={categoryVisible ? '隐藏分类' : '显示分类'}
        title={categoryVisible ? '前台可见，点击隐藏分类' : '前台隐藏，点击显示分类'}
        onClick={(event) => {
          event.stopPropagation();
          visibilityAdmin.onToggleCategory(categoryId);
        }}
        className={cn(
          'relative z-20 inline-flex shrink-0 items-center justify-center rounded p-0.5 hover:bg-muted/80',
          categoryVisible ? 'text-primary' : 'text-muted-foreground/40',
        )}
      >
        {categoryVisible ? (
          <Eye className="h-3 w-3" strokeWidth={1.75} />
        ) : (
          <EyeOff className="h-3 w-3" strokeWidth={1.75} />
        )}
      </button>
    );
  };

  const renderMajorCategoryL1 = () => {
    if (isMobileLayout) {
      return (
        <div
          className="mobile-hub-seg-row scrollbar-hide flex gap-2 overflow-x-auto scroll-px-3.5 px-3.5 py-2"
          role="tablist"
          aria-label={t('categoryNavLabel')}
        >
          {visibleMajorCategories.map((categoryId) => {
            const isActive = resolvedMajorCategory === categoryId;
            const categoryMeta = majorCategoriesMeta[categoryId];
            const categoryTitle = categoryMeta?.summary
              ? `${majorCategoryLabel(categoryId)}：${categoryMeta.summary}`
              : majorCategoryLabel(categoryId);
            const categoryVisible = visibilityAdmin?.isCategoryVisible(categoryId) !== false;
            return (
              <span key={categoryId} className="inline-flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive ? 'true' : 'false'}
                  title={categoryTitle}
                  onClick={() => switchMajorCategory(categoryId)}
                  className={cn(
                    'mobile-hub-seg rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/25'
                      : 'text-muted-foreground',
                    !categoryVisible && 'opacity-50',
                  )}
                >
                  {majorCategoryLabel(categoryId)}
                </button>
                {renderCategoryVisibilityToggle(categoryId, categoryVisible)}
              </span>
            );
          })}
        </div>
      );
    }

    return (
      <div
        className={cn(
          'scrollbar-hide flex overflow-x-auto',
          isSidebarLayout
            ? 'flex-col gap-0.5'
            : cn(
                'rounded-xl border border-border/70 bg-muted/40 p-0.5',
                isCompact && 'rounded-lg',
              ),
        )}
        role="tablist"
        aria-label={t('categoryNavLabel')}
      >
        {visibleMajorCategories.map((categoryId) => {
          const Icon = MAJOR_CATEGORY_ICONS[categoryId];
          const isActive = resolvedMajorCategory === categoryId;
          const count = majorCategoryCount(categoryId);
          const categoryMeta = majorCategoriesMeta[categoryId];
          const categoryTitle = categoryMeta?.summary
            ? `${majorCategoryLabel(categoryId)}：${categoryMeta.summary}`
            : majorCategoryLabel(categoryId);
          const categoryVisible = visibilityAdmin?.isCategoryVisible(categoryId) !== false;
          return (
            <span
              key={categoryId}
              className={cn(
                'relative flex shrink-0 items-center',
                !isSidebarLayout && (showExtendedCategories ? 'min-w-[72px] flex-1' : 'flex-1'),
                isSidebarLayout && 'w-full',
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive ? 'true' : 'false'}
                title={categoryTitle}
                onClick={() => switchMajorCategory(categoryId)}
                className={cn(
                  'relative flex min-w-0 items-center transition-colors duration-200',
                  isSidebarLayout
                    ? cn(
                        'w-full flex-1 gap-2 rounded-md px-2 py-1.5 text-left',
                        isActive
                          ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )
                    : cn(
                        'flex-1 justify-center gap-1.5 rounded-lg',
                        isCompact ? 'px-2 py-1' : 'px-2.5 py-1.5',
                        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                      ),
                  !categoryVisible && 'opacity-50',
                )}
              >
                {isActive && !isSidebarLayout ? (
                  <motion.span
                    layoutId="hubMajorCategoryIndicator"
                    className="absolute inset-0 rounded-lg bg-card shadow-xs ring-1 ring-border"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    aria-hidden
                  />
                ) : null}
                <Icon
                  className={cn(
                    'relative z-10 shrink-0',
                    categoryId === 'marketing' && 'text-teal-600 dark:text-teal-400',
                    categoryId === 'media' && 'text-blue-600 dark:text-blue-400',
                    categoryId === 'geo' && 'text-emerald-600 dark:text-emerald-400',
                    categoryId === 'education' && 'text-amber-600 dark:text-amber-400',
                    categoryId === 'office' && 'text-stone-600 dark:text-stone-400',
                    categoryId === 'creation' && 'text-fuchsia-600 dark:text-fuchsia-400',
                    categoryId === 'development' && 'text-cyan-600 dark:text-cyan-400',
                    categoryId === 'brainstorming' && 'text-orange-600 dark:text-orange-400',
                    categoryId === 'finance' && 'text-sky-700 dark:text-sky-400',
                    categoryId === 'enterprise_compliance' && 'text-indigo-700 dark:text-indigo-400',
                    isSidebarLayout ? 'h-3.5 w-3.5' : isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5',
                  )}
                  strokeWidth={1.75}
                />
                <span
                  className={cn(
                    'relative z-10 flex min-w-0 items-baseline gap-1 leading-none',
                    isSidebarLayout && 'flex-1',
                  )}
                >
                  <span
                    className={cn(
                      'font-medium',
                      isSidebarLayout ? 'truncate text-[11px]' : isCompact ? 'text-[11px]' : 'text-xs',
                    )}
                  >
                    {majorCategoryLabel(categoryId)}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
                    {count}
                  </span>
                </span>
              </button>
              <span className={cn('relative z-20 shrink-0', isSidebarLayout ? 'pr-1' : 'px-0.5')}>
                {renderCategoryVisibilityToggle(categoryId, categoryVisible)}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const marketingStageButtonClass = (isActive: boolean) =>
    isSidebarLayout
      ? cn(
          'w-full truncate rounded-md px-2 py-1 text-left text-[10px] transition-colors',
          isActive
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )
      : isMobileLayout
      ? cn(
          'mobile-hub-stage shrink-0 whitespace-nowrap border-none bg-transparent px-2.5 pb-2 pt-1.5 text-[13px] leading-snug transition-colors',
          isActive ? 'mobile-hub-stage-active font-semibold text-foreground' : 'text-muted-foreground',
        )
      : cn(
          'shrink-0 whitespace-nowrap rounded-md transition-all duration-150',
          isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
          isActive
            ? 'bg-primary/10 font-semibold text-primary ring-1 ring-inset ring-primary/25'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        );

  return (
    <div className={cn('space-y-1.5', isCompact ? '' : isSidebarLayout ? 'mb-0' : 'mb-1')}>
      {renderMajorCategoryL1()}

  {!isMobileLayout ? (
    <>
  {resolvedMajorCategory === 'marketing' ? (
    <div className={cn('space-y-1.5', isCompact ? 'pt-0.5' : isMobileLayout ? 'pt-0' : 'pt-1')}>
      <div
        className={cn(
          'scrollbar-hide flex min-w-0 items-center overflow-x-auto',
          isSidebarLayout
            ? 'ml-1 flex-col items-stretch gap-0.5 border-l border-border/60 pl-2'
            : isMobileLayout
              ? 'mobile-hub-stage-row scrollbar-hide gap-1 scroll-px-3.5 border-b border-border px-3.5'
              : cn('flex-wrap gap-1', isCompact ? '-mx-1 px-1' : ''),
        )}
      >
        {allowAllInCategory ? (
          <button
            type="button"
            onClick={selectAllInMarketing}
            className={marketingStageButtonClass(marketingAllActive)}
          >
            {t('allInCategory')}
          </button>
        ) : null}
        {flywheelStages.map((stage) => {
          const isActive = marketingSubActive(stage.id);
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => selectMarketingStage(stage.id)}
              title={stage.summary || stage.label}
              className={marketingStageButtonClass(isActive)}
            >
              {stage.label}
            </button>
          );
        })}
      </div>
      {renderTaskGroupNav()}
    </div>
  ) : null}

  {resolvedMajorCategory === 'geo' && geoFlywheelStages.length > 0 ? (
    <div className={cn('space-y-1.5', isCompact ? 'pt-0.5' : isMobileLayout ? 'pt-0' : 'pt-1')}>
      <div
        className={cn(
          'scrollbar-hide flex min-w-0 items-center overflow-x-auto',
          isSidebarLayout
            ? 'ml-1 flex-col items-stretch gap-0.5 border-l border-border/60 pl-2'
            : isMobileLayout
              ? 'mobile-hub-stage-row scrollbar-hide gap-1 scroll-px-3.5 border-b border-border px-3.5'
              : cn('flex-wrap gap-1', isCompact ? '-mx-1 px-1' : ''),
        )}
      >
        {geoFlywheelStages.map((stage) => {
          const isActive = geoSubActive(stage.id);
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => selectGeoStage(stage.id)}
              title={stage.summary || stage.label}
              className={marketingStageButtonClass(isActive)}
            >
              {t(`geoStages.${stage.id}.label`, { defaultValue: stage.label })}
            </button>
          );
        })}
      </div>
      {renderTaskGroupNav()}
    </div>
  ) : null}

  {resolvedMajorCategory === 'media' && mediaLanes.length > 0 ? (
    <div className={cn('space-y-1.5', isCompact ? 'pt-0.5' : isMobileLayout ? 'pt-0' : 'pt-1')}>
      <div
        className={cn(
          'scrollbar-hide flex min-w-0 items-center overflow-x-auto',
          isSidebarLayout
            ? 'ml-1 flex-col items-stretch gap-0.5 border-l border-border/60 pl-2'
            : isMobileLayout
              ? 'mobile-hub-stage-row scrollbar-hide gap-1 scroll-px-3.5 border-b border-border px-3.5'
              : cn('flex-wrap gap-1', isCompact ? '-mx-1 px-1' : ''),
        )}
      >
        {mediaLanes.map((lane) => {
          const isActive = mediaLaneActive(lane.id);
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => selectMediaLane(lane.id)}
              title={lane.summary || lane.label}
              className={marketingStageButtonClass(isActive)}
            >
              {t(`mediaLanes.${lane.id}.label`, { defaultValue: lane.label })}
            </button>
          );
        })}
      </div>
      {renderMediaStepNav()}
    </div>
  ) : null}

  {resolvedMajorCategory === 'education' && showEducation ? (
    <div className={isCompact ? 'pt-0.5' : 'pt-1'}>
      {renderSubtagPills(
        orderedEducationBands.map((band) => ({
          id: band.id,
          label: bandLabel(t, band),
          count: band.count ?? 0,
          title: bandSummary(t, band) || bandLabel(t, band),
        })),
        allowAllInCategory ? (educationSubFilter as string) : activeEducationBand,
        (id) => {
          if (id === 'all') {
            selectAllInEducation();
          } else {
            selectEducationBand(id);
          }
        },
      )}
    </div>
  ) : null}

 {resolvedMajorCategory === 'office' ||
 resolvedMajorCategory === 'creation' ||
 resolvedMajorCategory === 'development' ||
 resolvedMajorCategory === 'brainstorming' ||
 resolvedMajorCategory === 'finance' ||
 resolvedMajorCategory === 'enterprise_compliance'
 ? renderCategorySubtagNav()
 : null}
    </>
  ) : null}
 </div>
  );
}

export { stageToCategory, EDUCATION_STAGE_ID };
