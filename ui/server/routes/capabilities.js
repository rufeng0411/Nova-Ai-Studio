import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPilotDeckGateway, getPilotDeckGatewayIfReady } from '../pilotdeck-bridge.js';
import { reloadGatewayExtensionsBestEffort } from '../utils/reloadGatewayExtensionsBestEffort.js';
import { resolvePilotHome } from '../utils/pilotPaths.js';
import { isSaasMode } from '../saas/mode.js';
import { isCommunityPersonal } from '../saas/communityPersonal.js';
import { getLegacyPilotHome } from '../saas/legacyBridge.js';
import { compareCapabilitiesForHub } from '../../../scripts/lib/capabilityHubSort.mjs';
import { applyTaxonomyToSkill, matchesMajorCategory } from '../../../scripts/lib/capabilityHubTaxonomy.mjs';
import {
  filterCapabilitiesByHubVisibility,
  loadHubVisibility,
  normalizeHubVisibilityDoc,
  saveHubVisibility,
  invalidateHubVisibilityCache,
} from '../../../scripts/lib/hubVisibility.mjs';
import {
  findUserGroupById,
  loadUserGroupPermissions,
  normalizeUserGroupPermissionsDoc,
  resolveEffectiveHubVisibilityForGroupId,
  saveUserGroupPermissions,
  invalidateUserGroupPermissionsCache,
} from '../../../scripts/lib/userGroupPermissions.mjs';
import { controlUserDb } from '../saas/db/control.js';
import {
  loadPlatformFeatures,
  normalizeBooleanFeature,
  normalizePreflightStudioMode,
  readBentoDeckEditorEnvOverride,
  readMdBrowserToolEnvOverride,
  readN2BotEnvOverride,
  resolveBentoDeckEditorEnabledEffective,
  resolveMdBrowserToolEnabledEffective,
  resolveN2BotModeEffective,
  resolvePreflightStudioModeEffective,
  savePlatformFeatures,
} from '../../../scripts/lib/platformFeatures.mjs';
import {
  emitMcpFeatureGateEvent,
  isHubSlugMcpFeatureAllowed,
  normalizeMcpFeaturesDoc,
  readBatch1McpEnvOverrides,
  resolveAllBatch1McpFeaturesEffective,
} from '../../../scripts/lib/mcpFeatureFlags.mjs';
import { buildWelcomePromptResponse } from '../../../scripts/lib/welcomePromptPool.mjs';
import { capabilitiesHubKey, capabilitiesHubKeyPattern } from '../saas/cache/cacheKeys.js';
import { cacheDelByPattern, cacheGet, cacheSet, getDefaultTtl } from '../saas/cache/redisClient.js';
import { getSaasRequestContext } from '../saas/context.js';
import { requireAdmin } from '../saas/middleware/requireAdmin.js';
import { execFile } from '../utils/childProcess.js';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
// PD-SAAS-FORK: Legacy Bridge — capabilities/skills discovery stays on ~/.pilotdeck.
const PILOT_HOME = isSaasMode() ? getLegacyPilotHome(process.env) : resolvePilotHome(process.env);
const GENERAL_CWD_PATHS = [path.resolve(PILOT_HOME)];
const CATALOG_PATH = path.join(REPO_ROOT, 'config', 'capabilities.catalog.json');
const OVERRIDES_PATH = path.join(REPO_ROOT, 'config', 'capabilities.overrides.json');
const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const I18N_PATH = path.join(REPO_ROOT, 'config', 'capabilities.i18n.json');
const DEFAULT_STAGE = {
  id: 'uncategorized',
  label: '待归类',
  stage_order: 7,
  summary: '未映射能力，待人工补充',
};

let cachedCatalogMtimeMs = -1;
let cachedCatalog = null;
let cachedI18nMtimeMs = -1;
let cachedI18n = null;

// PD-SAAS-FORK: hub list cache — invalidate when catalog mtime or runtime skills revision changes
const hubResponseCache = new Map();
const HUB_RESPONSE_CACHE_MAX = 48;

function computeSkillsRevision(runtimeSkills) {
  const slugs = runtimeSkills
    .map((skill) => String(skill?.slug || skill?.name || '').trim())
    .filter(Boolean)
    .sort();
  return crypto.createHash('sha256').update(slugs.join('\n')).digest('hex').slice(0, 16);
}

