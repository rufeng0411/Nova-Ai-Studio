/** PD-SAAS-FORK: 能力中心 / 全案模板分级可见性（客户端） */
import { authenticatedFetch } from '../utils/api.js';
import {
  GEO_FLYWHEEL_ORDER,
  MARKETING_FLYWHEEL_ORDER,
} from './capabilityHubTheme.js';
import type { HubMajorCategory } from './capabilityHubTaxonomy.js';
import { matchesMajorCategory } from './capabilityHubTaxonomy.js';

const EDUCATION_BAND_IDS = ['preschool', 'primary', 'junior', 'senior', 'higher', 'academic_research'] as const;

export type HubVisibilityDoc = {
  version: number;
  updatedAt: string | null;
  categories: Record<string, boolean>;
  subcategories: Record<string, boolean>;
  capabilities: Record<string, boolean>;
  templates: Record<string, boolean>;
  templateGroups: Record<string, boolean>;
};

export type HubVisibilityDocUpdater =
  | HubVisibilityDoc
  | ((prev: HubVisibilityDoc) => HubVisibilityDoc);

export const EMPTY_HUB_VISIBILITY: HubVisibilityDoc = {
  version: 1,
  updatedAt: null,
  categories: {},
  subcategories: {},
  capabilities: {},
  templates: {},
  templateGroups: {},
};

export function normalizeHubVisibilityDoc(raw: unknown): HubVisibilityDoc {
  const doc = { ...EMPTY_HUB_VISIBILITY, ...(raw && typeof raw === 'object' ? raw as HubVisibilityDoc : {}) };
  return {
    ...doc,
    categories: doc.categories ?? {},
    subcategories: doc.subcategories ?? {},
    capabilities: doc.capabilities ?? {},
    templates: doc.templates ?? {},
    templateGroups: doc.templateGroups ?? {},
  };
}

export function isCategoryVisible(majorId: string, doc: HubVisibilityDoc): boolean {
  return doc.categories[majorId] !== false;
}

export function isSubcategoryVisible(subKey: string, doc: HubVisibilityDoc): boolean {
  return doc.subcategories[subKey] !== false;
}

export function isCapabilitySlugVisible(slug: string, doc: HubVisibilityDoc): boolean {
  return doc.capabilities[slug] !== false;
}

export function isTemplateVisible(templateId: string, doc: HubVisibilityDoc): boolean {
  return doc.templates[templateId] !== false;
}

export function isTemplateGroupVisible(groupId: string, doc: HubVisibilityDoc): boolean {
  return doc.templateGroups[groupId] !== false;
}

export function resolveSubcategoryKeysForCapability(
  item: HubVisibilityCapability,
  majorCategory: HubMajorCategory,
): string[] {
  const keys: string[] = [];
  if (!matchesMajorCategory(majorCategory, item)) return keys;

  if (majorCategory === 'marketing') {
    const stages = new Set([item.stage, ...(item.secondary_stages ?? [])].filter(Boolean));
    for (const stageId of stages) {
      if (!MARKETING_FLYWHEEL_ORDER.includes(stageId as typeof MARKETING_FLYWHEEL_ORDER[number])) continue;
      const groups = new Set([item.task_group || 'general', ...(item.secondary_task_groups ?? [])]);
      for (const groupId of groups) {
        keys.push(`marketing:${stageId}:${groupId}`);
      }
    }
    return keys;
  }

  if (majorCategory === 'geo') {
    const geoStage = item.geo_stage || 'geo_baseline';
    const groups = new Set([item.task_group || 'general', ...(item.secondary_task_groups ?? [])]);
    for (const groupId of groups) {
      keys.push(`geo:${geoStage}:${groupId}`);
    }
    return keys;
  }

  if (majorCategory === 'media') {
    const lanes = new Set([item.media_lane, ...(item.secondary_media_lanes ?? [])].filter(Boolean));
    const steps = new Set([
      item.media_workflow_step,
      ...(item.secondary_media_workflow_steps ?? []),
    ].filter(Boolean));
    if (lanes.size === 0) lanes.add('media_digital');
    for (const lane of lanes) {
      if (steps.size === 0) {
        keys.push(`media:${lane}:all`);
      } else {
        for (const step of steps) keys.push(`media:${lane}:${step}`);
      }
    }
    return keys;
  }

  if (majorCategory === 'education') {
    const bands = item.education_bands?.length ? item.education_bands : [...EDUCATION_BAND_IDS];
    for (const bandId of bands) keys.push(`education:${bandId}`);
    return keys;
  }

  if (majorCategory === 'brainstorming') {
    keys.push(`brainstorming:${item.category_subtag || 'general'}`);
    return keys;
  }

  const subtag = item.category_subtag || 'general';
  keys.push(`${majorCategory}:${subtag}`);
  return keys;
}

