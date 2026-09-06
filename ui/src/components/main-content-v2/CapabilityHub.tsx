import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../utils/api';
import { cn } from '../../lib/utils.js';
import CapabilityHubCategoryNav from '../capability-hub/CapabilityHubCategoryNav.js';
import {
 localizeCapabilityFields,
 localizeStageFields,
 resolveCapabilityTryPrompt,
} from '../../shared/capabilityLocale.js';
import { buildCapabilityBindingFromItem, type CapabilityBindingContext } from '../../shared/capabilityBinding.js';
import { requestCapabilityLaunch } from '../../shared/capabilityTryBridge.js';
import { appendCapabilityPrerequisiteHint } from '../../shared/capabilityPrerequisiteHint.js';
import {
 compareCapabilitiesForHub,
 resolveHubSort,
} from '../../shared/capabilityHubSort.js';
import capabilitiesI18n from '../../generated/capabilities.i18n.json';
import {
 EDUCATION_STAGE_ID,
 GEO_FLYWHEEL_ORDER,
 MARKETING_FLYWHEEL_ORDER,
 themeForCapability,
 iconForCapability,
 type HubMajorCategory,
} from '../../shared/capabilityHubTheme.js';
import CapabilityCard from '../capability-hub/CapabilityCard.js';
import HubExpandMoreToggle from '../capability-hub/HubExpandMoreToggle.js';
import { splitHubSectionItems } from '../../shared/hubPinnedSections.js';
import { getRuntimeFeatureFlags } from '../../shared/runtimeFeatureFlags.js';
import { shouldShowHyperframesHubCapability } from '../../shared/hyperframesHubFilter.js';
import {
 getHubMajorCategoryOrder,
 defaultStageForMajorCategory,
 defaultMediaLaneForMajorCategory,
 getFlywheelTaskGroups,
 getGeoTaskGroups,
 getGeoFlywheelStages,
 getMediaWorkflowSteps,
 getMajorCategorySubtags,
 matchesHubFilter,
 matchesMajorCategory,
 capabilityMatchesFlywheelStage,
 capabilityMatchesGeoStage,
 capabilityMatchesMediaLane,
 getMediaLanes,
} from '../../shared/capabilityHubTaxonomy.js';
import {
 buildEducationBandOptions,
 capabilityMatchesEducationBand,
 enrichCapabilityEducationBands,
 getBundledEducationBandMeta,
} from '../../shared/educationBands.js';
import {
 getBundledCapabilitiesHub,
} from '../../shared/capabilitiesBundled.js';
import {
 buildCapabilityHubFingerprint,
 readCapabilityHubCache,
 writeCapabilityHubCache,
 type CapabilityHubCachedPayload,
} from '../../shared/capabilityHubCache.js';
import {
 enrichCapabilityTaxonomy,
 countSubtagsForMajor,
 countTaskGroupsForStage,
 countGeoTaskGroupsForStage,
} from '../../shared/capabilityTaxonomyMeta.js';
import {
 resolveCapabilityDescription,
 resolveCapabilityTaskSummary,
} from '../../shared/capabilityCopy.js';
import type { Project } from '../../types/app';
import { useMobileShell } from '../../hooks/useMobileShell';
import { useMobileHubSearch } from '../../mobile/MobileHubSearchContext';
import { useHubFavoritesOptional } from '../templates-hub/HubFavoritesContext.js';
import {
  isCapabilityDirectlyVisibleInHubAdmin,
  isCapabilityVisibleInHub as isCapabilityVisibleByHubDoc,
  isCategoryVisible,
  isSubcategoryVisible,
  resolveSubcategoryKeysForCapability,
  subcategoryKeyForNavOption,
  toggleCapabilityVisibility,
  toggleCategoryVisibility,
  toggleSubcategoryVisibility,
  fetchHubVisibility,
  EMPTY_HUB_VISIBILITY,
  normalizeHubVisibilityDoc,
  type HubVisibilityDoc,
  type HubVisibilityDocUpdater,
} from '../../shared/hubVisibility.js';

const capabilityCatalogMeta = capabilitiesI18n.skills as Record<
 string,
 { hub_sort?: number; stage?: string }
>;

type CapabilityStage = {
 id: string;
 label: string;
 stage_order: number;
 summary?: string;
 count?: number;
};

type CapabilityItem = {
 slug: string;
 name: string;
 display_name?: string;
 task_summary: string;
 description: string;
 stage: string;
 stage_label: string;
 stage_order: number;
 education_bands?: string[];
 secondary_stages?: string[];
 secondary_task_groups?: string[];
 integration_level: string;
 hub_sort?: number;
 examples: string[];
 status: 'available' | 'pending' | 'unavailable' | 'needs_config';
 availability?: string;
 setup_hint?: string;
 task_group?: string;
 major_category?: string;
 secondary_categories?: string[];
 category_subtag?: string;
 hidden_in_hub?: boolean;
 rating?: number;
 geo_stage?: string;
 hub_recommend_stars?: number;
 hub_pinned?: boolean;
 launch_mode?: 'skip' | 'choice' | 'visual' | string;
 media_lane?: string;
 secondary_media_lanes?: string[];
 media_workflow_step?: string;
 secondary_media_workflow_steps?: string[];
};

function passesHyperframesHubGate(item: CapabilityItem, adminMode: boolean): boolean {
 if (adminMode) return true;
 const hubV2 = getRuntimeFeatureFlags()?.hyperframesHubV2 !== false;
 return shouldShowHyperframesHubCapability(
  item.slug,
  Boolean(item.hidden_in_hub),
  hubV2,
  adminMode,
 );
}

function isListedInUserHub(item: CapabilityItem, doc: HubVisibilityDoc): boolean {
 return passesHyperframesHubGate(item, false)
  && isCapabilityVisibleByHubDoc(item, doc, resolveSubcategoryKeysForCapability);
}

type TaskGroupMeta = {
 id: string;
 label: string;
 group_order: number;
 summary?: string;
};

type EducationBandMeta = {
 id: string;
 label: string;
 band_order: number;
 summary?: string;
 count?: number;
};

type CapabilityHubPayload = {
 stages: CapabilityStage[];
 education_bands?: EducationBandMeta[];
 flywheel_task_groups?: Record<string, TaskGroupMeta[]>;
 geo_task_groups?: Record<string, TaskGroupMeta[]>;
 geo_flywheel_stages?: CapabilityStage[];
 major_categories?: Record<string, { label: string; summary?: string; subtags?: Array<{ id: string; label: string; subtag_order: number }> }>;
 capabilities: CapabilityItem[];
};

const FLYWHEEL_ORDER = MARKETING_FLYWHEEL_ORDER;

const STATUS_KEYS = {
 available: 'status.available',
 pending: 'status.pending',
 unavailable: 'status.unavailable',
 needs_config: 'status.needs_config',
} as const;

const SECONDARY_CATEGORY_LABELS: Record<string, string> = {
 office: '也在办公可用',
 creation: '也在创作可用',
 development: '也在开发可用',
};