function hubResponseCacheKey(
  projectPath,
  locale,
  catalogMtimeMs,
  skillsRevision,
  hubVisibilityUpdatedAt,
  userGroupId,
  userGroupPermissionsUpdatedAt,
) {
  const vis = hubVisibilityUpdatedAt || 'none';
  const group = userGroupId || 'normal';
  const groupVis = userGroupPermissionsUpdatedAt || 'none';
  return `${projectPath || ''}|${normalizeLocale(locale)}|${catalogMtimeMs}|${skillsRevision}|${vis}|${group}|${groupVis}`;
}

async function resolveRequestHubVisibility(req, adminMode) {
  const global = loadHubVisibility();
  if (adminMode) {
    return {
      visibility: global,
      groupId: null,
      groupPermissionsUpdatedAt: loadUserGroupPermissions().updatedAt || 'none',
    };
  }
  if (!isSaasMode()) {
    return {
      visibility: global,
      groupId: 'normal',
      groupPermissionsUpdatedAt: loadUserGroupPermissions().updatedAt || 'none',
    };
  }
  const saasCtx = getSaasRequestContext();
  const role = saasCtx?.role || req.user?.role;
  if (role === 'super-admin' || role === 'admin') {
    return {
      visibility: global,
      groupId: 'normal',
      groupPermissionsUpdatedAt: loadUserGroupPermissions().updatedAt || 'none',
    };
  }
  const ctx = resolveCacheUserContext(req);
  const userId = Number(ctx.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return {
      visibility: global,
      groupId: 'normal',
      groupPermissionsUpdatedAt: loadUserGroupPermissions().updatedAt || 'none',
    };
  }
  const groupId = await controlUserDb.getUserGroupId(userId);
  const resolved = resolveEffectiveHubVisibilityForGroupId(groupId, global);
  return {
    visibility: resolved.visibility,
    groupId,
    groupPermissionsUpdatedAt: resolved.groupPermissionsUpdatedAt,
  };
}

function rememberHubResponse(cacheKey, payload) {
  hubResponseCache.set(cacheKey, payload);
  if (hubResponseCache.size <= HUB_RESPONSE_CACHE_MAX) return;
  const oldest = hubResponseCache.keys().next().value;
  if (oldest) hubResponseCache.delete(oldest);
}

function resolveCacheUserContext(req) {
  const saas = isSaasMode() ? getSaasRequestContext() : null;
  return {
    tenantId: saas?.tenantId ?? req.user?.tenantId ?? 'platform',
    userId: saas?.userId ?? req.user?.id ?? 'anon',
  };
}

async function rememberHubResponseRedis(redisKey, payload) {
  await cacheSet(redisKey, payload, getDefaultTtl('capabilities'));
}

async function readHubResponseRedis(redisKey) {
  const cached = await cacheGet(redisKey);
  return cached && typeof cached === 'object' ? cached : null;
}

function normalizeLocale(raw) {
  // PD-SAAS-FORK: 未传 locale 时默认中文
  if (typeof raw !== 'string' || !raw.trim()) return 'zh-CN';
  const value = raw.trim().toLowerCase();
  if (value.startsWith('zh')) return 'zh-CN';
  return 'en';
}

function loadI18n() {
  try {
    const stats = fs.statSync(I18N_PATH);
    if (cachedI18n && stats.mtimeMs === cachedI18nMtimeMs) {
      return cachedI18n;
    }
    cachedI18n = JSON.parse(fs.readFileSync(I18N_PATH, 'utf8'));
    cachedI18nMtimeMs = stats.mtimeMs;
    return cachedI18n;
  } catch (error) {
    console.warn('[capabilities] failed to load i18n bundle:', error instanceof Error ? error.message : error);
    return { stages: {}, skills: {} };
  }
}

function localizeStage(stage, locale, i18n) {
  const lang = normalizeLocale(locale);
  const localized = i18n?.stages?.[stage.id]?.[lang];
  if (!localized) return stage;
  return {
    ...stage,
    label: localized.label || stage.label,
    summary: localized.summary || stage.summary,
  };
}

function localizeCapability(capability, locale, i18n) {
  const lang = normalizeLocale(locale);
  const localized = i18n?.skills?.[capability.slug]?.[lang];
  if (!localized) return capability;
  return {
    ...capability,
    display_name: localized.display_name || capability.display_name,
    task_summary: localized.task_summary || capability.task_summary,
    description: localized.description || capability.description,
    setup_hint: localized.setup_hint || capability.setup_hint,
    examples: Array.isArray(localized.examples) && localized.examples.length > 0
      ? localized.examples
      : capability.examples,
  };
}

