/**
 * PD-SAAS-FORK: 能力中心 / 全案模板 分级可见性（分类 → 子分类 → 能力/模板）
 * 缺省均为可见；显式 false 表示隐藏。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLYWHEEL_STAGE_IDS,
  FLYWHEEL_TASK_GROUPS,
  GEO_TASK_GROUPS,
  MAJOR_CATEGORIES,
  matchesMajorCategory,
} from './capabilityHubTaxonomy.mjs';

const EDUCATION_BAND_IDS = ['preschool', 'primary', 'junior', 'senior', 'higher', 'academic_research'];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HUB_VISIBILITY_PATH = path.join(ROOT, 'config', 'hub-visibility.json');

const EMPTY_DOC = {
  version: 1,
  updatedAt: null,
  categories: {},
  subcategories: {},
  capabilities: {},
  templates: {},
  templateGroups: {},
};

let cachedDoc = null;
let cachedMtimeMs = -1;

export function normalizeHubVisibilityDoc(raw) {
  const doc = { ...EMPTY_DOC, ...(raw && typeof raw === 'object' ? raw : {}) };
  doc.categories = doc.categories && typeof doc.categories === 'object' ? doc.categories : {};
  doc.subcategories = doc.subcategories && typeof doc.subcategories === 'object' ? doc.subcategories : {};
  doc.capabilities = doc.capabilities && typeof doc.capabilities === 'object' ? doc.capabilities : {};
  doc.templates = doc.templates && typeof doc.templates === 'object' ? doc.templates : {};
  doc.templateGroups = doc.templateGroups && typeof doc.templateGroups === 'object' ? doc.templateGroups : {};
  return doc;
}

export function loadHubVisibility(force = false) {
  try {
    const stats = fs.statSync(HUB_VISIBILITY_PATH);
    if (!force && cachedDoc && stats.mtimeMs === cachedMtimeMs) {
      return cachedDoc;
    }
    const parsed = JSON.parse(fs.readFileSync(HUB_VISIBILITY_PATH, 'utf8'));
    cachedDoc = normalizeHubVisibilityDoc(parsed);
    cachedMtimeMs = stats.mtimeMs;
    return cachedDoc;
  } catch {
    cachedDoc = normalizeHubVisibilityDoc(null);
    cachedMtimeMs = -1;
    return cachedDoc;
  }
}

export function saveHubVisibility(nextDoc) {
  const doc = normalizeHubVisibilityDoc(nextDoc);
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(HUB_VISIBILITY_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  cachedDoc = doc;
  cachedMtimeMs = fs.statSync(HUB_VISIBILITY_PATH).mtimeMs;
  return doc;
}

export function mergeHubVisibilityPatch(current, patch) {
  const base = normalizeHubVisibilityDoc(current);
  const incoming = normalizeHubVisibilityDoc(patch);
  const mergeMap = (target, source) => {
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined) {
        delete target[key];
      } else {
        target[key] = Boolean(value);
      }
    }
  };
  const next = {
    ...base,
    categories: { ...base.categories },
    subcategories: { ...base.subcategories },
    capabilities: { ...base.capabilities },
    templates: { ...base.templates },
    templateGroups: { ...base.templateGroups },
  };
  mergeMap(next.categories, incoming.categories);
  mergeMap(next.subcategories, incoming.subcategories);
  mergeMap(next.capabilities, incoming.capabilities);
  mergeMap(next.templates, incoming.templates);
  mergeMap(next.templateGroups, incoming.templateGroups);
  return next;
}

export function isCategoryVisible(majorId, doc = loadHubVisibility()) {
  return doc.categories[majorId] !== false;
}

export function isSubcategoryVisible(subKey, doc = loadHubVisibility()) {
  return doc.subcategories[subKey] !== false;
}

export function isCapabilitySlugVisible(slug, doc = loadHubVisibility()) {
  return doc.capabilities[slug] !== false;
}

export function isTemplateVisible(templateId, doc = loadHubVisibility()) {
  if (doc.templates[templateId] === false) return false;
  return true;
}

export function isTemplateGroupVisible(groupId, doc = loadHubVisibility()) {
  return doc.templateGroups[groupId] !== false;
}

export function resolveCapabilityMajorCategories(item) {
  const majors = new Set();
  if (item.major_category) majors.add(item.major_category);
  if (Array.isArray(item.secondary_categories)) {
    for (const cat of item.secondary_categories) {
      if (typeof cat === 'string' && cat.trim()) majors.add(cat.trim());
    }
  }
  if (item.stage === 'enterprise_compliance') majors.add('enterprise_compliance');
  if (item.stage === 'education') majors.add('education');
  if (item.stage === 'brainstorming') majors.add('brainstorming');
  if (item.stage === 'finance') majors.add('finance');
  if (majors.size === 0) majors.add('marketing');
  return Array.from(majors);
}

export function resolveSubcategoryKeysForCapability(item, majorCategory) {
  const keys = [];
  if (!matchesMajorCategory(majorCategory, item)) return keys;

  if (majorCategory === 'marketing') {
    const stages = new Set([item.stage, ...(item.secondary_stages || [])].filter(Boolean));
    for (const stageId of stages) {
      if (!FLYWHEEL_STAGE_IDS.includes(stageId)) continue;
      const groups = new Set([item.task_group || 'general', ...(item.secondary_task_groups || [])]);
      for (const groupId of groups) {
        keys.push(`marketing:${stageId}:${groupId}`);
      }
    }
    return keys;
  }

  if (majorCategory === 'geo') {
    const geoStage = item.geo_stage || 'geo_baseline';
    const groups = new Set([item.task_group || 'general', ...(item.secondary_task_groups || [])]);
    for (const groupId of groups) {
      keys.push(`geo:${geoStage}:${groupId}`);
    }
    return keys;
  }

  if (majorCategory === 'media') {
    const lanes = new Set([item.media_lane, ...(item.secondary_media_lanes || [])].filter(Boolean));
    const steps = new Set([item.media_workflow_step, ...(item.secondary_media_workflow_steps || [])].filter(Boolean));
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
    const bands = item.education_bands?.length ? item.education_bands : EDUCATION_BAND_IDS;
    for (const bandId of bands) keys.push(`education:${bandId}`);
    return keys;
  }

  if (majorCategory === 'brainstorming') {
    const subtag = item.category_subtag || 'general';
    keys.push(`brainstorming:${subtag}`);
    return keys;
  }

  const subtag = item.category_subtag || 'general';
  keys.push(`${majorCategory}:${subtag}`);
  return keys;
}

export function isCapabilityVisibleInMajor(item, majorCategory, doc = loadHubVisibility()) {
  if (!isCategoryVisible(majorCategory, doc)) return false;
  const subKeys = resolveSubcategoryKeysForCapability(item, majorCategory);
  if (subKeys.length === 0) return true;
  return subKeys.some((key) => isSubcategoryVisible(key, doc));
}

export function isCapabilityDirectlyVisibleInHubAdmin(item, majorCategory, doc = loadHubVisibility()) {
  if (item.hidden_in_hub) return false;
  if (!item.slug || !isCapabilitySlugVisible(item.slug, doc)) return false;
  const subKeys = resolveSubcategoryKeysForCapability(item, majorCategory);
  if (subKeys.length === 0) return true;
  return subKeys.some((key) => isSubcategoryVisible(key, doc));
}

export function isCapabilityVisibleForHubAdmin(item, majorCategory, doc = loadHubVisibility()) {
  if (!isCategoryVisible(majorCategory, doc)) return false;
  return isCapabilityDirectlyVisibleInHubAdmin(item, majorCategory, doc);
}

export function isCapabilityVisibleInHub(item, doc = loadHubVisibility()) {
  if (item.hidden_in_hub) return false;
  if (!isCapabilitySlugVisible(item.slug, doc)) return false;
  const majors = resolveCapabilityMajorCategories(item);
  return majors.some((major) => isCapabilityVisibleInMajor(item, major, doc));
}

export function filterCapabilitiesByHubVisibility(capabilities, doc = loadHubVisibility()) {
  return capabilities.filter((cap) => isCapabilityVisibleInHub(cap, doc));
}

export function filterTemplatesByHubVisibility(templates, doc = loadHubVisibility()) {
  return templates.filter((template) => {
    // Prefer category L2 keys (templates:marketing|enterprise|…); legacy complexity keys ignored when empty.
    const groupId = `templates:${template.category || template.complexity || 'marketing'}`;
    if (!isTemplateGroupVisible(groupId, doc)) return false;
    return isTemplateVisible(template.id, doc);
  });
}

/** 供后台树构建：列出所有子分类节点 id */
export function listHubSubcategoryNodeIds() {
  const ids = [];
  for (const stageId of FLYWHEEL_STAGE_IDS) {
    for (const group of FLYWHEEL_TASK_GROUPS[stageId] || []) {
      ids.push(`marketing:${stageId}:${group.id}`);
    }
  }
  for (const [geoStage, groups] of Object.entries(GEO_TASK_GROUPS)) {
    for (const group of groups) ids.push(`geo:${geoStage}:${group.id}`);
  }
  for (const major of ['office', 'creation', 'development', 'brainstorming', 'finance', 'enterprise_compliance']) {
    const subtags = MAJOR_CATEGORIES[major]?.subtags || [];
    for (const sub of subtags) ids.push(`${major}:${sub.id}`);
  }
  for (const bandId of EDUCATION_BAND_IDS) ids.push(`education:${bandId}`);
  return ids;
}

export function invalidateHubVisibilityCache() {
  cachedDoc = null;
  cachedMtimeMs = -1;
}