type CapabilityHubProps = {
 selectedProject: Project | null;
 /** 全页能力中心：无对话上下文时新建对话 */
 onStartNewSession?: (project: Project) => void;
 /** 切回对话 Tab（已有对话续用能力时） */
 onSwitchToChat?: () => void;
 /** 对话内「模板」弹层：与全页共用筛选/分类逻辑 */
 embedded?: boolean;
 /** embedded 时点击「试一下」（由对话页处理续用/新建） */
 onTryPrompt?: (prompt: string, capability?: CapabilityBindingContext) => void;
 /** PD-SAAS-FORK: 后台技能管理 — 与能力中心同分类，点卡片进入管理 */
 adminMode?: boolean;
 onManageCapability?: (item: CapabilityItem) => void;
 selectedManageSlug?: string | null;
 /** PD-SAAS-FORK: 后台可见性管理 — 与前台同布局，星标位为可见开关 */
 visibilityMode?: boolean;
 visibilityDoc?: HubVisibilityDoc;
 onVisibilityDocChange?: (next: HubVisibilityDocUpdater) => void;
};

/** 飞轮 Tab 筛选（含 secondary_stages / secondary_task_groups） */
function capabilityMatchesHubFilter(
 item: CapabilityItem,
 majorCategory: HubMajorCategory,
 activeStage: string,
 activeEducationBand: string,
 activeTaskGroup: string | 'all',
 activeCategorySubtag: string | 'all',
) {
 return matchesHubFilter(
 item,
 majorCategory,
 activeStage,
 activeEducationBand,
 activeTaskGroup,
 activeCategorySubtag,
 );
}

/** PD-SAAS-FORK: mobile hub — L1 tab only, no L2/L3 stage/subtag filters */
function capabilityMatchesMobileHubFilter(
 item: CapabilityItem,
 majorCategory: HubMajorCategory,
 adminMode: boolean,
) {
 if (!passesHyperframesHubGate(item, adminMode)) return false;
 return matchesMajorCategory(majorCategory, item);
}

type HubGroupSection = {
 groupId: string;
 label: string;
 summary?: string;
 items: CapabilityItem[];
 labelLevel?: 'l2' | 'l3';
};

function resolveFlywheelTaskGroupsForStage(
 stageId: string,
 payload: CapabilityHubPayload,
): TaskGroupMeta[] {
 const fromApi = payload.flywheel_task_groups?.[stageId];
 if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
 return getFlywheelTaskGroups(stageId);
}

function resolveGeoTaskGroupsForStage(
 stageId: string,
 payload: CapabilityHubPayload,
): TaskGroupMeta[] {
 const fromApi = payload.geo_task_groups?.[stageId];
 if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
 return getGeoTaskGroups(stageId);
}

function pushMobileStageTaskGroupSections(
 sections: HubGroupSection[],
 stageId: string,
 stageLabel: string,
 stageItems: CapabilityItem[],
 groups: TaskGroupMeta[],
 t: (key: string, opts?: { defaultValue?: string }) => string,
) {
 const byGroup = new Map<string, CapabilityItem[]>();
 for (const item of stageItems) {
  const gid = item.task_group || 'general';
  if (!byGroup.has(gid)) byGroup.set(gid, []);
  byGroup.get(gid)!.push(item);
 }
 const ordered = [...groups].sort((a, b) => (a.group_order ?? 99) - (b.group_order ?? 99));
 const activeGroups = ordered.filter((g) => (byGroup.get(g.id)?.length ?? 0) > 0);
 const generalItems = byGroup.get('general') ?? [];
 if (generalItems.length > 0 && !activeGroups.some((g) => g.id === 'general')) {
  activeGroups.push({
   id: 'general',
   label: groups.find((g) => g.id === 'general')?.label || t('taskGroupGeneral'),
   group_order: 999,
  });
 }
 if (activeGroups.length <= 1) {
  sections.push({
   groupId: stageId,
   label: stageLabel,
   labelLevel: 'l2',
   items: stageItems,
  });
  return;
 }
 sections.push({
  groupId: `hdr-${stageId}`,
  label: stageLabel,
  labelLevel: 'l2',
  items: [],
 });
 for (const group of activeGroups) {
  sections.push({
   groupId: `${stageId}::${group.id}`,
   label: group.label,
   labelLevel: 'l3',
   items: byGroup.get(group.id) ?? [],
  });
 }
}

function buildMobileHubGroupSections(
 items: CapabilityItem[],
 majorCategory: HubMajorCategory,
 flywheelStages: CapabilityStage[],
 geoFlywheelStages: CapabilityStage[],
 categorySubtags: Array<{ id: string; label: string; subtag_order?: number }>,
 educationBands: Array<{ id: string; label: string }>,
 payload: CapabilityHubPayload,
 t: (key: string, opts?: { defaultValue?: string }) => string,
): HubGroupSection[] {
 const sections: HubGroupSection[] = [];

 if (majorCategory === 'marketing') {
  for (const stage of flywheelStages) {
   const stageItems = items.filter((item) => capabilityMatchesFlywheelStage(item, stage.id));
   if (!stageItems.length) continue;
   pushMobileStageTaskGroupSections(
    sections,
    stage.id,
    stage.label,
    stageItems,
    resolveFlywheelTaskGroupsForStage(stage.id, payload),
    t,
   );
  }
  return sections.length > 0 ? sections : [{ groupId: 'all', label: '', items }];
 }

 if (majorCategory === 'geo') {
  for (const stage of geoFlywheelStages) {
   const stageItems = items.filter((item) => capabilityMatchesGeoStage(item, stage.id));
   if (!stageItems.length) continue;
   const stageLabel = t(`geoStages.${stage.id}.label`, { defaultValue: stage.label });
   pushMobileStageTaskGroupSections(
    sections,
    stage.id,
    stageLabel,
    stageItems,
    resolveGeoTaskGroupsForStage(stage.id, payload),
    t,
   );
  }
  return sections.length > 0 ? sections : [{ groupId: 'all', label: '', items }];
 }

 if (majorCategory === 'media') {
  for (const lane of getMediaLanes()) {
   const laneItems = items.filter((item) => capabilityMatchesMediaLane(item, lane.id));
   if (!laneItems.length) continue;
   const laneLabel = t(`mediaLanes.${lane.id}.label`, { defaultValue: lane.label });
   const steps = getMediaWorkflowSteps(lane.id);
   const byStep = new Map<string, CapabilityItem[]>();
   for (const item of laneItems) {
    const stepId = item.media_workflow_step || 'general';
    if (!byStep.has(stepId)) byStep.set(stepId, []);
    byStep.get(stepId)!.push(item);
   }
   const orderedSteps = [...steps].sort((a, b) => (a.step_order ?? 99) - (b.step_order ?? 99));
   const activeSteps = orderedSteps.filter((step) => (byStep.get(step.id)?.length ?? 0) > 0);
   if (activeSteps.length <= 1) {
    sections.push({
     groupId: lane.id,
     label: laneLabel,
     labelLevel: 'l2',
     items: laneItems,
    });
   } else {
    sections.push({
     groupId: `hdr-media-${lane.id}`,
     label: laneLabel,
     labelLevel: 'l2',
     items: [],
    });
    for (const step of activeSteps) {
     sections.push({
      groupId: `${lane.id}::${step.id}`,
      label: t(`mediaSteps.${step.id}.label`, { defaultValue: step.label }),
      labelLevel: 'l3',
      items: byStep.get(step.id) ?? [],
     });
    }
   }
  }
  return sections.length > 0 ? sections : [{ groupId: 'all', label: '', items }];
 }

 if (majorCategory === 'education') {
  for (const band of educationBands) {
   const bandItems = items.filter((item) => {
    const bands = item.education_bands || [];
    return bands.includes(band.id);
   });
   if (!bandItems.length) continue;
   sections.push({
    groupId: band.id,
    label: band.label,
    labelLevel: 'l3',
    items: bandItems,
   });
  }
  return sections.length > 0 ? sections : [{ groupId: 'all', label: '', items }];
 }

 if (
  majorCategory === 'office' ||
  majorCategory === 'creation' ||
  majorCategory === 'development' ||
  majorCategory === 'brainstorming' ||
  majorCategory === 'finance' ||
  majorCategory === 'enterprise_compliance'
 ) {
  if (categorySubtags.length > 0) {
   const bySubtag = new Map<string, CapabilityItem[]>();
   for (const item of items) {
    const sid = item.category_subtag || 'general';
    if (!bySubtag.has(sid)) bySubtag.set(sid, []);
    bySubtag.get(sid)!.push(item);
   }
   const ordered = [...categorySubtags].sort((a, b) => (a.subtag_order ?? 99) - (b.subtag_order ?? 99));
   for (const tag of ordered) {
    const tagItems = bySubtag.get(tag.id) ?? [];
    if (!tagItems.length) continue;
    sections.push({
     groupId: tag.id,
     label: tag.label,
     labelLevel: 'l3',
     items: tagItems,
    });
   }
   if (sections.length > 0) return sections;
  }
 }

 return [{ groupId: 'all', label: '', items }];
}

