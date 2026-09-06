/**
 * PD-SAAS-FORK: 企业 MCP 功能开关注册表（Bridge / smoke / Hub 同源）
 * 本批 6 键默认 off；存量 mcp server 默认 shadow（Hub 可见 needs_config）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MCP_PLATFORM_FEATURES_PATH = path.join(ROOT, 'config', 'platform-features.json');

function readMcpFeaturesFromPlatformJson() {
  try {
    const candidates = [
      MCP_PLATFORM_FEATURES_PATH,
      path.resolve(process.cwd(), 'config', 'platform-features.json'),
    ];
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return parsed?.mcpFeatures && typeof parsed.mcpFeatures === 'object'
        ? parsed.mcpFeatures
        : null;
    }
  } catch {
    // fall through
  }
  return null;
}

/** @typedef {'off'|'shadow'|'enforce'} McpFeatureMode */

/** @type {ReadonlyArray<{ flagKey: string, serverIds: string[], hubSlugs: string[], envKeys: string[], defaultMode: McpFeatureMode, batch1?: boolean }>} */
export const MCP_FEATURE_REGISTRY = Object.freeze([
  {
    flagKey: 'cnErp',
    serverIds: ['erp'],
    hubSlugs: ['mcp-cn-erp'],
    envKeys: ['PILOTDECK_MCP_CN_ERP'],
    defaultMode: 'off',
    batch1: true,
  },
  {
    flagKey: 'kingdee',
    serverIds: ['kingdee'],
    hubSlugs: ['mcp-kingdee-k3'],
    envKeys: ['PILOTDECK_MCP_KINGDEE'],
    defaultMode: 'off',
    batch1: true,
  },
  {
    flagKey: 'yonyouFin',
    serverIds: ['yonyou-fin'],
    hubSlugs: ['mcp-yonyou-fin'],
    envKeys: ['PILOTDECK_MCP_YONYOU_FIN'],
    defaultMode: 'off',
    batch1: true,
  },
  {
    flagKey: 'taxInvoice',
    serverIds: ['tax-invoice'],
    hubSlugs: ['mcp-tax-invoice'],
    envKeys: ['PILOTDECK_MCP_TAX_INVOICE'],
    defaultMode: 'off',
    batch1: true,
  },
  {
    flagKey: 'notionCollab',
    serverIds: ['notion-collab'],
    hubSlugs: ['mcp-notion-collab'],
    envKeys: ['PILOTDECK_MCP_NOTION'],
    defaultMode: 'off',
    batch1: true,
  },
  {
    flagKey: 'postgresReadonly',
    serverIds: ['postgres'],
    hubSlugs: ['mcp-postgres-readonly'],
    envKeys: ['PILOTDECK_MCP_POSTGRES'],
    defaultMode: 'off',
    batch1: true,
  },
  // 存量：默认 shadow（与今日 Hub needs_config 可见一致）
  { flagKey: 'legacyFirecrawl', serverIds: ['firecrawl'], hubSlugs: ['mcp-firecrawl'], envKeys: ['PILOTDECK_MCP_FIRECRAWL'], defaultMode: 'shadow' },
  { flagKey: 'legacyExa', serverIds: ['exa'], hubSlugs: ['mcp-exa'], envKeys: ['PILOTDECK_MCP_EXA'], defaultMode: 'shadow' },
  { flagKey: 'legacyFigma', serverIds: ['figma'], hubSlugs: ['mcp-figma'], envKeys: ['PILOTDECK_MCP_FIGMA'], defaultMode: 'shadow' },
  { flagKey: 'legacyPostiz', serverIds: ['postiz'], hubSlugs: ['mcp-postiz'], envKeys: ['PILOTDECK_MCP_POSTIZ'], defaultMode: 'shadow' },
  { flagKey: 'legacySimilarweb', serverIds: ['similarweb'], hubSlugs: ['mcp-similarweb'], envKeys: ['PILOTDECK_MCP_SIMILARWEB'], defaultMode: 'shadow' },
  { flagKey: 'legacyGoogleWorkspace', serverIds: ['google-workspace'], hubSlugs: ['mcp-google-workspace'], envKeys: ['PILOTDECK_MCP_GOOGLE_WORKSPACE'], defaultMode: 'shadow' },
  { flagKey: 'legacyPlaywright', serverIds: ['playwright'], hubSlugs: ['mcp-playwright'], envKeys: ['PILOTDECK_MCP_PLAYWRIGHT'], defaultMode: 'shadow' },
  { flagKey: 'legacyAgentAeo', serverIds: ['agent-aeo'], hubSlugs: ['mcp-agent-aeo'], envKeys: ['PILOTDECK_MCP_AGENT_AEO'], defaultMode: 'shadow' },
  { flagKey: 'legacyGeoOptimizer', serverIds: ['geo-optimizer'], hubSlugs: ['mcp-geo-optimizer'], envKeys: ['PILOTDECK_MCP_GEO_OPTIMIZER'], defaultMode: 'shadow' },
  { flagKey: 'legacyAiSeo', serverIds: ['ai-seo-mcp'], hubSlugs: ['mcp-ai-seo'], envKeys: ['PILOTDECK_MCP_AI_SEO'], defaultMode: 'shadow' },
  { flagKey: 'legacyCnCentralPolicy', serverIds: ['cn-central-policy'], hubSlugs: ['mcp-cn-central-policy'], envKeys: ['PILOTDECK_MCP_CN_CENTRAL_POLICY'], defaultMode: 'shadow' },
  { flagKey: 'legacyImNotify', serverIds: ['im-notify'], hubSlugs: ['mcp-im-notify'], envKeys: ['PILOTDECK_MCP_IM_NOTIFY', 'PILOTDECK_IM_NOTIFY_MCP'], defaultMode: 'shadow' },
]);