export function resolveActiveSubcategoryKey(
  majorCategory: HubMajorCategory,
  activeStage: string,
  activeTaskGroup: string | 'all',
  activeCategorySubtag: string | 'all',
  activeEducationBand: string | 'all',
): string | null {
  if (majorCategory === 'marketing') {
    if (activeStage === 'all' || activeTaskGroup === 'all') return null;
    return `marketing:${activeStage}:${activeTaskGroup}`;
  }
  if (majorCategory === 'geo') {
    if (activeStage === 'all' || activeTaskGroup === 'all') return null;
    return `geo:${activeStage}:${activeTaskGroup}`;
  }
  if (majorCategory === 'media') {
    const lane = activeTaskGroup !== 'all' ? activeTaskGroup : 'media_digital';
    if (activeStage === 'all') return `media:${lane}:all`;
    return `media:${lane}:${activeStage}`;
  }
  if (majorCategory === 'education') {
    if (activeEducationBand === 'all') return null;
    return `education:${activeEducationBand}`;
  }
  if (
    majorCategory === 'office'
    || majorCategory === 'creation'
    || majorCategory === 'development'
    || majorCategory === 'brainstorming'
    || majorCategory === 'finance'
    || majorCategory === 'enterprise_compliance'
  ) {
    if (activeCategorySubtag === 'all') return null;
    return `${majorCategory}:${activeCategorySubtag}`;
  }
  return null;
}

export function subcategoryKeyForNavOption(
  majorCategory: HubMajorCategory,
  optionId: string,
  activeStage: string,
  activeTaskGroup: string | 'all',
): string | null {
  if (optionId === 'all') return null;
  if (majorCategory === 'marketing' || majorCategory === 'geo') {
    const stageId = activeStage === 'all' ? (majorCategory === 'geo' ? GEO_FLYWHEEL_ORDER[0] : MARKETING_FLYWHEEL_ORDER[0]) : activeStage;
    return `${majorCategory}:${stageId}:${optionId}`;
  }
  if (majorCategory === 'media') {
    const lane = activeTaskGroup !== 'all' ? activeTaskGroup : 'media_digital';
    return `media:${lane}:${optionId}`;
  }
  if (majorCategory === 'education') {
    return `education:${optionId}`;
  }
  return `${majorCategory}:${optionId}`;
}

export function isCapabilityDirectlyVisibleInHubAdmin(
  item: HubVisibilityCapability,
  majorCategory: HubMajorCategory,
  doc: HubVisibilityDoc,
): boolean {
  if (item.hidden_in_hub) return false;
  if (!item.slug || !isCapabilitySlugVisible(item.slug, doc)) return false;
  const subKeys = resolveSubcategoryKeysForCapability(item, majorCategory);
  if (subKeys.length === 0) return true;
  return subKeys.some((key) => isSubcategoryVisible(key, doc));
}

export function isCapabilityVisibleForHubAdmin(
  item: HubVisibilityCapability,
  majorCategory: HubMajorCategory,
  doc: HubVisibilityDoc,
): boolean {
  if (!isCategoryVisible(majorCategory, doc)) return false;
  return isCapabilityDirectlyVisibleInHubAdmin(item, majorCategory, doc);
}

export function patchHubVisibilityEntry(
  doc: HubVisibilityDoc,
  section: keyof Pick<HubVisibilityDoc, 'categories' | 'subcategories' | 'capabilities' | 'templates' | 'templateGroups'>,
  key: string,
  visible: boolean,
): HubVisibilityDoc {
  const next = normalizeHubVisibilityDoc(doc);
  const map = { ...next[section] };
  if (visible) {
    delete map[key];
  } else {
    map[key] = false;
  }
  return { ...next, [section]: map };
}