function capabilityCardTitle(item: CapabilityItem, language?: string) {
 const display = item.display_name || '';
 const summary = resolveCapabilityTaskSummary(item);
 const isZh = (language || '').toLowerCase().startsWith('zh');
 if (isZh && display && !/[\u4e00-\u9fff]/.test(display) && /[\u4e00-\u9fff]/.test(summary)) {
 return summary;
 }
 return display || summary || item.name;
}

function enrichCapabilityHubSort(item: CapabilityItem): CapabilityItem {
 const hub_sort = resolveHubSort(item, capabilityCatalogMeta[item.slug]?.hub_sort);
 return { ...item, hub_sort };
}

function sortCapabilities(list: CapabilityItem[]): CapabilityItem[] {
 return [...list].map(enrichCapabilityHubSort).sort(compareCapabilitiesForHub);
}

function normalizeCapabilities(list: CapabilityItem[]): CapabilityItem[] {
 return sortCapabilities(list.map(enrichCapabilityEducationBands).map(enrichCapabilityTaxonomy));
}

function buildInitialPayload(adminMode = false): CapabilityHubPayload {
 const bundled = getBundledCapabilitiesHub();
 return {
 stages: bundled.stages,
 education_bands: bundled.education_bands,
 flywheel_task_groups: {},
 geo_flywheel_stages: getGeoFlywheelStages().map((stage) => ({
 id: stage.id,
 label: stage.label,
 stage_order: stage.stage_order,
 summary: stage.summary,
 })),
 major_categories: {} as CapabilityHubPayload['major_categories'],
 capabilities: normalizeCapabilities(
 (bundled.capabilities as CapabilityItem[]).filter((item) => passesHyperframesHubGate(item, adminMode)),
 ),
 };
}

function countHubVisibleCapabilities(list: CapabilityItem[], doc: HubVisibilityDoc): number {
 return list.filter((item) => isListedInUserHub(item, doc)).length;
}

function payloadFromCached(cached: CapabilityHubCachedPayload): CapabilityHubPayload {
 return {
 stages: Array.isArray(cached.stages) ? cached.stages as CapabilityStage[] : [],
 education_bands: Array.isArray(cached.education_bands)
 ? cached.education_bands as EducationBandMeta[]
 : [],
 flywheel_task_groups: (cached.flywheel_task_groups || {}) as CapabilityHubPayload['flywheel_task_groups'],
 geo_task_groups: (cached.geo_task_groups || {}) as CapabilityHubPayload['geo_task_groups'],
 geo_flywheel_stages: Array.isArray(cached.geo_flywheel_stages)
 ? cached.geo_flywheel_stages as CapabilityStage[]
 : undefined,
 major_categories: (cached.major_categories || {}) as CapabilityHubPayload['major_categories'],
 capabilities: normalizeCapabilities(
 Array.isArray(cached.capabilities) ? cached.capabilities as CapabilityItem[] : [],
 ),
 };
}

function parseCapabilityHubResponse(data: Record<string, unknown>): CapabilityHubPayload {
 const stages = Array.isArray(data?.stages) ? data.stages as CapabilityStage[] : [];
 const educationBands = Array.isArray(data?.education_bands)
 ? data.education_bands as EducationBandMeta[]
 : [];
 const flywheel_task_groups =
 data?.flywheel_task_groups && typeof data.flywheel_task_groups === 'object'
 ? data.flywheel_task_groups as CapabilityHubPayload['flywheel_task_groups']
 : {};
 const geo_task_groups =
 data?.geo_task_groups && typeof data.geo_task_groups === 'object'
 ? data.geo_task_groups as CapabilityHubPayload['geo_task_groups']
 : {};
 const major_categories =
 data?.major_categories && typeof data.major_categories === 'object'
 ? data.major_categories as CapabilityHubPayload['major_categories']
 : {};
 const geo_flywheel_stages = Array.isArray(data?.geo_flywheel_stages)
 ? data.geo_flywheel_stages as CapabilityStage[]
 : undefined;
 const capabilities = normalizeCapabilities(
 Array.isArray(data?.capabilities) ? data.capabilities as CapabilityItem[] : [],
 );
 return {
 stages,
 education_bands: educationBands,
 flywheel_task_groups,
 geo_task_groups,
 geo_flywheel_stages,
 major_categories,
 capabilities,
 };
}

function readCachedPayload(locale: string, projectPath?: string): CapabilityHubPayload | null {
 const cached = readCapabilityHubCache(locale, projectPath);
 if (!cached) return null;
 return payloadFromCached(cached.payload);
}

