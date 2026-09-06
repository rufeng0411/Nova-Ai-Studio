/** PD-SAAS-FORK: 能力中心分类体系（与 scripts/lib/capabilityHubTaxonomy.mjs 对齐） */

import bundledCatalog from '../generated/capabilities.catalog.json';
import { GEO_FLYWHEEL_ORDER, MARKETING_FLYWHEEL_ORDER, MEDIA_LANE_ORDER, MEDIA_WORKFLOW_ORDER } from './capabilityHubTheme.js';
import { isHubEnterpriseComplianceTabEnabled, isHubMediaTabEnabled } from './perfFeatureFlags.js';

export type HubMajorCategory =
  | 'marketing'
  | 'media'
  | 'geo'
  | 'finance'
  | 'enterprise_compliance'
  | 'office'
  | 'creation'
  | 'development'
  | 'brainstorming'
  | 'education';

const BASE_HUB_MAJOR_CATEGORY_ORDER: HubMajorCategory[] = [
  'marketing',
  'media',
  'geo',
  'finance',
  'enterprise_compliance',
  'office',
  'creation',
  'development',
  'brainstorming',
  'education',
];

export type HubMajorCategoryOrderOptions = {
  /** 后台可见性管理：展示全部分类 Tab，不受 VITE 性能开关裁剪 */
  forAdmin?: boolean;
};

export function getHubMajorCategoryOrder(options?: HubMajorCategoryOrderOptions): HubMajorCategory[] {
  let order = BASE_HUB_MAJOR_CATEGORY_ORDER;
  if (options?.forAdmin) return order;
  if (!isHubMediaTabEnabled()) {
    order = order.filter((id) => id !== 'media');
  }
  if (!isHubEnterpriseComplianceTabEnabled()) {
    order = order.filter((id) => id !== 'enterprise_compliance');
  }
  return order;
}

/** @deprecated 请用 getHubMajorCategoryOrder()；保留静态列表供类型推断 */
export const HUB_MAJOR_CATEGORY_ORDER: HubMajorCategory[] = BASE_HUB_MAJOR_CATEGORY_ORDER;

export type GeoStageId = (typeof GEO_FLYWHEEL_ORDER)[number];

export type TaskGroupMeta = {
  id: string;
  label: string;
  group_order: number;
  summary?: string;
};

export type GeoStageMeta = {
  id: string;
  label: string;
  stage_order: number;
  summary?: string;
};

export type MediaLaneMeta = {
  id: string;
  label: string;
  lane_order: number;
  summary?: string;
};

export type MediaWorkflowStepMeta = {
  id: string;
  label: string;
  step_order: number;
  summary?: string;
};

export type MajorCategorySubtag = {
  id: string;
  label: string;
  subtag_order: number;
};

export type MajorCategoryMeta = {
  label: string;
  stage_order: number;
  summary?: string;
  subtags?: MajorCategorySubtag[];
};

type CatalogTaxonomy = {
  flywheel_task_groups?: Record<string, TaskGroupMeta[]>;
  geo_task_groups?: Record<string, TaskGroupMeta[]>;
  geo_flywheel_stages?: GeoStageMeta[];
  media_lanes?: MediaLaneMeta[];
  media_workflow_steps?: Record<string, MediaWorkflowStepMeta[]>;
  major_categories?: Record<string, MajorCategoryMeta>;
};

const catalogTaxonomy = bundledCatalog as CatalogTaxonomy;

export function getFlywheelTaskGroups(stageId: string): TaskGroupMeta[] {
  return catalogTaxonomy.flywheel_task_groups?.[stageId] ?? [];
}

export function getGeoTaskGroups(geoStageId: string): TaskGroupMeta[] {
  return catalogTaxonomy.geo_task_groups?.[geoStageId] ?? [];
}

export function getGeoFlywheelStages(): GeoStageMeta[] {
  return catalogTaxonomy.geo_flywheel_stages ?? [];
}

export function getMediaLanes(): MediaLaneMeta[] {
  return catalogTaxonomy.media_lanes ?? [];
}

export function getMediaWorkflowSteps(laneId: string): MediaWorkflowStepMeta[] {
  return catalogTaxonomy.media_workflow_steps?.[laneId] ?? [];
}

export function getMajorCategoriesMeta(): Record<string, MajorCategoryMeta> {
  return catalogTaxonomy.major_categories ?? {};
}

export function getMajorCategorySubtags(categoryId: HubMajorCategory): MajorCategorySubtag[] {
  if (categoryId === 'marketing' || categoryId === 'education' || categoryId === 'geo' || categoryId === 'media') {
    return [];
  }
  const meta = getMajorCategoriesMeta()[categoryId];
  return meta?.subtags ?? [];
}