function isCatalogOnlyEntry(catalogItem) {
  const source = String(catalogItem?.source || '');
  return source.startsWith('virtual:') || source.startsWith('builtin:') || source.startsWith('mcp:');
}

function resolveCatalogStatus(catalogItem, runtimeAvailable) {
  if (runtimeAvailable) return 'available';
  const availability = catalogItem?.availability || 'available';
  if (availability === 'needs_config') return 'needs_config';
  return 'pending';
}

// PD-SAAS-FORK: 合并 runtime 与 catalog 后统一套用 taxonomy，避免 task_group / major_category 丢失
function finalizeCapability(raw, catalogIndex) {
  const enriched = applyTaxonomyToSkill({
    slug: raw.slug,
    stage: raw.stage,
    task_group: raw.task_group,
    major_category: raw.major_category,
    geo_stage: raw.geo_stage,
    secondary_categories: raw.secondary_categories,
    secondary_stages: raw.secondary_stages,
    secondary_task_groups: raw.secondary_task_groups,
    category_subtag: raw.category_subtag,
    hidden_in_hub: raw.hidden_in_hub,
    availability: raw.availability,
    hub_recommend_stars: raw.hub_recommend_stars,
  });
  const stageMeta = catalogIndex.stageMap.get(enriched.stage) || catalogIndex.stageMap.get(DEFAULT_STAGE.id) || DEFAULT_STAGE;
  return {
    ...raw,
    stage: enriched.stage,
    stage_label: stageMeta.label || raw.stage_label,
    stage_order: stageMeta.stage_order ?? raw.stage_order ?? DEFAULT_STAGE.stage_order,
    task_group: enriched.task_group || 'general',
    major_category: enriched.major_category || 'marketing',
    geo_stage: enriched.geo_stage || raw.geo_stage || undefined,
    hub_recommend_stars:
      typeof enriched.hub_recommend_stars === 'number'
        ? enriched.hub_recommend_stars
        : typeof raw.hub_recommend_stars === 'number'
          ? raw.hub_recommend_stars
          : undefined,
    secondary_categories: Array.isArray(enriched.secondary_categories) ? enriched.secondary_categories : [],
    secondary_stages: Array.isArray(enriched.secondary_stages) ? enriched.secondary_stages : [],
    secondary_task_groups: Array.isArray(enriched.secondary_task_groups) ? enriched.secondary_task_groups : [],
    category_subtag: enriched.category_subtag || '',
    hidden_in_hub: Boolean(enriched.hidden_in_hub),
    availability: enriched.availability || raw.availability || 'available',
    setup_hint: enriched.setup_hint || raw.setup_hint || '',
    rating: typeof raw.rating === 'number' ? raw.rating : undefined,
    hub_pinned: Boolean(raw.hub_pinned),
  };
}