export function toggleCategoryVisibility(doc: HubVisibilityDoc, categoryId: string): HubVisibilityDoc {
  const visible = !isCategoryVisible(categoryId, doc);
  return patchHubVisibilityEntry(doc, 'categories', categoryId, visible);
}

export function toggleSubcategoryVisibility(doc: HubVisibilityDoc, subKey: string): HubVisibilityDoc {
  const visible = !isSubcategoryVisible(subKey, doc);
  return patchHubVisibilityEntry(doc, 'subcategories', subKey, visible);
}

export function toggleCapabilityVisibility(doc: HubVisibilityDoc, slug: string): HubVisibilityDoc {
  const visible = !isCapabilitySlugVisible(slug, doc);
  return patchHubVisibilityEntry(doc, 'capabilities', slug, visible);
}

export function toggleTemplateVisibility(doc: HubVisibilityDoc, templateId: string): HubVisibilityDoc {
  const visible = !isTemplateVisible(templateId, doc);
  return patchHubVisibilityEntry(doc, 'templates', templateId, visible);
}

export function toggleTemplateGroupVisibility(doc: HubVisibilityDoc, groupId: string): HubVisibilityDoc {
  const visible = !isTemplateGroupVisible(groupId, doc);
  return patchHubVisibilityEntry(doc, 'templateGroups', groupId, visible);
}

export type HubVisibilityCapability = {
  slug?: string;
  hidden_in_hub?: boolean;
  major_category?: string;
  secondary_categories?: string[];
  stage?: string;
  geo_stage?: string;
  task_group?: string;
  secondary_stages?: string[];
  secondary_task_groups?: string[];
  category_subtag?: string;
  education_bands?: string[];
  media_lane?: string;
  secondary_media_lanes?: string[];
  media_workflow_step?: string;
  secondary_media_workflow_steps?: string[];
};

export function resolveCapabilityMajorCategories(item: HubVisibilityCapability): string[] {
  const majors = new Set<string>();
  if (item.major_category) majors.add(item.major_category);
  for (const cat of item.secondary_categories ?? []) {
    if (cat.trim()) majors.add(cat.trim());
  }
  if (item.stage === 'enterprise_compliance') majors.add('enterprise_compliance');
  if (item.stage === 'education') majors.add('education');
  if (item.stage === 'brainstorming') majors.add('brainstorming');
  if (item.stage === 'finance') majors.add('finance');
  if (majors.size === 0) majors.add('marketing');
  return Array.from(majors);
}

export function isCapabilityVisibleInMajor(
  item: HubVisibilityCapability,
  majorCategory: HubMajorCategory,
  doc: HubVisibilityDoc,
  resolveSubKeys: (item: HubVisibilityCapability, major: HubMajorCategory) => string[],
): boolean {
  if (!isCategoryVisible(majorCategory, doc)) return false;
  const subKeys = resolveSubKeys(item, majorCategory);
  if (subKeys.length === 0) return true;
  return subKeys.some((key) => isSubcategoryVisible(key, doc));
}

export function isCapabilityVisibleInHub(
  item: HubVisibilityCapability,
  doc: HubVisibilityDoc,
  resolveSubKeys: (item: HubVisibilityCapability, major: HubMajorCategory) => string[] = resolveSubcategoryKeysForCapability,
): boolean {
  if (item.hidden_in_hub) return false;
  if (!item.slug || !isCapabilitySlugVisible(item.slug, doc)) return false;
  const majors = resolveCapabilityMajorCategories(item);
  return majors.some((major) =>
    isCapabilityVisibleInMajor(item, major as HubMajorCategory, doc, resolveSubKeys),
  );
}

export async function fetchHubVisibility(): Promise<HubVisibilityDoc> {
  try {
    const res = await authenticatedFetch('/api/capabilities/hub-visibility');
    if (!res.ok) return EMPTY_HUB_VISIBILITY;
    return normalizeHubVisibilityDoc(await res.json());
  } catch {
    return EMPTY_HUB_VISIBILITY;
  }
}

export async function saveHubVisibilityAdmin(patch: Partial<HubVisibilityDoc>): Promise<HubVisibilityDoc> {
  const res = await authenticatedFetch('/api/capabilities/admin/hub-visibility', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(typeof body.error === 'string' ? body.error : '保存失败');
  }
  return normalizeHubVisibilityDoc(await res.json());
}