function matchesDualSubtag(
  item: { slug?: string; category_subtag?: string },
  majorCategory: HubMajorCategory,
  subtag: string,
): boolean {
  if (majorCategory === 'office' && subtag === 'office_sheets') {
    if (item.slug === 'mkt-campaign-budget' || item.slug === 'anth-xlsx') return true;
  }
  if (majorCategory === 'creation' && subtag === 'create_video') {
    if (item.slug === 'od-digits-fintech') return true;
  }
  if (majorCategory === 'brainstorming' && subtag === 'celebrity_mind') {
    if (
      item.slug === 'persona-buffett'
      || item.slug === 'persona-duan-yongping'
      || item.slug === 'persona-munger'
    ) {
      return true;
    }
  }
  if (majorCategory === 'finance' && subtag === 'fin_investment_mind') {
    if (
      item.slug === 'persona-buffett'
      || item.slug === 'persona-duan-yongping'
      || item.slug === 'persona-munger'
    ) {
      return true;
    }
  }
  return false;
}

export function capabilityMatchesMediaLane(
  item: { media_lane?: string; secondary_media_lanes?: string[] },
  laneId: string,
): boolean {
  if (!laneId || laneId === 'all') return true;
  if (item.media_lane === laneId) return true;
  return Array.isArray(item.secondary_media_lanes) && item.secondary_media_lanes.includes(laneId);
}

export function capabilityMatchesMediaStep(
  item: { media_workflow_step?: string; secondary_media_workflow_steps?: string[] },
  stepId: string,
): boolean {
  if (!stepId || stepId === 'all') return true;
  if (item.media_workflow_step === stepId) return true;
  return Array.isArray(item.secondary_media_workflow_steps) && item.secondary_media_workflow_steps.includes(stepId);
}

export function matchesMajorCategory(
  majorCategory: HubMajorCategory,
  item: {
    stage?: string;
    major_category?: string;
    secondary_categories?: string[];
  },
): boolean {
  if (majorCategory === 'geo') {
    return item.major_category === 'geo';
  }
  if (majorCategory === 'media') {
    if (item.major_category === 'media') return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('media');
  }
  if (majorCategory === 'marketing') {
    const inFlywheel = MARKETING_FLYWHEEL_ORDER.includes(item.stage as (typeof MARKETING_FLYWHEEL_ORDER)[number]);
    if (!inFlywheel) return false;
    if (item.major_category === 'marketing' || !item.major_category) return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('marketing');
  }
  if (majorCategory === 'finance') {
    if (item.major_category === 'finance') return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('finance');
  }
  if (majorCategory === 'enterprise_compliance') {
    if (item.major_category === 'enterprise_compliance') return true;
    if (item.stage === 'enterprise_compliance') return true;
    return (
      Array.isArray(item.secondary_categories)
      && item.secondary_categories.includes('enterprise_compliance')
    );
  }
  if (majorCategory === 'education') {
    return item.major_category === 'education' || item.stage === 'education';
  }
  if (majorCategory === 'brainstorming') {
    if (item.major_category === 'brainstorming' || item.stage === 'brainstorming') return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes('brainstorming');
  }
  if (majorCategory === 'office' || majorCategory === 'creation' || majorCategory === 'development') {
    if (item.major_category === majorCategory) return true;
    return Array.isArray(item.secondary_categories) && item.secondary_categories.includes(majorCategory);
  }
  return false;
}

export function capabilityMatchesFlywheelStage(
  item: { stage?: string; secondary_stages?: string[] },
  stageId: string,
): boolean {
  if (!stageId) return false;
  if (item.stage === stageId) return true;
  return Array.isArray(item.secondary_stages) && item.secondary_stages.includes(stageId);
}

export function capabilityMatchesGeoStage(
  item: { geo_stage?: string },
  geoStageId: string,
): boolean {
  if (!geoStageId || geoStageId === 'all') return true;
  return item.geo_stage === geoStageId;
}

export function capabilityMatchesGeoTaskGroup(
  item: { task_group?: string; secondary_task_groups?: string[] },
  taskGroupId: string | 'all',
): boolean {
  if (!taskGroupId || taskGroupId === 'all') return true;
  const primary = item.task_group || 'general';
  const secondary = item.secondary_task_groups || [];
  return primary === taskGroupId || secondary.includes(taskGroupId);
}

export function capabilityMatchesFlywheelTaskGroup(
  item: { stage?: string; task_group?: string; secondary_stages?: string[]; secondary_task_groups?: string[] },
  stageId: string,
  taskGroupId: string | 'all',
): boolean {
  if (!taskGroupId || taskGroupId === 'all') return true;
  if (!capabilityMatchesFlywheelStage(item, stageId)) return false;
  const primary = item.task_group || 'general';
  const secondary = item.secondary_task_groups || [];
  return primary === taskGroupId || secondary.includes(taskGroupId);
}