function mergeCapabilities(runtimeSkills, catalogIndex, catalog, options = {}) {
  const includeHidden = Boolean(options.includeHidden);
  const capabilities = [];
  const stageCounter = new Map();
  const runtimeSlugs = new Set(runtimeSkills.map((s) => s.slug));

  for (const skill of runtimeSkills) {
    const catalogItem = catalogIndex.bySlug.get(skill.slug);
    const stageId = catalogItem?.stage || DEFAULT_STAGE.id;
    const stageMeta = catalogIndex.stageMap.get(stageId) || DEFAULT_STAGE;

    const cap = finalizeCapability({
      slug: skill.slug,
      name: catalogItem?.name || skill.name || skill.slug,
      display_name: catalogItem?.display_name || catalogItem?.name || skill.name || skill.slug,
      description: catalogItem?.description || skill.description || '',
      task_summary: catalogItem?.task_summary || skill.description || skill.name || skill.slug,
      stage: stageId,
      stage_label: stageMeta.label || DEFAULT_STAGE.label,
      stage_order: stageMeta.stage_order ?? DEFAULT_STAGE.stage_order,
      secondary_stages: Array.isArray(catalogItem?.secondary_stages) ? catalogItem.secondary_stages : [],
      secondary_task_groups: Array.isArray(catalogItem?.secondary_task_groups)
        ? catalogItem.secondary_task_groups
        : [],
      integration_level: catalogItem?.integration_level || 'L1',
      hub_sort: typeof catalogItem?.hub_sort === 'number' ? catalogItem.hub_sort : undefined,
      education_bands: Array.isArray(catalogItem?.education_bands) ? catalogItem.education_bands : [],
      audience: Array.isArray(catalogItem?.audience) ? catalogItem.audience : [],
      examples: Array.isArray(catalogItem?.examples) ? catalogItem.examples : [],
      source: catalogItem?.source || skill.skillDir || skill.skillFile || '',
      scope: skill.scope || 'user',
      status: resolveCatalogStatus(catalogItem, true),
      stage_label_key: stageId,
      task_group: catalogItem?.task_group,
      major_category: catalogItem?.major_category,
      geo_stage: catalogItem?.geo_stage,
      hub_recommend_stars: catalogItem?.hub_recommend_stars,
      secondary_categories: Array.isArray(catalogItem?.secondary_categories) ? catalogItem.secondary_categories : [],
      category_subtag: catalogItem?.category_subtag || '',
      availability: catalogItem?.availability || 'available',
      setup_hint: catalogItem?.setup_hint || '',
      hidden_in_hub: Boolean(catalogItem?.hidden_in_hub),
      rating: catalogItem?.rating,
      hub_pinned: Boolean(catalogItem?.hub_pinned),
    }, catalogIndex);
    // PD-SAAS-FORK: Hub 仅展示可见能力；admin=1 时保留 hidden 供后台归类
    if (!includeHidden && cap.hidden_in_hub) continue;
    // PD-SAAS-FORK: 企业 MCP 功能开关 off 时 Hub 不可见（含已有 mcp-notion-collab）
    if (!isHubSlugMcpFeatureAllowed(cap.slug)) {
      emitMcpFeatureGateEvent({ slug: cap.slug, allowed: false, mode: 'off', surface: 'hub' });
      continue;
    }
    capabilities.push(cap);
    stageCounter.set(cap.stage, (stageCounter.get(cap.stage) || 0) + 1);
  }

  // PD-SAAS-FORK: 目录中有、runtime 未发现的技能也在 Hub 展示（如 repo vendor 包），避免仅有计数无卡片
  for (const catalogItem of catalog.skills || []) {
    if (runtimeSlugs.has(catalogItem.slug)) continue;

    const stageId = catalogItem.stage || DEFAULT_STAGE.id;
    const stageMeta = catalogIndex.stageMap.get(stageId) || DEFAULT_STAGE;
    const cap = finalizeCapability({
      slug: catalogItem.slug,
      name: catalogItem.name || catalogItem.slug,
      display_name: catalogItem.display_name || catalogItem.name || catalogItem.slug,
      description: catalogItem.description || '',
      task_summary: catalogItem.task_summary || catalogItem.description || catalogItem.slug,
      stage: stageId,
      stage_label: stageMeta.label || DEFAULT_STAGE.label,
      stage_order: stageMeta.stage_order ?? DEFAULT_STAGE.stage_order,
      secondary_stages: catalogItem.secondary_stages || [],
      integration_level: catalogItem.integration_level || 'L1',
      hub_sort: catalogItem.hub_sort,
      education_bands: catalogItem.education_bands || [],
      audience: catalogItem.audience || [],
      examples: catalogItem.examples || [],
      source: catalogItem.source || 'virtual',
      scope: 'catalog',
      status: resolveCatalogStatus(catalogItem, false),
      stage_label_key: stageId,
      task_group: catalogItem.task_group,
      major_category: catalogItem.major_category,
      geo_stage: catalogItem.geo_stage,
      hub_recommend_stars: catalogItem.hub_recommend_stars,
      secondary_categories: catalogItem.secondary_categories || [],
      category_subtag: catalogItem.category_subtag || '',
      availability: catalogItem.availability || 'pending',
      setup_hint: catalogItem.setup_hint || '',
      hidden_in_hub: Boolean(catalogItem.hidden_in_hub),
      rating: catalogItem.rating,
    }, catalogIndex);
    if (!includeHidden && cap.hidden_in_hub) continue;
    if (!isHubSlugMcpFeatureAllowed(cap.slug)) {
      emitMcpFeatureGateEvent({ slug: cap.slug, allowed: false, mode: 'off', surface: 'hub' });
      continue;
    }
    capabilities.push(cap);
    stageCounter.set(cap.stage, (stageCounter.get(cap.stage) || 0) + 1);
  }

  capabilities.sort(compareCapabilitiesForHub);
  return { capabilities, stageCounter, catalog };
}

function isGeneralCwd(projectPath) {
  if (!projectPath) return false;
  return GENERAL_CWD_PATHS.includes(path.resolve(projectPath));
}