export const BATCH1_MCP_FLAG_KEYS = Object.freeze(
  MCP_FEATURE_REGISTRY.filter((e) => e.batch1).map((e) => e.flagKey),
);

const BY_FLAG = new Map(MCP_FEATURE_REGISTRY.map((e) => [e.flagKey, e]));
const BY_SERVER = new Map();
const BY_SLUG = new Map();
for (const entry of MCP_FEATURE_REGISTRY) {
  for (const id of entry.serverIds) BY_SERVER.set(id, entry);
  for (const slug of entry.hubSlugs) BY_SLUG.set(slug, entry);
}

export function normalizeMcpFeatureMode(raw, defaultMode = 'off') {
  if (raw == null || raw === '') return defaultMode;
  const v = String(raw).trim().toLowerCase();
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on' || v === 'yes') return 'enforce';
  if (v === 'shadow') return 'shadow';
  if (v === 'off' || v === '0' || v === 'false' || v === 'no') return 'off';
  return defaultMode;
}

export function isMcpFeatureEnabled(mode) {
  return mode === 'shadow' || mode === 'enforce';
}

/** @returns {Record<string, McpFeatureMode>} */
export function emptyBatch1McpFeatures() {
  /** @type {Record<string, McpFeatureMode>} */
  const out = {};
  for (const key of BATCH1_MCP_FLAG_KEYS) out[key] = 'off';
  return out;
}

/**
 * @param {unknown} raw
 * @returns {{ features: Record<string, McpFeatureMode>, warning?: string }}
 */
export function normalizeMcpFeaturesDoc(raw) {
  const base = emptyBatch1McpFeatures();
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const key of BATCH1_MCP_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      base[key] = normalizeMcpFeatureMode(input[key], 'off');
    }
  }
  let warning;
  if (isMcpFeatureEnabled(base.cnErp) && isMcpFeatureEnabled(base.kingdee)) {
    base.kingdee = 'off';
    warning = '企业 ERP 查询与金蝶专用不可同时开启，已自动关闭「金蝶云星空」。';
  }
  return { features: base, warning };
}