function matchesBrainstormingSubtag(
  item: { slug?: string; category_subtag?: string; major_category?: string },
  subtag: string,
): boolean {
  if (subtag === 'celebrity_mind') {
    return item.slug?.startsWith('persona-') || item.slug === 'celebrity-mind';
  }
  if (subtag === 'methodology') {
    if (item.major_category === 'finance') return false;
    return (
      item.category_subtag === 'methodology'
      || item.slug?.startsWith('pms-')
      || item.slug?.startsWith('pmd-')
      || item.slug?.startsWith('hub-pack-pm-')
      || item.slug === 'brainstorm-structured'
    );
  }
  if (subtag === 'enterprise_consult') {
    return (
      item.category_subtag === 'enterprise_consult'
      || Boolean(item.slug?.startsWith('consult-'))
    );
  }
  return item.category_subtag === subtag;
}

export function matchesHubFilter(
  item: {
    slug?: string;
    stage?: string;
    geo_stage?: string;
    task_group?: string;
    secondary_stages?: string[];
    secondary_task_groups?: string[];
    major_category?: string;
    secondary_categories?: string[];
    category_subtag?: string;
    education_bands?: string[];
    hidden_in_hub?: boolean;
    media_lane?: string;
    secondary_media_lanes?: string[];
    media_workflow_step?: string;
    secondary_media_workflow_steps?: string[];
  },
  majorCategory: HubMajorCategory,
  activeStage: string,
  activeEducationBand: string,
  activeTaskGroup: string | 'all',
  activeCategorySubtag: string | 'all',
): boolean {
  if (item.hidden_in_hub) return false;
  if (!matchesMajorCategory(majorCategory, item)) return false;

  if (majorCategory === 'geo') {
    if (!capabilityMatchesGeoStage(item, activeStage)) return false;
    if (!capabilityMatchesGeoTaskGroup(item, activeTaskGroup)) return false;
    return true;
  }

  if (majorCategory === 'media') {
    const lane = activeTaskGroup && activeTaskGroup !== 'all' ? activeTaskGroup : 'all';
    const step = activeStage && activeStage !== 'all' ? activeStage : 'all';
    if (!capabilityMatchesMediaLane(item, lane)) return false;
    if (!capabilityMatchesMediaStep(item, step)) return false;
    return true;
  }

  if (majorCategory === 'marketing') {
    if (!capabilityMatchesFlywheelStage(item, activeStage)) return false;
    if (!capabilityMatchesFlywheelTaskGroup(item, activeStage, activeTaskGroup)) return false;
    return true;
  }

  if (majorCategory === 'education') {
    if (item.stage !== 'education') return false;
    if (activeEducationBand && activeEducationBand !== 'all') {
      const bands = item.education_bands || [];
      if (!bands.includes(activeEducationBand)) return false;
    }
    return true;
  }

  if (majorCategory === 'brainstorming' && activeCategorySubtag !== 'all') {
    return matchesBrainstormingSubtag(item, activeCategorySubtag);
  }

  if (activeCategorySubtag !== 'all' && item.category_subtag !== activeCategorySubtag) {
    if (!matchesDualSubtag(item, majorCategory, activeCategorySubtag)) return false;
  }
  return true;
}

export function defaultStageForMajorCategory(category: HubMajorCategory): string {
  if (category === 'media') return 'all';
  if (category === 'geo') return GEO_FLYWHEEL_ORDER[0];
  if (category === 'marketing') return MARKETING_FLYWHEEL_ORDER[0];
  if (category === 'education') return 'education';
  if (category === 'brainstorming') return 'brainstorming';
  if (category === 'finance') return 'finance';
  if (category === 'enterprise_compliance') return 'enterprise_compliance';
  return category;
}

export function defaultMediaLaneForMajorCategory(): string {
  return MEDIA_LANE_ORDER[0];
}

export function majorCategoryFromStage(stageId: string): HubMajorCategory {
  if ((MEDIA_WORKFLOW_ORDER.media_ooh as readonly string[]).includes(stageId)
    || (MEDIA_WORKFLOW_ORDER.media_digital as readonly string[]).includes(stageId)) {
    return 'media';
  }
  if (GEO_FLYWHEEL_ORDER.includes(stageId as GeoStageId)) return 'geo';
  if (stageId === 'education') return 'education';
  if (stageId === 'brainstorming') return 'brainstorming';
  if (stageId === 'finance') return 'finance';
  if (stageId === 'enterprise_compliance') return 'enterprise_compliance';
  if (stageId === 'office' || stageId === 'creation' || stageId === 'development') {
    return stageId;
  }
  if (MARKETING_FLYWHEEL_ORDER.includes(stageId as (typeof MARKETING_FLYWHEEL_ORDER)[number])) {
    return 'marketing';
  }
  return 'marketing';
}