function loadCatalog() {
  try {
    const stats = fs.statSync(CATALOG_PATH);
    if (cachedCatalog && stats.mtimeMs === cachedCatalogMtimeMs) {
      return cachedCatalog;
    }
    cachedCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    cachedCatalogMtimeMs = stats.mtimeMs;
    return cachedCatalog;
  } catch {
    return {
      stages: [DEFAULT_STAGE],
      report: {},
      skills: [],
      welcome_examples: {},
    };
  }
}

function indexCatalog(catalog) {
  const bySlug = new Map();
  for (const item of catalog.skills || []) {
    if (typeof item.slug === 'string') {
      bySlug.set(item.slug, item);
    }
  }
  const stageMap = new Map();
  for (const stage of catalog.stages || []) {
    stageMap.set(stage.id, stage);
  }
  if (!stageMap.has(DEFAULT_STAGE.id)) {
    stageMap.set(DEFAULT_STAGE.id, DEFAULT_STAGE);
  }
  return { bySlug, stageMap };
}

async function listRuntimeSkills(projectPath) {
  const gw = await getPilotDeckGateway();
  const generalCwd = isGeneralCwd(projectPath);
  const effectiveProjectPath = generalCwd ? null : projectPath || null;
  const listed = await gw.skillsList({ projectKey: effectiveProjectPath });
  const userSkills = Array.isArray(listed.user) ? listed.user : [];
  const projectSkills = Array.isArray(listed.project) ? listed.project : [];
  return {
    skills: [...userSkills, ...projectSkills],
    projectPath: listed.projectPath || null,
    isGeneralCwd: generalCwd,
  };
}

