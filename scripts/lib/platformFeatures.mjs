/**
 * PD-SAAS-FORK: 平台功能开关（后台可配，默认关闭 Preflight 模板选型）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyBatch1McpFeatures,
  normalizeMcpFeaturesDoc,
} from './mcpFeatureFlags.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLATFORM_FEATURES_PATH = path.join(ROOT, 'config', 'platform-features.json');

const EMPTY_DOC = {
  version: 1,
  updatedAt: null,
  preflightStudio: 'off',
  bentoDeckEditor: false,
  mdBrowserTool: true,
  n2Bot: false,
  mcpFeatures: emptyBatch1McpFeatures(),
};

export function normalizeBooleanFeature(raw, defaultValue = false) {
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return defaultValue;
}

let cachedDoc = null;
let cachedMtimeMs = -1;

export function normalizePreflightStudioMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on') return 'enforce';
  if (v === 'shadow') return 'shadow';
  if (v === 'off' || v === '0' || v === 'false') return 'off';
  return 'off';
}

export function normalizePlatformFeaturesDoc(raw) {
  const doc = { ...EMPTY_DOC, ...(raw && typeof raw === 'object' ? raw : {}) };
  doc.preflightStudio = normalizePreflightStudioMode(doc.preflightStudio);
  doc.bentoDeckEditor = normalizeBooleanFeature(doc.bentoDeckEditor, false);
  doc.mdBrowserTool = normalizeBooleanFeature(doc.mdBrowserTool, true);
  doc.n2Bot = normalizeBooleanFeature(doc.n2Bot, false);
  const mcpNorm = normalizeMcpFeaturesDoc(doc.mcpFeatures);
  doc.mcpFeatures = mcpNorm.features;
  if (mcpNorm.warning) doc.mcpFeaturesWarning = mcpNorm.warning;
  else delete doc.mcpFeaturesWarning;
  return doc;
}

export function loadPlatformFeatures(force = false) {
  try {
    const stats = fs.statSync(PLATFORM_FEATURES_PATH);
    if (!force && cachedDoc && stats.mtimeMs === cachedMtimeMs) {
      return cachedDoc;
    }
    const parsed = JSON.parse(fs.readFileSync(PLATFORM_FEATURES_PATH, 'utf8'));
    cachedDoc = normalizePlatformFeaturesDoc(parsed);
    cachedMtimeMs = stats.mtimeMs;
    return cachedDoc;
  } catch {
    cachedDoc = normalizePlatformFeaturesDoc(null);
    cachedMtimeMs = -1;
    return cachedDoc;
  }
}

export function savePlatformFeatures(nextDoc) {
  const doc = normalizePlatformFeaturesDoc(nextDoc);
  doc.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(PLATFORM_FEATURES_PATH), { recursive: true });
  fs.writeFileSync(PLATFORM_FEATURES_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  cachedDoc = doc;
  cachedMtimeMs = fs.statSync(PLATFORM_FEATURES_PATH).mtimeMs;
  return doc;
}

/** Env wins when explicitly set; otherwise platform-features.json; default off. */
export function resolvePreflightStudioModeEffective() {
  const envRaw = process.env.PILOTDECK_PREFLIGHT_STUDIO?.trim();
  if (envRaw) {
    return normalizePreflightStudioMode(envRaw);
  }
  const doc = loadPlatformFeatures();
  return normalizePreflightStudioMode(doc.preflightStudio);
}

export function isPreflightStudioEnabledEffective() {
  const mode = resolvePreflightStudioModeEffective();
  return mode === 'shadow' || mode === 'enforce';
}

const BENTO_DECK_ENV_KEYS = ['PILOTDECK_BENTO_DECK_EDITOR', 'VITE_BENTO_DECK_PREVIEW'];

/** Env wins when explicitly set; otherwise platform-features.json; default off. */
export function resolveBentoDeckEditorEnabledEffective() {
  for (const key of BENTO_DECK_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const v = raw.toLowerCase();
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  }
  const doc = loadPlatformFeatures();
  return normalizeBooleanFeature(doc.bentoDeckEditor, false);
}

export function readBentoDeckEditorEnvOverride() {
  for (const key of BENTO_DECK_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const v = raw.toLowerCase();
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') {
      return { key, value: true };
    }
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') {
      return { key, value: false };
    }
  }
  return null;
}

const MD_BROWSER_ENV_KEYS = ['PILOTDECK_MD_BROWSER_TOOL', 'VITE_MD_BROWSER_TOOL'];

/** Env wins when explicitly set; otherwise platform-features.json; default on. */
export function resolveMdBrowserToolEnabledEffective() {
  for (const key of MD_BROWSER_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const v = raw.toLowerCase();
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  }
  const doc = loadPlatformFeatures();
  return normalizeBooleanFeature(doc.mdBrowserTool, true);
}

export function readMdBrowserToolEnvOverride() {
  for (const key of MD_BROWSER_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const v = raw.toLowerCase();
    if (v === '1' || v === 'true' || v === 'on' || v === 'yes') {
      return { key, value: true };
    }
    if (v === '0' || v === 'false' || v === 'off' || v === 'no') {
      return { key, value: false };
    }
  }
  return null;
}

const N2_BOT_ENV_KEYS = ['PILOTDECK_N2_BOT', 'PILOTDECK_JARVIS_BUTLER'];

function normalizeN2BotMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'shadow') return 'shadow';
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on') return 'enforce';
  return 'off';
}

/**
 * Explicit env shadow|enforce forces the HUD on (tests / local override).
 * Env off is not a lock: admin platform-features.json can still enable.
 * Default off when both unset / false.
 */
export function readN2BotEnvOverride() {
  for (const key of N2_BOT_ENV_KEYS) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    return { key, mode: normalizeN2BotMode(raw) };
  }
  return null;
}

export function resolveN2BotModeEffective() {
  const envHit = readN2BotEnvOverride();
  if (envHit && (envHit.mode === 'shadow' || envHit.mode === 'enforce')) {
    return envHit.mode;
  }
  const doc = loadPlatformFeatures();
  return normalizeBooleanFeature(doc.n2Bot, false) ? 'shadow' : 'off';
}

export function isN2BotEnabledEffective() {
  const mode = resolveN2BotModeEffective();
  return mode === 'shadow' || mode === 'enforce';
}