function readEnvOverride(entry) {
  for (const key of entry.envKeys) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    return { key, mode: normalizeMcpFeatureMode(raw, entry.defaultMode) };
  }
  return null;
}

/**
 * @param {string} flagKey
 * @returns {McpFeatureMode}
 */
export function resolveMcpFeatureMode(flagKey) {
  const entry = BY_FLAG.get(flagKey);
  if (!entry) return 'shadow';
  const envHit = readEnvOverride(entry);
  if (envHit) return envHit.mode;
  const fromDoc = readMcpFeaturesFromPlatformJson();
  if (fromDoc && fromDoc[flagKey] != null) {
    return normalizeMcpFeatureMode(fromDoc[flagKey], entry.defaultMode);
  }
  return entry.defaultMode;
}

/** @returns {Record<string, McpFeatureMode>} */
export function resolveAllBatch1McpFeaturesEffective() {
  /** @type {Record<string, McpFeatureMode>} */
  const out = {};
  for (const key of BATCH1_MCP_FLAG_KEYS) {
    out[key] = resolveMcpFeatureMode(key);
  }
  if (isMcpFeatureEnabled(out.cnErp) && isMcpFeatureEnabled(out.kingdee)) {
    out.kingdee = 'off';
  }
  return out;
}

/** @returns {Record<string, { key: string, mode: McpFeatureMode }|null>} */
export function readBatch1McpEnvOverrides() {
  /** @type {Record<string, { key: string, mode: McpFeatureMode }|null>} */
  const out = {};
  for (const key of BATCH1_MCP_FLAG_KEYS) {
    const entry = BY_FLAG.get(key);
    out[key] = entry ? readEnvOverride(entry) : null;
  }
  return out;
}

export function isHubSlugMcpFeatureAllowed(slug) {
  const entry = BY_SLUG.get(String(slug || '').trim());
  if (!entry) return true;
  return isMcpFeatureEnabled(resolveMcpFeatureMode(entry.flagKey));
}

/**
 * Filter mcp.json / plugin server map by feature flags.
 * Unregistered server ids: fail-open (keep).
 * @param {Record<string, unknown>|undefined} servers
 * @returns {{ servers: Record<string, unknown>, dropped: string[], unregistered: string[] }}
 */
export function filterMcpServersByFeatures(servers) {
  if (!servers || typeof servers !== 'object') {
    return { servers: {}, dropped: [], unregistered: [] };
  }
  /** @type {Record<string, unknown>} */
  const next = {};
  const dropped = [];
  const unregistered = [];
  for (const [id, value] of Object.entries(servers)) {
    const entry = BY_SERVER.get(id);
    if (!entry) {
      unregistered.push(id);
      next[id] = value;
      continue;
    }
    const mode = resolveMcpFeatureMode(entry.flagKey);
    if (!isMcpFeatureEnabled(mode)) {
      dropped.push(id);
      continue;
    }
    next[id] = value;
  }
  return { servers: next, dropped, unregistered };
}

export function getMcpFeatureEntryByServerId(serverId) {
  return BY_SERVER.get(serverId) || null;
}

export function getMcpFeatureEntryBySlug(slug) {
  return BY_SLUG.get(slug) || null;
}

export function mcpFeatureRegistryPathHint() {
  return MCP_PLATFORM_FEATURES_PATH;
}

/** Soft telemetry (no secrets). */
export function emitMcpFeatureGateEvent(payload) {
  try {
    const dir = process.env.PILOTDECK_TELEMETRY_DIR?.trim()
      || path.join(ROOT, '.saas-dev-data', 'telemetry');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      type: 'mcp_feature_gate',
      ts: new Date().toISOString(),
      ...payload,
    });
    fs.appendFileSync(path.join(dir, 'mcp-feature-events.jsonl'), `${line}\n`, 'utf8');
  } catch {
    // never throw
  }
}