router.get('/', async (req, res) => {
  try {
    const projectPath = typeof req.query.projectPath === 'string' ? req.query.projectPath : null;
    const stageFilter = typeof req.query.stage === 'string' ? req.query.stage : null;
    const roleFilter = typeof req.query.role === 'string' ? req.query.role : null;
    const levelFilter = typeof req.query.level === 'string' ? req.query.level : null;
    const locale = typeof req.query.locale === 'string' ? req.query.locale : 'zh-CN';
    const majorCategoryFilter = typeof req.query.majorCategory === 'string'
      ? req.query.majorCategory
      : null;
    const taskGroupFilter = typeof req.query.taskGroup === 'string' ? req.query.taskGroup : null;
    const adminMode = req.query.admin === '1' || req.query.admin === 'true';
    const hasHubFilters = Boolean(
      stageFilter || roleFilter || levelFilter || majorCategoryFilter || taskGroupFilter,
    );

    const catalog = loadCatalog();
    const hubVisibilityCtx = await resolveRequestHubVisibility(req, adminMode);
    const hubVisibility = hubVisibilityCtx.visibility;
    const cacheCtx = resolveCacheUserContext(req);
    const redisHubKey = capabilitiesHubKey({
      ...cacheCtx,
      projectPath,
      locale,
      catalogMtimeMs: cachedCatalogMtimeMs,
      skillsRevision: adminMode ? 'admin' : 'hub',
      hubVisibilityUpdatedAt: loadHubVisibility().updatedAt || 'none',
      userGroupId: hubVisibilityCtx.groupId || 'normal',
      userGroupPermissionsUpdatedAt: hubVisibilityCtx.groupPermissionsUpdatedAt,
    });

    if (!hasHubFilters && !adminMode) {
      const cachedResponse = await readHubResponseRedis(redisHubKey);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }
    }

    const runtime = await listRuntimeSkills(projectPath);
    const skillsRevision = computeSkillsRevision(runtime.skills);
    const cacheKey = hubResponseCacheKey(
      projectPath,
      locale,
      cachedCatalogMtimeMs,
      skillsRevision,
      loadHubVisibility().updatedAt || 'none',
      hubVisibilityCtx.groupId || 'normal',
      hubVisibilityCtx.groupPermissionsUpdatedAt,
    );

    if (!hasHubFilters && !adminMode) {
      const cachedResponse = hubResponseCache.get(cacheKey);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }
    }

    const i18n = loadI18n();
    const catalogIndex = indexCatalog(catalog);
    const merged = mergeCapabilities(runtime.skills, catalogIndex, catalog, { includeHidden: adminMode });
    const hubCapabilities = adminMode
      ? merged.capabilities
      : filterCapabilitiesByHubVisibility(merged.capabilities, hubVisibility);

    const filtered = hubCapabilities
      .filter((capability) => {
        if (majorCategoryFilter && !matchesMajorCategory(majorCategoryFilter, capability)) return false;
        if (stageFilter && capability.stage !== stageFilter) return false;
        if (taskGroupFilter && capability.task_group !== taskGroupFilter) return false;
        if (levelFilter && capability.integration_level !== levelFilter) return false;
        if (roleFilter && capability.audience.length > 0) {
          return capability.audience.some((value) => value.includes(roleFilter));
        }
        return true;
      })
      .map((capability) => {
        const localized = localizeCapability(capability, locale, i18n);
        const stageLocalized = localizeStage(
          catalogIndex.stageMap.get(capability.stage) || DEFAULT_STAGE,
          locale,
          i18n,
        );
        return {
          ...localized,
          stage_label: stageLocalized.label || localized.stage_label,
        };
      });

    const stages = (catalog.stages || [])
      .map((stage) => localizeStage({
        ...stage,
        count: merged.stageCounter.get(stage.id) || 0,
      }, locale, i18n))
      .sort((a, b) => (a.stage_order ?? 999) - (b.stage_order ?? 999));

    const educationBandCounter = new Map();
    for (const capability of merged.capabilities) {
      if (capability.stage !== 'education') continue;
      for (const bandId of capability.education_bands || []) {
        educationBandCounter.set(bandId, (educationBandCounter.get(bandId) || 0) + 1);
      }
    }

    const educationBands = (catalog.education_bands || [])
      .map((band) => localizeStage({
        ...band,
        stage_order: band.band_order,
        count: educationBandCounter.get(band.id) || 0,
      }, locale, i18n))
      .sort((a, b) => (a.band_order ?? a.stage_order ?? 999) - (b.band_order ?? b.stage_order ?? 999));

    const geoFlywheelStages = (catalog.geo_flywheel_stages || [])
      .map((stage) => localizeStage(stage, locale, i18n))
      .sort((a, b) => (a.stage_order ?? 999) - (b.stage_order ?? 999));

    const responseBody = {
      stages,
      education_bands: educationBands,
      flywheel_task_groups: catalog.flywheel_task_groups || {},
      geo_task_groups: catalog.geo_task_groups || {},
      geo_flywheel_stages: geoFlywheelStages,
      major_categories: catalog.major_categories || {},
      hub_visibility: hubVisibility,
      capabilities: filtered,
      report: {
        total_runtime_skills: runtime.skills.length,
        total_capabilities: filtered.length,
        hub_visible_capabilities: hubCapabilities.filter((cap) => !cap.hidden_in_hub).length,
        admin_mode: adminMode,
        hub_visibility_updated_at: hubVisibility.updatedAt || null,
        catalog_generated_at: catalog.generated_at || null,
        skills_revision: skillsRevision,
        catalog_report: catalog.report || {},
        locale: normalizeLocale(locale),
      },
      projectPath: runtime.projectPath,
      isGeneralCwd: runtime.isGeneralCwd,
    };

    if (!hasHubFilters && !adminMode) {
      rememberHubResponse(cacheKey, responseBody);
      void rememberHubResponseRedis(redisHubKey, responseBody);
    }

    res.json(responseBody);
  } catch (error) {
    console.error('[capabilities]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'capabilities_list_failed',
    });
  }
});

// PD-SAAS-FORK: 前台读取 Hub 可见性配置（分类/子类/能力勾选）
router.get('/hub-visibility', (_req, res) => {
  try {
    res.json(loadHubVisibility());
  } catch (error) {
    console.error('[capabilities/hub-visibility]', error);
    res.status(500).json({ error: 'hub_visibility_read_failed' });
  }
});

router.get('/admin/hub-visibility', requireAdmin, (_req, res) => {
  try {
    res.json(loadHubVisibility());
  } catch (error) {
    console.error('[capabilities/admin/hub-visibility]', error);
    res.status(500).json({ error: 'hub_visibility_read_failed' });
  }
});

router.put('/admin/hub-visibility', requireAdmin, async (req, res) => {
  try {
    // PD-SAAS-FORK: 后台提交完整 doc；全量替换各 map，避免 merge 无法删除已恢复可见的键
    const saved = saveHubVisibility(normalizeHubVisibilityDoc(req.body));
    invalidateHubVisibilityCache();
    cachedCatalog = null;
    cachedCatalogMtimeMs = -1;
    hubResponseCache.clear();
    await cacheDelByPattern(capabilitiesHubKeyPattern());
    res.json(saved);
  } catch (error) {
    console.error('[capabilities/admin/hub-visibility]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'hub_visibility_save_failed',
    });
  }
});

