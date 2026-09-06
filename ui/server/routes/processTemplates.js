import express from 'express';
import fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { processTemplatesKey } from '../saas/cache/cacheKeys.js';
import { cacheGet, cacheSet, getDefaultTtl } from '../saas/cache/redisClient.js';
import { isSaasMode } from '../saas/mode.js';
import { getSaasRequestContext } from '../saas/context.js';
import { controlUserDb } from '../saas/db/control.js';
import { isHubPinnedTemplate } from '../../../scripts/lib/capabilityHubPinned.mjs';
import { filterTemplatesByHubVisibility, loadHubVisibility } from '../../../scripts/lib/hubVisibility.mjs';
import { resolveEffectiveHubVisibilityForGroupId, loadUserGroupPermissions } from '../../../scripts/lib/userGroupPermissions.mjs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'config', 'process-templates.json');

let cachedMtimeMs = -1;
let cachedPayload = null;

function normalizeLocale(raw) {
  // PD-SAAS-FORK: 未传 locale 时默认中文
  if (typeof raw !== 'string' || !raw.trim()) return 'zh-CN';
  const value = raw.trim().toLowerCase();
  if (value.startsWith('zh')) return 'zh-CN';
  return 'en';
}

function pickLocalized(value, locale) {
  if (!value || typeof value !== 'object') return '';
  return value[locale] || value.en || value['zh-CN'] || '';
}

function loadConfig() {
  try {
    const stats = fs.statSync(CONFIG_PATH);
    if (cachedPayload && stats.mtimeMs === cachedMtimeMs) {
      return cachedPayload;
    }
    cachedPayload = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    cachedMtimeMs = stats.mtimeMs;
    return cachedPayload;
  } catch (error) {
    console.warn('[process-templates] failed to load config:', error instanceof Error ? error.message : error);
    return { complexityLevels: [], templates: [] };
  }
}

function localizeTemplate(template, locale) {
  return {
    id: template.id,
    complexity: template.complexity,
    category: template.category || 'marketing',
    title: pickLocalized(template.title, locale),
    outcome: pickLocalized(template.outcome, locale),
    scenario: pickLocalized(template.scenario, locale),
    outputs: pickLocalized(template.outputs, locale),
    prompt: pickLocalized(template.prompt, locale),
    stageBadges: Array.isArray(template.stageBadges) ? template.stageBadges : [],
    relatedSkills: Array.isArray(template.relatedSkills) ? template.relatedSkills : [],
    geoFlywheel: Boolean(template.geoFlywheel),
    geoStages: Array.isArray(template.geoStages) ? template.geoStages : [],
    flow: (template.flow || []).map((step) => ({
      step: step.step,
      title: pickLocalized(step.title, locale),
      skill: step.skill || '',
    })),
    stepCount: Array.isArray(template.flow) ? template.flow.length : 0,
    rating: typeof template.rating === 'number' ? template.rating : undefined,
    hub_pinned: isHubPinnedTemplate(template.id),
  };
}

router.get('/', async (req, res) => {
  try {
    const locale = normalizeLocale(req.query.locale);
    const adminMode = req.query.admin === '1' || req.query.admin === 'true';
    const globalVisibility = loadHubVisibility();
    let groupId = 'normal';
    let groupPermissionsUpdatedAt = loadUserGroupPermissions().updatedAt || 'none';
    if (!adminMode && isSaasMode() && req.user?.id) {
      const saasCtx = getSaasRequestContext();
      const role = saasCtx?.role || req.user?.role;
      if (role !== 'super-admin' && role !== 'admin') {
        groupId = await controlUserDb.getUserGroupId(Number(req.user.id));
        const resolved = resolveEffectiveHubVisibilityForGroupId(groupId, globalVisibility);
        groupPermissionsUpdatedAt = resolved.groupPermissionsUpdatedAt;
      }
    }
    const effectiveVisibility = adminMode
      ? globalVisibility
      : resolveEffectiveHubVisibilityForGroupId(groupId, globalVisibility).visibility;
    const cacheKey = adminMode
      ? null
      : processTemplatesKey({ locale, userGroupId: groupId, userGroupPermissionsUpdatedAt });
    if (cacheKey) {
      const cached = await cacheGet(cacheKey);
      if (cached && typeof cached === 'object') {
        return res.json(cached);
      }
    }

    const config = loadConfig();
    const complexityLevels = (config.complexityLevels || []).map((level) => ({
      id: level.id,
      order: level.order ?? 99,
      label: pickLocalized(level.label, locale),
      description: pickLocalized(level.description, locale),
    }));
    const categoryLevels = (config.categoryLevels || []).map((level) => ({
      id: level.id,
      order: level.order ?? 99,
      label: pickLocalized(level.label, locale),
      description: pickLocalized(level.description, locale),
    }));

    const localized = (config.templates || []).map((t) => localizeTemplate(t, locale));
    const templates = adminMode
      ? localized
      : filterTemplatesByHubVisibility(localized, effectiveVisibility);

    const counts = { light: 0, standard: 0, full: 0 };
    const categoryCounts = {};
    for (const t of templates) {
      if (counts[t.complexity] !== undefined) counts[t.complexity] += 1;
      if (t.category) {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      }
    }

    const responseBody = {
      complexityLevels,
      categoryLevels,
      templates,
      report: {
        total: templates.length,
        counts,
        categoryCounts,
        locale,
        version: config.version ?? null,
        updatedAt: config.updatedAt ?? null,
        admin_mode: adminMode,
      },
    };
    if (cacheKey) {
      void cacheSet(cacheKey, responseBody, getDefaultTtl('processTemplates'));
    }
    res.json(responseBody);
  } catch (error) {
    console.error('[process-templates]', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      code: 'process_templates_list_failed',
    });
  }
});

export default router;