// PD-SAAS-FORK: 能力中心五 Tab、飞轮子类分组、needs_config 与 display_name 卡片
export default function CapabilityHub({
 selectedProject,
 onStartNewSession,
 onSwitchToChat,
 embedded = false,
 onTryPrompt,
 adminMode = false,
 onManageCapability,
 selectedManageSlug = null,
 visibilityMode = false,
 visibilityDoc,
 onVisibilityDocChange,
}: CapabilityHubProps) {
 const hubAdminMode = adminMode || visibilityMode;
 const hubChromeAdmin = adminMode && !visibilityMode;
 const { t, i18n } = useTranslation('capabilities');
 const { t: th } = useTranslation('templatesHub');
 const hubFavorites = useHubFavoritesOptional();
 const isMobileShell = useMobileShell();
 const mobileHubSearch = useMobileHubSearch();
 const [payload, setPayload] = useState<CapabilityHubPayload>(() => (
 readCachedPayload(i18n.language) ?? buildInitialPayload(hubAdminMode)
 ));
 const [refreshing, setRefreshing] = useState(false);
 const [loadError, setLoadError] = useState<string | null>(null);
 const [query, setQuery] = useState('');
 const [activeStage, setActiveStage] = useState<string>(MARKETING_FLYWHEEL_ORDER[0]);
 const [activeMajorCategory, setActiveMajorCategory] = useState<HubMajorCategory>('marketing');
 const [activeTaskGroup, setActiveTaskGroup] = useState<string | 'all'>('all');
 const [activeCategorySubtag, setActiveCategorySubtag] = useState<string | 'all'>('all');
 const [activeEducationBand, setActiveEducationBand] = useState<string | 'all'>('all');
 const [expandedHubSections, setExpandedHubSections] = useState<Record<string, boolean>>({});
 const [hubVisibilityFromApi, setHubVisibilityFromApi] = useState<HubVisibilityDoc>(EMPTY_HUB_VISIBILITY);

 useEffect(() => {
   setExpandedHubSections({});
 }, [activeMajorCategory, activeStage, activeTaskGroup, activeCategorySubtag, activeEducationBand, query]);

 useEffect(() => {
  if (visibilityMode || hubAdminMode) return;
  if (isCategoryVisible(activeMajorCategory, hubVisibilityFromApi)) return;
  const fallback = getHubMajorCategoryOrder().find((id) => isCategoryVisible(id, hubVisibilityFromApi));
  if (fallback && fallback !== activeMajorCategory) {
   setActiveMajorCategory(fallback);
   setActiveStage(defaultStageForMajorCategory(fallback));
   setActiveTaskGroup(fallback === 'media' ? defaultMediaLaneForMajorCategory() : 'all');
   setActiveCategorySubtag('all');
  }
 }, [activeMajorCategory, hubAdminMode, hubVisibilityFromApi, visibilityMode]);

 useEffect(() => {
   if (!isMobileShell || !mobileHubSearch) return;
   mobileHubSearch.registerHubSearch({ query, setQuery });
   return () => mobileHubSearch.registerHubSearch(null);
 }, [isMobileShell, mobileHubSearch, query, setQuery]);

 const projectPath = selectedProject?.fullPath || selectedProject?.path || undefined;
 const hubFingerprintRef = useRef<string | null>(
 readCapabilityHubCache(i18n.language, projectPath)?.fingerprint ?? null,
 );

 useEffect(() => {
 let cancelled = false;
 if (!hubAdminMode) {
 const cached = readCapabilityHubCache(i18n.language, projectPath);
 if (cached) {
 hubFingerprintRef.current = cached.fingerprint;
 setPayload(payloadFromCached(cached.payload));
  if (cached.hubVisibility) {
   setHubVisibilityFromApi(normalizeHubVisibilityDoc(cached.hubVisibility));
  }
 } else {
 hubFingerprintRef.current = null;
 setPayload(buildInitialPayload(false));
 }
 } else {
 hubFingerprintRef.current = null;
 setPayload(buildInitialPayload(true));
 }

 const load = async () => {
 setRefreshing(true);
 setLoadError(null);
 try {
 const response = await api.capabilities({
 projectPath,
 locale: i18n.language,
 admin: hubAdminMode,
 });
 if (!response.ok) {
 throw new Error('capability_hub_fetch_failed');
 }
 const data = await response.json();
 if (cancelled) return;

 const report = data?.report && typeof data.report === 'object' ? data.report : {};
 if (!hubAdminMode && data?.hub_visibility) {
  setHubVisibilityFromApi(normalizeHubVisibilityDoc(data.hub_visibility));
 }
 const fingerprint = buildCapabilityHubFingerprint({
 catalog_generated_at: report.catalog_generated_at,
 skills_revision: report.skills_revision,
 total_runtime_skills: report.total_runtime_skills,
 locale: report.locale || i18n.language,
 hub_visibility_updated_at: report.hub_visibility_updated_at,
 });

 if (hubAdminMode) {
 const nextPayload = parseCapabilityHubResponse(data);
 setPayload(nextPayload);
 } else {
 const nextPayload = parseCapabilityHubResponse(data);
 setPayload(nextPayload);
 if (fingerprint !== hubFingerprintRef.current) {
 hubFingerprintRef.current = fingerprint;
 writeCapabilityHubCache({
 fingerprint,
 locale: i18n.language,
 projectPath: projectPath || '',
 payload: nextPayload,
 hubVisibility: data?.hub_visibility && typeof data.hub_visibility === 'object'
  ? data.hub_visibility as Record<string, unknown>
  : undefined,
 });
 }
 }
 } catch {
 if (!cancelled) {
 setLoadError(t('empty.loadFailed'));
 }
 } finally {
 if (!cancelled) {
 setRefreshing(false);
 }
 }
 };
 void load();
 return () => {
 cancelled = true;
 };
 }, [projectPath, i18n.language, t, hubAdminMode]);

 useEffect(() => {
  if (hubAdminMode) return;
  let cancelled = false;
  void fetchHubVisibility().then((doc) => {
   if (!cancelled) setHubVisibilityFromApi(normalizeHubVisibilityDoc(doc));
  });
  return () => {
   cancelled = true;
  };
 }, [hubAdminMode]);

 const effectiveHubVisibility = visibilityMode && visibilityDoc ? visibilityDoc : hubVisibilityFromApi;

 const clearFilters = () => {
 setQuery('');
 setActiveMajorCategory('marketing');
 setActiveStage(FLYWHEEL_ORDER[0]);
 setActiveTaskGroup('all');
 setActiveCategorySubtag('all');
 setActiveEducationBand('all');
 };

 const localizedPayload = useMemo(() => {
 const language = i18n.language;
 let capabilities = payload.capabilities.map((item) => localizeCapabilityFields(item, language));
 if (!hubAdminMode) {
  capabilities = capabilities.filter((item) => isListedInUserHub(item, effectiveHubVisibility));
 }
 return {
 stages: payload.stages.map((stage) => localizeStageFields(stage, language)),
 education_bands: (payload.education_bands || []).map((band) => ({
 ...band,
 id: band.id,
 label: band.label,
 stage_order: band.band_order,
 summary: band.summary,
 count: band.count,
 })),
 capabilities,
 };
 }, [payload, i18n.language, hubAdminMode, effectiveHubVisibility]);

 const hubVisibleCount = useMemo(
 () => countHubVisibleCapabilities(localizedPayload.capabilities, effectiveHubVisibility),
 [localizedPayload.capabilities, effectiveHubVisibility],
 );

 const educationBands = useMemo(
 () =>
 buildEducationBandOptions(
 localizedPayload.capabilities,
 payload.education_bands?.length
 ? payload.education_bands
 : getBundledEducationBandMeta(),
 ),
 [localizedPayload.capabilities, payload.education_bands],
 );

 const flywheelStages = useMemo(() => {
 const byId = new Map(localizedPayload.stages.map((stage) => [stage.id, stage]));
 return MARKETING_FLYWHEEL_ORDER.map((id) => byId.get(id)).filter(Boolean) as CapabilityStage[];
 }, [localizedPayload.stages]);

 const geoFlywheelStages = useMemo(() => {
 const fromApi = payload.geo_flywheel_stages;
 if (Array.isArray(fromApi) && fromApi.length > 0) {
 return fromApi.map((stage) => ({
 id: stage.id,
 label: stage.label,
 stage_order: stage.stage_order,
 summary: stage.summary,
 count: localizedPayload.capabilities.filter(
 (item) => item.major_category === 'geo' && item.geo_stage === stage.id,
 ).length,
 }));
 }
 const bundled = getGeoFlywheelStages();
 return bundled.map((stage) => ({
 ...stage,
 count: localizedPayload.capabilities.filter(
 (item) => item.major_category === 'geo' && item.geo_stage === stage.id,
 ).length,
 }));
 }, [payload.geo_flywheel_stages, localizedPayload.capabilities]);

 const educationStage = useMemo(
 () => localizedPayload.stages.find((stage) => stage.id === EDUCATION_STAGE_ID) ?? null,
 [localizedPayload.stages],
 );

 const uncategorizedStage = useMemo(
 () => localizedPayload.stages.find((stage) => stage.id === 'uncategorized') ?? null,
 [localizedPayload.stages],
 );

 const majorCategoryCounts = useMemo(() => {
 const counts: Partial<Record<HubMajorCategory, number>> = {};
 const order = getHubMajorCategoryOrder({ forAdmin: visibilityMode });
 for (const category of order) {
 counts[category] = localizedPayload.capabilities.filter((item) => matchesMajorCategory(category, item)).length;
 }
 return counts;
 }, [localizedPayload.capabilities, visibilityMode]);

 const taskGroupsForStage = useMemo(() => {
 if (activeMajorCategory === 'geo') {
 const fromApi = payload.geo_task_groups?.[activeStage];
 if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
 return getGeoTaskGroups(activeStage);
 }
 const fromApi = payload.flywheel_task_groups?.[activeStage];
 if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
 return getFlywheelTaskGroups(activeStage);
 }, [activeMajorCategory, activeStage, payload.flywheel_task_groups, payload.geo_task_groups]);

 const taskGroupCounts = useMemo(() => {
 if (activeMajorCategory === 'marketing') {
 return countTaskGroupsForStage(localizedPayload.capabilities, activeStage);
 }
 if (activeMajorCategory === 'geo') {
 return countGeoTaskGroupsForStage(localizedPayload.capabilities, activeStage);
 }
 return {};
 }, [activeMajorCategory, activeStage, localizedPayload.capabilities]);

 const categorySubtagCounts = useMemo(() => {
 if (
 activeMajorCategory !== 'office' &&
 activeMajorCategory !== 'creation' &&
 activeMajorCategory !== 'development' &&
 activeMajorCategory !== 'brainstorming' &&
 activeMajorCategory !== 'finance' &&
 activeMajorCategory !== 'enterprise_compliance'
 ) {
 return {};
 }
 return countSubtagsForMajor(
 localizedPayload.capabilities,
 activeMajorCategory,
 (major, item) => matchesMajorCategory(major as HubMajorCategory, item),
 );
 }, [activeMajorCategory, localizedPayload.capabilities]);

 const categorySubtags = useMemo(() => {
 if (
 activeMajorCategory === 'office' ||
 activeMajorCategory === 'creation' ||
 activeMajorCategory === 'development' ||
 activeMajorCategory === 'brainstorming' ||
 activeMajorCategory === 'finance' ||
 activeMajorCategory === 'enterprise_compliance'
 ) {
 const fromApi = payload.major_categories?.[activeMajorCategory]?.subtags;
 if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
 return getMajorCategorySubtags(activeMajorCategory);
 }
 return [];
 }, [activeMajorCategory, payload.major_categories]);

 const filteredCapabilities = useMemo(() => {
 const normalized = query.trim().toLowerCase();
 // PD-SAAS-FORK: 有搜索词时跨全部一级分类检索（仍受 Hub 可见性/hidden 过滤后的 localized 列表约束）
 const filtered = localizedPayload.capabilities.filter((item) => {
 if (!normalized) {
 if (isMobileShell) {
 if (!capabilityMatchesMobileHubFilter(item, activeMajorCategory, hubAdminMode)) {
 return false;
 }
 } else if (
 !capabilityMatchesHubFilter(
 item,
 activeMajorCategory,
 activeStage,
 activeEducationBand,
 activeTaskGroup,
 activeCategorySubtag,
 )
 ) {
 return false;
 }
 return true;
 }
 const title = capabilityCardTitle(item, i18n.language);
 const exampleHay = (item.examples || []).join('\n').toLowerCase();
 return (
 item.slug.toLowerCase().includes(normalized) ||
 title.toLowerCase().includes(normalized) ||
 item.name.toLowerCase().includes(normalized) ||
 item.task_summary.toLowerCase().includes(normalized) ||
 item.description.toLowerCase().includes(normalized) ||
 // PD-SAAS-FORK: 试一下例句含正式名时也可搜到（防卡名漂移）
 exampleHay.includes(normalized)
 );
 });
 return sortCapabilities(filtered);
 }, [
 activeMajorCategory,
 activeStage,
 activeEducationBand,
 activeTaskGroup,
 activeCategorySubtag,
 localizedPayload.capabilities,
 query,
 i18n.language,
 isMobileShell,
 hubAdminMode,
 ]);

 const groupedCapabilities = useMemo(() => {
 const searchActive = Boolean(query.trim());

 // 全库搜索结果按一级分类分段，避免仍按「当前 Tab」子类折叠
 if (searchActive) {
 const order = getHubMajorCategoryOrder({ forAdmin: visibilityMode || hubAdminMode });
 const byMajor = new Map<string, CapabilityItem[]>();
 for (const item of filteredCapabilities) {
 const mid = (item.major_category || 'marketing') as string;
 if (!byMajor.has(mid)) byMajor.set(mid, []);
 byMajor.get(mid)!.push(item);
 }
 const sections = order
 .filter((id) => (byMajor.get(id)?.length ?? 0) > 0)
 .map((id) => ({
 groupId: id,
 label: payload.major_categories?.[id]?.label || id,
 summary: payload.major_categories?.[id]?.summary,
 items: byMajor.get(id) ?? [],
 }));
 const known = new Set(order);
 for (const [mid, items] of byMajor) {
 if (known.has(mid as HubMajorCategory)) continue;
 sections.push({
 groupId: mid,
 label: payload.major_categories?.[mid as HubMajorCategory]?.label || mid,
 summary: payload.major_categories?.[mid as HubMajorCategory]?.summary,
 items,
 });
 }
 return sections.length > 0
 ? sections
 : [{ groupId: 'all', label: '', items: filteredCapabilities }];
 }

 if (isMobileShell) {
  return buildMobileHubGroupSections(
   filteredCapabilities,
   activeMajorCategory,
   flywheelStages,
   geoFlywheelStages,
   categorySubtags,
   educationBands,
   payload,
   t,
  );
 }

 type GroupSection = {
 groupId: string;
 label: string;
 summary?: string;
 items: CapabilityItem[];
 };

 if (
 (activeMajorCategory === 'office' ||
 activeMajorCategory === 'creation' ||
 activeMajorCategory === 'development' ||
 activeMajorCategory === 'brainstorming' ||
 activeMajorCategory === 'finance' ||
 activeMajorCategory === 'enterprise_compliance') &&
 activeCategorySubtag === 'all' &&
 categorySubtags.length > 0
 ) {
 const bySubtag = new Map<string, CapabilityItem[]>();
 for (const item of filteredCapabilities) {
 const sid = item.category_subtag || 'general';
 if (!bySubtag.has(sid)) bySubtag.set(sid, []);
 bySubtag.get(sid)!.push(item);
 }
 const sections = categorySubtags
 .filter((tag) => (bySubtag.get(tag.id)?.length ?? 0) > 0)
 .map((tag) => ({
 groupId: tag.id,
 label: tag.label,
 items: bySubtag.get(tag.id) ?? [],
 }));
 if (sections.length > 0) return sections;
 if (filteredCapabilities.length > 0) {
 return [{ groupId: 'all', label: '', items: filteredCapabilities }] satisfies GroupSection[];
 }
 }

 if (
 (activeMajorCategory === 'marketing' || activeMajorCategory === 'geo') &&
 activeTaskGroup !== 'all'
 ) {
 return [{ groupId: 'all', label: '', items: filteredCapabilities }] satisfies GroupSection[];
 }
 if (activeMajorCategory === 'marketing' || activeMajorCategory === 'geo') {
 const groups = [...taskGroupsForStage].sort((a, b) => (a.group_order ?? 99) - (b.group_order ?? 99));
 const byGroup = new Map<string, CapabilityItem[]>();
 for (const item of filteredCapabilities) {
 const gid = item.task_group || 'general';
 if (!byGroup.has(gid)) byGroup.set(gid, []);
 byGroup.get(gid)!.push(item);
 }
 const sections = groups
 .filter((g) => (byGroup.get(g.id)?.length ?? 0) > 0)
 .map((g) => ({
 groupId: g.id,
 label: g.label,
 summary: g.summary,
 items: byGroup.get(g.id) ?? [],
 }));
 const generalItems = byGroup.get('general') ?? [];
 if (generalItems.length > 0 && !sections.some((s) => s.groupId === 'general')) {
 sections.push({
 groupId: 'general',
 label: groups.find((g) => g.id === 'general')?.label || t('taskGroupGeneral'),
 summary: groups.find((g) => g.id === 'general')?.summary,
 items: generalItems,
 });
 }
 return sections.length > 0
 ? sections
 : ([{ groupId: 'all', label: '', items: filteredCapabilities }] satisfies GroupSection[]);
 }

 return [{ groupId: 'all', label: '', items: filteredCapabilities }] satisfies GroupSection[];
 }, [
 activeMajorCategory,
 activeTaskGroup,
 activeCategorySubtag,
 categorySubtags,
 filteredCapabilities,
 taskGroupsForStage,
 t,
 isMobileShell,
 flywheelStages,
 geoFlywheelStages,
 educationBands,
 payload,
 query,
 visibilityMode,
 hubAdminMode,
 ]);

 const stageFilteredCount = useMemo(() => {
 if (isMobileShell) {
 return localizedPayload.capabilities.filter((item) =>
 capabilityMatchesMobileHubFilter(item, activeMajorCategory, hubAdminMode),
 ).length;
 }
 return localizedPayload.capabilities.filter((item) =>
 capabilityMatchesHubFilter(
 item,
 activeMajorCategory,
 activeStage,
 activeEducationBand,
 activeTaskGroup,
 activeCategorySubtag,
 ),
 ).length;
 }, [
 activeMajorCategory,
 activeStage,
 activeEducationBand,
 activeTaskGroup,
 activeCategorySubtag,
 localizedPayload.capabilities,
 isMobileShell,
 hubAdminMode,
 ]);

 const emptyBecauseFilter =
 hubVisibleCount > 0 && filteredCapabilities.length === 0;

 const bypassHubCollapse = hubAdminMode || Boolean(query.trim());

 const hubSectionGridClass = cn(
   'grid',
   visibilityMode
     ? 'grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
     : adminMode
       ? 'grid-cols-1 gap-1'
       : isMobileShell
         ? 'grid-cols-2 gap-1.5 px-3.5'
         : embedded
           ? 'grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4'
           : 'grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
 );

 const buildHubSectionKey = (groupId: string) =>
   [
     activeMajorCategory,
     activeStage,
     activeEducationBand,
     activeTaskGroup,
     activeCategorySubtag,
     groupId,
   ].join('::');

 const toggleHubSectionExpanded = (sectionKey: string) => {
   setExpandedHubSections((prev) => ({
     ...prev,
     [sectionKey]: !prev[sectionKey],
   }));
 };

 const activeStageMeta = activeStage
 ? (activeMajorCategory === 'geo'
 ? geoFlywheelStages.find((stage) => stage.id === activeStage) || null
 : activeMajorCategory === 'media'
 ? getMediaWorkflowSteps(
     activeTaskGroup !== 'all' ? activeTaskGroup : 'media_digital',
   ).find((step) => step.id === activeStage) || null
 : localizedPayload.stages.find((stage) => stage.id === activeStage) || null)
 : null;

 const activeFlywheelIndex =
 activeMajorCategory === 'marketing' &&
 MARKETING_FLYWHEEL_ORDER.includes(activeStage as (typeof MARKETING_FLYWHEEL_ORDER)[number])
 ? MARKETING_FLYWHEEL_ORDER.indexOf(activeStage as (typeof MARKETING_FLYWHEEL_ORDER)[number])
 : activeMajorCategory === 'geo' &&
 GEO_FLYWHEEL_ORDER.includes(activeStage as (typeof GEO_FLYWHEEL_ORDER)[number])
 ? GEO_FLYWHEEL_ORDER.indexOf(activeStage as (typeof GEO_FLYWHEEL_ORDER)[number])
 : -1;

 const activeFlywheelOrder =
 activeMajorCategory === 'geo' ? GEO_FLYWHEEL_ORDER : MARKETING_FLYWHEEL_ORDER;

 const isLastFlywheelStage = activeFlywheelIndex === activeFlywheelOrder.length - 1;

 const nextStageMeta = useMemo(() => {
 if (activeFlywheelIndex < 0) return null;
 if (isLastFlywheelStage) {
 if (activeMajorCategory === 'geo') {
 return geoFlywheelStages.find((stage) => stage.id === GEO_FLYWHEEL_ORDER[0]) ?? null;
 }
 return flywheelStages.find((stage) => stage.id === MARKETING_FLYWHEEL_ORDER[0]) ?? null;
 }
 const nextId = activeFlywheelOrder[activeFlywheelIndex + 1];
 if (activeMajorCategory === 'geo') {
 return geoFlywheelStages.find((stage) => stage.id === nextId) ?? null;
 }
 return flywheelStages.find((stage) => stage.id === nextId) ?? null;
 }, [activeFlywheelIndex, activeMajorCategory, activeFlywheelOrder, flywheelStages, geoFlywheelStages, isLastFlywheelStage]);

 const showComingSoonPlaceholder =
 (activeMajorCategory === 'marketing' || activeMajorCategory === 'geo' || activeMajorCategory === 'media') &&
 activeStageMeta &&
 (activeMajorCategory !== 'marketing' || activeStageMeta.id !== 'uncategorized') &&
 stageFilteredCount === 0 &&
 !query.trim() &&
 filteredCapabilities.length === 0;

 const handleUseExample = (item: CapabilityItem) => {
 const localized = localizeCapabilityFields(item, i18n.language);
 const prompt = resolveCapabilityTryPrompt(item, i18n.language);
 if (!prompt) return;
 if (!selectedProject) {
 window.alert(t('tryItNoProject'));
 return;
 }
 const capability = buildCapabilityBindingFromItem(item, localized.display_name);
 if (embedded && onTryPrompt) {
 onTryPrompt(prompt, capability);
 return;
 }
 requestCapabilityLaunch({
 slug: item.slug,
 displayName: localized.display_name,
 launchMode: capability.launchMode,
 prompt,
 capability,
 handlers: {
 onNeedNewSession: () => onStartNewSession?.(selectedProject),
 onSwitchToChat: () => onSwitchToChat?.(),
 },
 });
};

 const renderCapabilityCard = (item: CapabilityItem) => {
 const statusKey = STATUS_KEYS[item.status] || STATUS_KEYS.available;
 const status = item.status === 'available' || item.status === 'needs_config' ? item.status : 'pending';
 const badges: string[] = [];
 if (hubAdminMode && item.hidden_in_hub) {
 badges.push(t('adminHiddenBadge', { defaultValue: '前台隐藏' }));
 }
 if (hubAdminMode && item.scope === 'catalog') {
 badges.push(t('adminCatalogBadge', { defaultValue: '仅目录' }));
 }
 (item.secondary_categories || [])
 .filter((cat) => cat !== activeMajorCategory && SECONDARY_CATEGORY_LABELS[cat])
 .forEach((cat) => badges.push(SECONDARY_CATEGORY_LABELS[cat]));
 const capabilityHubVisible = visibilityMode && visibilityDoc
  ? isCapabilityDirectlyVisibleInHubAdmin(item, activeMajorCategory, visibilityDoc)
  : true;
 const categoryHiddenInHub = visibilityMode && visibilityDoc
  ? !isCategoryVisible(activeMajorCategory, visibilityDoc)
  : false;
 return (
 <CapabilityCard
 key={item.slug}
 icon={iconForCapability(item)}
 theme={themeForCapability(item)}
 title={capabilityCardTitle(item, i18n.language)}
 description={appendCapabilityPrerequisiteHint(
 resolveCapabilityDescription(item),
 item.slug,
 i18n.language,
 )}
 statusLabel={t(statusKey)}
 status={status}
 badges={badges}
 tryLabel={adminMode ? t('adminManage', { defaultValue: '管理' }) : t('tryIt')}
 rating={item.rating}
 disabled={!hubAdminMode && !visibilityMode && !selectedProject}
 disabledTitle={t('tryItNoProject')}
 hubVisible={capabilityHubVisible}
 onToggleHubVisible={
  visibilityMode && visibilityDoc && onVisibilityDocChange
   ? () => onVisibilityDocChange((prev) => toggleCapabilityVisibility(prev, item.slug))
   : undefined
 }
 hubVisibleLabel={
  categoryHiddenInHub
   ? '分类已隐藏，前台不可见'
   : capabilityHubVisible
   ? '前台可见，点击隐藏'
   : '前台隐藏，点击显示'
 }
 isFavorite={hubFavorites?.isCapabilityFavorite(item.slug)}
 onToggleFavorite={
  hubAdminMode || !hubFavorites
   ? undefined
   : () => hubFavorites.toggleCapabilityFavorite(item.slug)
 }
 favoriteLabel={
  hubFavorites?.isCapabilityFavorite(item.slug)
   ? th('favoriteRemove', { defaultValue: '从我的收藏移除' })
   : th('favoriteAdd', { defaultValue: '加入我的收藏' })
 }
 selected={adminMode && selectedManageSlug === item.slug}
 onUse={() => {
 if (adminMode) {
 onManageCapability?.(item);
 return;
 }
 handleUseExample(item);
 }}
 layout={isMobileShell ? 'mobile-grid' : 'compact'}
 />
 );
 };

 const goNextStage = () => {
 if (activeFlywheelIndex < 0) return;
 if (isLastFlywheelStage) {
 setActiveStage(activeFlywheelOrder[0]);
 return;
 }
 setActiveStage(activeFlywheelOrder[activeFlywheelIndex + 1]);
 };

 return (
 <div
 data-testid="capability-hub"
 className={cn(
 'flex h-full flex-col text-foreground',
 hubChromeAdmin ? 'bg-white text-[#2d3440]' : embedded ? 'bg-sidebar' : 'bg-gradient-to-b from-sidebar to-background',
 )}
 >
 <div
 className={cn(
 'shrink-0 border-b border-border/80',
 hubChromeAdmin
   ? 'px-2 py-2'
   : embedded
     ? 'px-5 py-3 max-md:px-3'
     : isMobileShell
       ? 'px-0 py-0'
       : 'px-6 py-4',
 )}
 >
 {!embedded ? (
 isMobileShell ? null : (
 <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
 <div className="flex min-w-0 items-baseline gap-2">
 <span className="flex items-center gap-2">
 <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <h1 className="text-[15px] font-medium tracking-tight">{t('title')}</h1>
 </span>
 <span className="text-[11px] text-muted-foreground">
 {t('totalCount')}
 {refreshing ? (
 <span className="ml-1.5 inline-flex items-center gap-1 text-muted-foreground/80">
 <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-border border-t-primary" />
 {t('refreshing')}
 </span>
 ) : null}
 </span>
 <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
 {t('flywheelIntro')}
 </span>
 </div>
 <div className="flex shrink-0 items-center gap-2">
 <label className="flex w-[200px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] shadow-sm">
 <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <input
 value={query}
 onChange={(event) => setQuery(event.target.value)}
 placeholder={t('searchPlaceholder')}
 className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
 />
 </label>
 {uncategorizedStage && (uncategorizedStage.count ?? 0) > 0 ? (
 <button
 type="button"
 onClick={() => setActiveStage('uncategorized')}
 className={cn(
 'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
 activeStage === 'uncategorized'
 ? 'border-primary/30 bg-primary text-primary-foreground'
 : 'border-border bg-card text-muted-foreground hover:bg-accent',
 )}
 >
 {t('uncategorized')} ({uncategorizedStage.count})
 </button>
 ) : null}
 </div>
 </div>
 )
 ) : (
 <input
 type="search"
 value={query}
 onChange={(event) => setQuery(event.target.value)}
 placeholder={t('searchPlaceholder')}
 className={cn(
 'w-full rounded-lg border border-border bg-card outline-none placeholder:text-muted-foreground focus:border-ring',
 adminMode
   ? 'mb-2 px-2 py-1.5 text-[11px]'
   : 'mb-3 px-3 py-2 text-sm',
 )}
 />
 )}

 <CapabilityHubCategoryNav
 variant="full"
 layout={hubChromeAdmin ? 'sidebar' : isMobileShell ? 'mobile' : 'desktop'}
 activeStage={activeStage}
 onStageChange={setActiveStage}
 flywheelStages={flywheelStages}
 geoFlywheelStages={geoFlywheelStages}
 educationStage={educationStage}
 educationBands={educationBands}
 activeEducationBand={activeEducationBand}
 onEducationBandChange={setActiveEducationBand}
 activeMajorCategory={activeMajorCategory}
 onMajorCategoryChange={(category) => {
 setActiveMajorCategory(category);
 setActiveStage(defaultStageForMajorCategory(category));
 setActiveTaskGroup(category === 'media' ? defaultMediaLaneForMajorCategory() : 'all');
 setActiveCategorySubtag('all');
 }}
 categorySubtagCounts={categorySubtagCounts}
 majorCategoryCounts={majorCategoryCounts}
 taskGroups={taskGroupsForStage}
 activeTaskGroup={activeTaskGroup}
 onTaskGroupChange={setActiveTaskGroup}
 taskGroupCounts={taskGroupCounts}
 categorySubtags={categorySubtags}
 activeCategorySubtag={activeCategorySubtag}
 onCategorySubtagChange={setActiveCategorySubtag}
 visibilityAdmin={
  visibilityMode && visibilityDoc && onVisibilityDocChange
   ? {
     isCategoryVisible: (categoryId) => isCategoryVisible(categoryId, visibilityDoc),
     onToggleCategory: (categoryId) => {
       onVisibilityDocChange((prev) => toggleCategoryVisibility(prev, categoryId));
     },
     isSubcategoryVisible: (key) => isSubcategoryVisible(key, visibilityDoc),
     onToggleSubcategory: (key) => {
       onVisibilityDocChange((prev) => toggleSubcategoryVisibility(prev, key));
     },
     subcategoryKeyForOption: (optionId) =>
       subcategoryKeyForNavOption(
         activeMajorCategory,
         optionId,
         activeStage,
         activeTaskGroup,
       ),
   }
   : undefined
 }
 hubVisibilityFilter={
  !visibilityMode && !hubAdminMode
   ? {
     isCategoryVisible: (categoryId) => isCategoryVisible(categoryId, effectiveHubVisibility),
     isSubcategoryVisible: (key) => isSubcategoryVisible(key, effectiveHubVisibility),
     subcategoryKeyForOption: (optionId) =>
       subcategoryKeyForNavOption(
         activeMajorCategory,
         optionId,
         activeStage,
         activeTaskGroup,
       ),
   }
   : undefined
 }
/>
 </div>

 <div className="flex min-h-0 flex-1 flex-col">

    <div
      className={cn(
        'min-h-0 flex-1 overflow-y-auto pb-4 pt-3',
        hubChromeAdmin ? 'px-2 pt-2' : isMobileShell ? 'px-0' : 'px-4 max-md:px-3',
        embedded && !hubChromeAdmin && 'bg-muted/25',
        hubChromeAdmin && 'bg-[#fafbfc]',
        visibilityMode && 'bg-muted/20',
      )}
    >
 {groupedCapabilities.map((section) => {
 const sectionKey = buildHubSectionKey(section.groupId);
 const split = splitHubSectionItems(section.items, {
   bypassCollapse: bypassHubCollapse,
   getDisplayName: (item) => capabilityCardTitle(item, i18n.language),
 });
 const sectionExpanded = Boolean(expandedHubSections[sectionKey]);
 const visibleItems =
   split.collapseActive && !sectionExpanded
     ? split.pinned
     : [...split.pinned, ...split.secondary];

 return (
 <div key={section.groupId} className={section.label && !hubChromeAdmin ? 'mb-4' : 'mb-2'}>
 {section.label && !hubChromeAdmin ? (
 <div
   className={cn(
     isMobileShell ? 'mb-1 px-3.5' : 'mb-2 px-1',
     isMobileShell && section.labelLevel === 'l2' && 'mt-2.5 first:mt-0',
     isMobileShell && section.labelLevel === 'l3' && 'mt-1',
   )}
 >
            <div className="flex flex-wrap items-center gap-2">
                {isMobileShell ? (
                <div className="flex shrink-0 items-baseline gap-1.5">
                <h2
                className={cn(
                  'tracking-tight',
                  section.labelLevel === 'l2'
                    ? 'text-[12px] font-semibold text-foreground'
                    : 'text-[11px] font-medium text-muted-foreground',
                )}
                >
                {section.label}
                </h2>
                {section.items.length > 0 ? (
                <span className="text-[10px] tabular-nums text-muted-foreground/50">
                {split.collapseActive
                  ? `${split.pinned.length}/${section.items.length}`
                  : section.items.length}
                </span>
                ) : null}
                </div>
                ) : (
                <button
                type="button"
                onClick={() => {
                if (activeMajorCategory === 'marketing') {
                setActiveTaskGroup(section.groupId);
                } else {
                setActiveCategorySubtag(section.groupId);
                }
                }}
                title={t('categorySubtagFilterLabel', { defaultValue: '选择子类' })}
                className="group/header flex shrink-0 items-baseline gap-1.5 rounded transition-colors"
                >
                <h2 className="text-[11px] font-medium tracking-tight text-muted-foreground transition-colors group-hover/header:text-foreground">
                {section.label}
                </h2>
                <span className="text-[10px] tabular-nums text-muted-foreground/50">
                {split.collapseActive
                  ? `${split.pinned.length}/${section.items.length}`
                  : section.items.length}
                </span>
                </button>
                )}
                {!isMobileShell && split.collapseActive ? (
                  <HubExpandMoreToggle
                    expanded={sectionExpanded}
                    count={split.secondary.length}
                    expandLabel={t('hubExpandMore', { defaultValue: '更多能力' })}
                    collapseLabel={t('hubCollapseMore', { defaultValue: '收起' })}
                    onToggle={() => toggleHubSectionExpanded(sectionKey)}
                  />
                ) : null}
                {!isMobileShell ? <span className="h-px min-w-4 flex-1 bg-border/50" aria-hidden /> : null}
            </div>
 </div>
 ) : split.collapseActive && !section.label ? (
   <div className="mb-2 flex justify-end px-1">
     <HubExpandMoreToggle
       expanded={sectionExpanded}
       count={split.secondary.length}
       expandLabel={t('hubExpandMore', { defaultValue: '更多能力' })}
       collapseLabel={t('hubCollapseMore', { defaultValue: '收起' })}
       onToggle={() => toggleHubSectionExpanded(sectionKey)}
     />
   </div>
 ) : null}
          {section.items.length > 0 ? (
          <div className={hubSectionGridClass}>
 {visibleItems.map((item) => renderCapabilityCard(item))}
 </div>
          ) : null}
 {split.collapseActive && sectionExpanded && split.secondary.length > 0 ? (
   <div className="mt-2">
     <p className="mb-1.5 px-1 text-[10px] text-muted-foreground/70">
       {t('hubSecondaryHint', { defaultValue: '补充能力' })}
     </p>
     <div className={cn(hubSectionGridClass, 'opacity-[0.92]')}>
       {split.secondary.map((item) => renderCapabilityCard(item))}
     </div>
   </div>
 ) : null}
 </div>
 );
 })}

 {showComingSoonPlaceholder ? (
 <article className="flex flex-col rounded-lg border border-dashed border-border bg-sidebar/50 p-3">
 <h3 className="mb-1 text-[12px] font-medium text-foreground">{t('comingSoonTitle')}</h3>
 <p className="mb-2 flex-1 text-[11px] leading-relaxed text-muted-foreground">
 {t('comingSoonBody')}
 </p>
 <span className="text-[10px] text-muted-foreground">{t('comingSoonHint')}</span>
 </article>
 ) : null}

 {filteredCapabilities.length === 0 && !showComingSoonPlaceholder ? (
 <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center">
 {hubVisibleCount === 0 ? (
 <>
 <p className="text-sm text-muted-foreground">
 {loadError || t('empty.noData')}
 </p>
 <p className="mt-1 text-xs text-muted-foreground">{t('empty.noDataHint')}</p>
 </>
 ) : (
 <>
 <p className="text-sm text-muted-foreground">
 {emptyBecauseFilter ? t('empty.filtered') : t('empty.stageEmpty')}
 </p>
 <p className="mt-1 text-xs text-muted-foreground">
 {query.trim() ? t('empty.filteredHintSearch') : t('empty.filteredHintStage')}
 </p>
 {emptyBecauseFilter ? (
 <button
 type="button"
 onClick={clearFilters}
 className="mt-4 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-sidebar"
 >
 {t('empty.clearFilters')}
 </button>
 ) : null}
 </>
 )}
 </div>
 ) : null}
 </div>

 {!embedded && activeStageMeta && activeFlywheelIndex >= 0 && !isMobileShell ? (
 <div className="flex shrink-0 items-center justify-between border-t border-border bg-card/80 px-6 py-3 backdrop-blur-sm">
 <span className="max-w-[60%] text-xs text-muted-foreground">
 {isLastFlywheelStage
 ? t('nav.lastStage')
 : t('nav.continue', {
 from: activeStageMeta.label,
 to: nextStageMeta?.label ?? '',
 })}
 </span>
 <button
 type="button"
 onClick={goNextStage}
 className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-sidebar"
 >
 {isLastFlywheelStage ? (
 <>
 <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
 {t('nav.backToStart')}
 </>
 ) : (
 <>
 {t('nav.next', { stage: nextStageMeta?.label ?? '' })}
 <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
 </>
 )}
 </button>
 </div>
 ) : null}
 </div>
 </div>
 );
}