// PD-SAAS-FORK: 用户组与组级能力/全案可见性（在全局 hub-visibility 之上的额外隐藏层）
router.get('/user-group', async (req, res) => {
  try {
    let groupId = 'normal';
    if (isSaasMode() && req.user?.id) {
      groupId = await controlUserDb.getUserGroupId(Number(req.user.id));
    }
    const doc = loadUserGroupPermissions();
    const group = findUserGroupById(groupId, doc);
    res.json({ group_id: groupId, group, updated_at: doc.updatedAt || null });
  } catch (error) {
    console.error('[capabilities/user-group]', error);
    res.status(500).json({ error: 'user_group_read_failed' });
  }
});

router.get('/admin/user-groups', requireAdmin, (_req, res) => {
  try {
    res.json(loadUserGroupPermissions());
  } catch (error) {
    console.error('[capabilities/admin/user-groups]', error);
    res.status(500).json({ error: 'user_groups_read_failed' });
  }
});

router.put('/admin/user-groups', requireAdmin, async (req, res) => {
  try {
    const saved = saveUserGroupPermissions(normalizeUserGroupPermissionsDoc(req.body));
    invalidateUserGroupPermissionsCache();
    hubResponseCache.clear();
    await cacheDelByPattern(capabilitiesHubKeyPattern());
    res.json(saved);
  } catch (error) {
    console.error('[capabilities/admin/user-groups]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'user_groups_save_failed',
    });
  }
});

// PD-SAAS-FORK: 平台功能开关（Preflight 模板选型等）
router.get('/admin/platform-features', requireAdmin, (_req, res) => {
  try {
    const doc = loadPlatformFeatures(true);
    const envRaw = process.env.PILOTDECK_PREFLIGHT_STUDIO?.trim();
    res.json({
      ...doc,
      envPreflightStudio: envRaw ? normalizePreflightStudioMode(envRaw) : null,
      effectivePreflightStudio: resolvePreflightStudioModeEffective(),
      envBentoDeckEditor: readBentoDeckEditorEnvOverride(),
      effectiveBentoDeckEditor: resolveBentoDeckEditorEnabledEffective(),
      envMdBrowserTool: readMdBrowserToolEnvOverride(),
      effectiveMdBrowserTool: resolveMdBrowserToolEnabledEffective(),
      envN2Bot: readN2BotEnvOverride(),
      effectiveN2Bot: resolveN2BotModeEffective() !== 'off',
      // PD-SAAS-FORK: 企业 MCP 功能开关
      envMcpFeatures: readBatch1McpEnvOverrides(),
      effectiveMcpFeatures: resolveAllBatch1McpFeaturesEffective(),
    });
  } catch (error) {
    console.error('[capabilities/admin/platform-features]', error);
    res.status(500).json({ error: 'platform_features_read_failed' });
  }
});

router.put('/admin/platform-features', requireAdmin, async (req, res) => {
  try {
    const current = loadPlatformFeatures(true);
    const nextPreflight = req.body?.preflightStudio ?? current.preflightStudio;
    const nextBento = req.body?.bentoDeckEditor ?? current.bentoDeckEditor;
    const nextMdBrowser = req.body?.mdBrowserTool ?? current.mdBrowserTool;
    const nextN2Bot = req.body?.n2Bot ?? current.n2Bot;
    const mcpNorm = normalizeMcpFeaturesDoc(
      req.body?.mcpFeatures != null ? req.body.mcpFeatures : current.mcpFeatures,
    );
    const saved = savePlatformFeatures({
      ...current,
      preflightStudio: normalizePreflightStudioMode(nextPreflight),
      bentoDeckEditor: normalizeBooleanFeature(nextBento, false),
      mdBrowserTool: normalizeBooleanFeature(nextMdBrowser, true),
      n2Bot: isCommunityPersonal() ? false : normalizeBooleanFeature(nextN2Bot, false),
      mcpFeatures: mcpNorm.features,
    });
    // PD-SAAS-FORK: do not await cold Gateway connect (60s) — admin UI aborts at 12s.
    const reload = await reloadGatewayExtensionsBestEffort({
      getIfReady: getPilotDeckGatewayIfReady,
      kickConnect: getPilotDeckGateway,
      input: { reason: 'platform-features-mcp' },
      timeoutMs: 4_000,
    });
    const reloadWarning = reload.warning;
    const envRaw = process.env.PILOTDECK_PREFLIGHT_STUDIO?.trim();
    res.json({
      ...saved,
      mcpFeaturesWarning: mcpNorm.warning || saved.mcpFeaturesWarning || null,
      reloadWarning,
      envPreflightStudio: envRaw ? normalizePreflightStudioMode(envRaw) : null,
      effectivePreflightStudio: resolvePreflightStudioModeEffective(),
      envBentoDeckEditor: readBentoDeckEditorEnvOverride(),
      effectiveBentoDeckEditor: resolveBentoDeckEditorEnabledEffective(),
      envMdBrowserTool: readMdBrowserToolEnvOverride(),
      effectiveMdBrowserTool: resolveMdBrowserToolEnabledEffective(),
      envN2Bot: readN2BotEnvOverride(),
      effectiveN2Bot: resolveN2BotModeEffective() !== 'off',
      envMcpFeatures: readBatch1McpEnvOverrides(),
      effectiveMcpFeatures: resolveAllBatch1McpFeaturesEffective(),
    });
  } catch (error) {
    console.error('[capabilities/admin/platform-features]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'platform_features_save_failed',
    });
  }
});

// PD-SAAS-FORK: 欢迎页随机 5 条 — 从 config/welcome-prompt-pool.* 抽样，勿缓存（每次刷新应不同）
router.get('/welcome', async (req, res) => {
  try {
    const locale = normalizeLocale(req.query.locale);
    const responseBody = buildWelcomePromptResponse(locale);
    res.json(responseBody);
  } catch (error) {
    console.error('[capabilities/welcome]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'capabilities_welcome_failed',
    });
  }
});

const TAXONOMY_PATCH_KEYS = new Set([
  'major_category',
  'geo_stage',
  'hub_recommend_stars',
  'stage',
  'task_group',
  'category_subtag',
  'education_bands',
  'secondary_stages',
  'secondary_task_groups',
  'hidden_in_hub',
  'name',
  'display_name',
  'description',
  'task_summary',
]);

function sanitizeTaxonomyPatch(raw) {
  const patch = {};
  if (!raw || typeof raw !== 'object') return patch;
  for (const key of TAXONOMY_PATCH_KEYS) {
    if (raw[key] !== undefined) patch[key] = raw[key];
  }
  return patch;
}

// PD-SAAS-FORK: 后台新建技能 — 写入 capabilities.overrides 并重建目录
router.post('/admin/skill-taxonomy', requireAdmin, async (req, res) => {
  try {
    const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
    const taxonomy = req.body?.taxonomy;
    if (!SLUG_RE.test(slug)) {
      return res.status(400).json({ error: 'invalid slug', code: 'invalid_slug' });
    }
    const patch = sanitizeTaxonomyPatch(taxonomy);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'taxonomy required', code: 'invalid_taxonomy' });
    }

    const overridesRaw = fs.readFileSync(OVERRIDES_PATH, 'utf8');
    const overridesDoc = JSON.parse(overridesRaw);
    if (!overridesDoc.skills || typeof overridesDoc.skills !== 'object') {
      overridesDoc.skills = {};
    }
    overridesDoc.skills[slug] = {
      ...(overridesDoc.skills[slug] || {}),
      ...patch,
    };
    overridesDoc.updatedAt = new Date().toISOString();
    fs.writeFileSync(OVERRIDES_PATH, `${JSON.stringify(overridesDoc, null, 2)}\n`, 'utf8');

    cachedCatalog = null;
    cachedCatalogMtimeMs = -1;
    cachedI18n = null;
    cachedI18nMtimeMs = -1;
    hubResponseCache.clear();
    // PD-SAAS-FORK: 同步清 Redis Hub 缓存，避免多实例/网关仍返回旧 display_name
    await cacheDelByPattern(capabilitiesHubKeyPattern());

    await execFileAsync('node', ['scripts/generate-capabilities-catalog.mjs'], { cwd: REPO_ROOT });
    await execFileAsync('node', ['scripts/generate-capabilities-i18n.mjs'], { cwd: REPO_ROOT });

    // 生成后再清一次，确保新 mtime 键也不会残留旧 payload
    hubResponseCache.clear();
    await cacheDelByPattern(capabilitiesHubKeyPattern());

    res.json({ ok: true, slug, taxonomy: overridesDoc.skills[slug] });
  } catch (error) {
    console.error('[capabilities/admin/skill-taxonomy]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'skill_taxonomy_failed',
    });
  }
});

export default router;
