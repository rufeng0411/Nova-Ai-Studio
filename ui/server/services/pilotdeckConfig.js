import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  MAX_TOOL_CAPABILITY_FALLBACKS,
  normalizeProviderApiKeySlots,
  normalizeToolCapabilityFallbacks,
} from '../../shared/providerApiKeys.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../../..');

// Source of truth: ~/.pilotdeck/pilotdeck.yaml. The disk format and the
// "internal" config object are the same V2 schema — no more adapter layer.
//
// Top-level shape:
//   schemaVersion: 1
//   agent:    { model: "provider/model", params, subagents }
//   model:    { providers: { [pid]: { protocol, url, apiKey, models, headers, timeoutMs } } }
//   memory:   { enabled, model, apiType?, reasoningMode, ... }
//   webui:    { runtime: { host, serverPort, vitePort, ... } }
//   router:   { enabled, stats: { enabled, modelPricing }, ... }
//   gateway:  { enabled, home, ... }
//   alwaysOn: { enabled, trigger, dormancy, workspace, execution, projects }
//   customEnv:{ KEY: VALUE }    (UI-only; engine ignores)
//
// Everything not in this list (router/gateway/alwaysOn deep fields, etc.)
// flows through verbatim — the gateway-side PilotConfigStore owns those
// schemas. UI server just round-trips them.

const CONFIG_VERSION = 1;
const PILOT_HOME_DIR = process.env.PILOT_HOME || path.join(os.homedir(), '.pilotdeck');
const DEFAULT_CONFIG_PATH = path.join(PILOT_HOME_DIR, 'pilotdeck.yaml');
const MASK = '********';

const SECRET_KEY_RE = /(api[_-]?key|token|secret|password|auth[_-]?token|access[_-]?token|bot[_-]?token|app[_-]?token|encoding[_-]?aes[_-]?key)$/i;
const SECRET_EXACT_KEYS = new Set(['key', 'apiKey', 'api_key', 'authToken', 'accessToken']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function deepMerge(base, override) {
  if (!isRecord(base)) return clone(override);
  const output = clone(base);
  if (!isRecord(override)) return output;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    if (isRecord(value) && isRecord(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export function buildDefaultPilotDeckConfig() {
  return {
    schemaVersion: CONFIG_VERSION,
    agent: {
      model: '',
      params: {},
      subagents: { default: 'inherit', params: {} },
    },
    model: {
      providers: {},
    },
    memory: {
      enabled: true,
      reasoningMode: 'answer_first',
      autoIndexIntervalMinutes: 30,
      autoDreamIntervalMinutes: 60,
      captureStrategy: 'full_session',
      includeAssistant: true,
      maxMessageChars: 6000,
      heartbeatBatchSize: 30,
      projectContinuity: {
        enabled: true,
      },
    },
    webui: {
      runtime: {
        host: '0.0.0.0',
        serverPort: 3001,
        vitePort: 5173,
        apiTimeoutMs: 120000,
        databasePath: path.join(PILOT_HOME_DIR, 'auth.db'),
        workspacesRoot: os.homedir(),
      },
    },
    telemetry: {
      enabled: false,
    },
  };
}

// `normalize` here means "fill in missing top-level sections with defaults"
// — it never reshapes. Idempotent.
export function normalizePilotDeckConfig(input) {
  return deepMerge(buildDefaultPilotDeckConfig(), isRecord(input) ? input : {});
}

// Strip surrounding whitespace from provider apiKey + url before they
// hit disk. Without this, a copy-paste with a stray space (e.g.
// `apiKey: " sk-..."`) survives the round-trip and produces an
// `Authorization: Bearer  sk-...` header that providers reject as
// `invalid_token` / `无效的令牌`. The gateway's parseModelConfig already
// trims as a defence-in-depth, but cleaning here keeps the on-disk
// yaml authoritative + diff-clean for users browsing the file.
export function sanitizeProviderCredentials(config) {
  if (!isRecord(config)) return config;
  const providers = config?.model?.providers;
  if (!isRecord(providers)) return config;
  for (const provider of Object.values(providers)) {
    if (!isRecord(provider)) continue;
    if (typeof provider.apiKey === 'string') {
      provider.apiKey = provider.apiKey.trim();
    }
    if (Array.isArray(provider.apiKeys)) {
      provider.apiKeys = provider.apiKeys
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (provider.apiKeys.length === 0) delete provider.apiKeys;
    }
    if (typeof provider.url === 'string') {
      provider.url = provider.url.trim();
    }
  }
  const yixiaoer = config?.tools?.yixiaoer;
  if (isRecord(yixiaoer)) {
    if (typeof yixiaoer.apiKey === 'string') {
      yixiaoer.apiKey = yixiaoer.apiKey.trim();
    }
    if (typeof yixiaoer.apiUrl === 'string') {
      yixiaoer.apiUrl = yixiaoer.apiUrl.trim();
    }
  }
  const documentOcr = config?.tools?.documentOcr;
  if (isRecord(documentOcr) && typeof documentOcr.apiKey === 'string') {
    documentOcr.apiKey = documentOcr.apiKey.trim();
  }
  return config;
}

// ─── Model resolution ────────────────────────────────────────────────────────

function splitModelRef(ref) {
  const text = normalizeString(ref);
  if (!text) return null;
  const slash = text.indexOf('/');
  if (slash <= 0 || slash === text.length - 1) return null;
  return { providerId: text.slice(0, slash), modelId: text.slice(slash + 1) };
}

// Returns { id, providerId, provider, model, def } or null if the
// reference doesn't resolve. `id` is the canonical "provider/model"
// string (after inherit-resolution).
export function resolveModel(config, ref, options = {}) {
  const inheritFallback = normalizeString(config?.agent?.model);
  const refText = normalizeString(ref);
  const effective = (!refText || refText === 'inherit')
    ? inheritFallback
    : refText;
  const parts = splitModelRef(effective);
  if (!parts) {
    if (options.allowMissing) return null;
    throw new Error(`Invalid model reference: ${ref ?? ''}`);
  }
  const provider = config?.model?.providers?.[parts.providerId];
  if (!isRecord(provider)) {
    if (options.allowMissing) return null;
    throw new Error(`Provider not found for model "${effective}": ${parts.providerId}`);
  }
  const def = isRecord(provider.models) ? provider.models[parts.modelId] : null;
  return {
    id: effective,
    providerId: parts.providerId,
    provider,
    model: parts.modelId,
    def: isRecord(def) ? def : {},
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Default model id when a catalog provider was saved with an empty models map. */
const CATALOG_DEFAULT_MODEL_ID = {
  qwen: 'qwen-plus',
  volc_ark: 'doubao-seed-1-8-251228',
  google: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-4-6',
  deepseek: 'deepseek-chat',
  kimi: 'kimi-k2.6',
  openrouter: 'anthropic/claude-sonnet-4.6',
  minimax: 'MiniMax-M2.7',
};

function seedEmptyCatalogProviderModels(config) {
  if (!isRecord(config?.model?.providers)) return config;
  for (const [providerId, provider] of Object.entries(config.model.providers)) {
    if (!isRecord(provider)) continue;
    const models = isRecord(provider.models) ? provider.models : {};
    if (Object.keys(models).length > 0) continue;
    const defaultModelId = CATALOG_DEFAULT_MODEL_ID[providerId];
    if (!defaultModelId) continue;
    provider.models = { [defaultModelId]: {} };
  }
  return config;
}

function validateProvider(id, provider, errors) {
  if (!isRecord(provider)) {
    errors.push(`model.providers.${id} must be an object`);
    return;
  }
  const protocol = normalizeString(provider.protocol).toLowerCase();
  if (!protocol) errors.push(`model.providers.${id}.protocol is required`);
  else if (protocol !== 'openai' && protocol !== 'anthropic') {
    errors.push(`model.providers.${id}.protocol must be "openai" or "anthropic"`);
  }
  if (!normalizeString(provider.url)) errors.push(`model.providers.${id}.url is required`);
  const keySlots = normalizeProviderApiKeySlots(provider);
  if (keySlots.length === 0) errors.push(`model.providers.${id}.apiKey is required`);
  if (Array.isArray(provider.apiKeys) && provider.apiKeys.length > 3) {
    errors.push(`model.providers.${id}.apiKeys supports at most 3 backup keys (4 total including apiKey)`);
  }
  const modelIds = isRecord(provider.models) ? Object.keys(provider.models) : [];
  if (modelIds.length === 0) {
    errors.push(
      `model.providers.${id} 至少要启用一个模型（在「模型池」勾选模型芯片，或删除该供应商）`,
    );
  }
}

function validateToolCapabilityFallbacks(toolKey, toolConfig, errors) {
  if (!isRecord(toolConfig)) return;
  const fallbacks = toolConfig.fallbacks;
  if (fallbacks === undefined) return;
  if (!Array.isArray(fallbacks)) {
    errors.push(`tools.${toolKey}.fallbacks must be an array`);
    return;
  }
  if (fallbacks.length > MAX_TOOL_CAPABILITY_FALLBACKS) {
    errors.push(`tools.${toolKey}.fallbacks supports at most ${MAX_TOOL_CAPABILITY_FALLBACKS} entries`);
  }
  fallbacks.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`tools.${toolKey}.fallbacks[${index}] must be an object`);
    }
  });
}

function validateModelRef(config, ref, label, errors) {
  const modelRef = normalizeString(ref);
  if (!modelRef) return;
  if (!resolveModel(config, modelRef, { allowMissing: true })) {
    errors.push(`${label}="${modelRef}" doesn't resolve to a configured provider/model`);
  }
}

function validateRouterModelRefs(config, errors) {
  const router = config.router;
  if (!isRecord(router)) return;

  if (isRecord(router.scenarios)) {
    for (const [key, ref] of Object.entries(router.scenarios)) {
      validateModelRef(config, ref, `router.scenarios.${key}`, errors);
    }
  }

  if (isRecord(router.fallback)) {
    for (const [key, refs] of Object.entries(router.fallback)) {
      if (!Array.isArray(refs)) continue;
      refs.forEach((ref, index) => validateModelRef(config, ref, `router.fallback.${key}[${index}]`, errors));
    }
  }

  const tokenSaver = router.tokenSaver;
  if (!isRecord(tokenSaver)) return;

  validateModelRef(config, tokenSaver.judge, 'router.tokenSaver.judge', errors);

  if (isRecord(tokenSaver.tiers)) {
    for (const [key, tier] of Object.entries(tokenSaver.tiers)) {
      if (!isRecord(tier)) continue;
      validateModelRef(config, tier.model, `router.tokenSaver.tiers.${key}.model`, errors);
    }
  }
}

export function validatePilotDeckConfig(config) {
  const normalized = normalizePilotDeckConfig(seedEmptyCatalogProviderModels(config));
  const errors = [];
  const warnings = [];

  if (isRecord(normalized.model?.providers)) {
    for (const [providerId, provider] of Object.entries(normalized.model.providers)) {
      validateProvider(providerId, provider, errors);
    }
  }

  const mainRef = normalizeString(normalized.agent.model);
  if (!mainRef) {
    warnings.push('agent.model is empty; pick a model from model.providers.');
  } else {
    const main = resolveModel(normalized, mainRef, { allowMissing: true });
    if (!main) {
      errors.push(`agent.model="${mainRef}" doesn't resolve to a configured provider/model`);
    } else {
      validateProvider(main.providerId, main.provider, errors);
    }
  }

  if (normalized.memory?.enabled && normalizeString(normalized.memory.model)) {
    const ref = normalizeString(normalized.memory.model);
    if (ref !== 'inherit') {
      const memory = resolveModel(normalized, ref, { allowMissing: true });
      if (!memory) {
        errors.push(`memory.model="${ref}" doesn't resolve to a configured provider/model`);
      }
    }
  }

  validateRouterModelRefs(normalized, errors);

  if (isRecord(normalized.tools)) {
    validateToolCapabilityFallbacks('image', normalized.tools.image, errors);
    validateToolCapabilityFallbacks('video', normalized.tools.video, errors);
    validateToolCapabilityFallbacks('tts', normalized.tools.tts, errors);
    validateToolCapabilityFallbacks('speech', normalized.tools.speech, errors);
    validateToolCapabilityFallbacks('webSearch', normalized.tools.webSearch, errors);
    validateToolCapabilityFallbacks('search', normalized.tools.search, errors);
  }

  if (normalized.webui?.runtime?.contextWindow !== undefined) {
    warnings.push(
      'webui.runtime.contextWindow is deprecated and ignored. ' +
      'Use agent.maxContextTokens to override the model\'s context window for auto-compaction.',
    );
  }

  return { valid: errors.length === 0, errors, warnings, config: normalized };
}

// ─── Secret masking ──────────────────────────────────────────────────────────

function isSecretKey(key) {
  return SECRET_EXACT_KEYS.has(key) || SECRET_KEY_RE.test(key);
}

export function maskSecrets(value) {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (!isRecord(value)) return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSecretKey(key) && typeof child === 'string' && child.trim()) {
      output[key] = MASK;
    } else {
      output[key] = maskSecrets(child);
    }
  }
  return output;
}

export function preserveMaskedSecrets(nextValue, previousValue) {
  if (nextValue === MASK && typeof previousValue === 'string') return previousValue;
  if (Array.isArray(nextValue)) {
    return nextValue.map((item, index) =>
      preserveMaskedSecrets(item, Array.isArray(previousValue) ? previousValue[index] : undefined),
    );
  }
  if (isRecord(nextValue)) {
    const output = {};
    for (const [key, child] of Object.entries(nextValue)) {
      output[key] = preserveMaskedSecrets(child, isRecord(previousValue) ? previousValue[key] : undefined);
    }
    return output;
  }
  return nextValue;
}

// ─── Runtime env derivation ──────────────────────────────────────────────────

function providerProtocolToMemoryApi(protocol) {
  // V2 catalog only uses 'openai' (Chat Completions) and 'anthropic'.
  // The /responses style is only relevant when a user manually sets
  // memory.apiType, which they can do alongside protocol="openai".
  return 'openai-completions';
}

const OPENAI_PLACEHOLDER_BASE_URLS = new Set([
  'https://api.openai.com/v1',
  'https://api.openai.com',
]);

const MEDIA_DEFAULT_BASE_URL = {
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  baidu: 'https://qianfan.baidubce.com/v2',
};

function normalizeGoogleNativeApiBaseUrl(url) {
  const trimmed = normalizeString(url).replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.replace(/\/openai$/i, '');
}

function expandEnvApiKey(value) {
  const trimmed = normalizeString(value);
  if (!trimmed || /^\*+$/.test(trimmed)) return '';
  const match = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(trimmed);
  if (!match) return trimmed;
  return normalizeString(process.env[match[1]]);
}

function readPoolApiKey(config, mediaProvider) {
  const providers = config?.model?.providers;
  if (!isRecord(providers)) return '';
  const ids =
    mediaProvider === 'qwen'
      ? ['qwen', 'dashscope']
      : mediaProvider === 'volcengine'
        ? ['volc_ark', 'volcengine']
        : mediaProvider === 'google'
          ? ['google']
          : mediaProvider === 'baidu'
            ? ['baidu', 'qianfan']
            : [];
  for (const id of ids) {
    const provider = providers[id];
    if (!isRecord(provider)) continue;
    for (const slot of normalizeProviderApiKeySlots(provider)) {
      const key = expandEnvApiKey(slot);
      if (key) return key;
    }
  }
  return '';
}

function coalesceMediaBaseUrlForEnv(explicit, effective, mediaProvider) {
  const trimmed = normalizeString(explicit).replace(/\/+$/, '');
  if (!trimmed) return normalizeString(effective);
  if (mediaProvider !== 'openai-compatible' && OPENAI_PLACEHOLDER_BASE_URLS.has(trimmed)) {
    return normalizeString(effective) || trimmed;
  }
  if (mediaProvider === 'google') {
    return normalizeGoogleNativeApiBaseUrl(trimmed || effective);
  }
  return trimmed;
}

function applyYixiaoerRuntimeEnv(env, config) {
  const yixiaoer = config?.tools?.yixiaoer;
  if (!isRecord(yixiaoer) && !normalizeString(process.env.YIXIAOER_API_KEY)) {
    return;
  }
  const configKey = expandEnvApiKey(yixiaoer?.apiKey);
  const apiKey = configKey || normalizeString(process.env.YIXIAOER_API_KEY);
  if (apiKey) env.YIXIAOER_API_KEY = apiKey;
  const configUrl = normalizeString(yixiaoer?.apiUrl);
  const apiUrl = configUrl || normalizeString(process.env.YIXIAOER_API_URL);
  if (apiUrl) env.YIXIAOER_API_URL = apiUrl;

  const wrapper = path.join(REPO_ROOT, 'scripts', 'yixiaoer-api.mjs');
  if (fs.existsSync(wrapper)) {
    env.PILOTDECK_YIXIAOER_API = wrapper;
  }
  const skillHome = path.join(os.homedir(), '.pilotdeck', 'skills', 'yixiaoer');
  const skillRepo = path.join(REPO_ROOT, 'skills', 'yixiaoer');
  if (fs.existsSync(skillHome)) {
    env.PILOTDECK_YIXIAOER_SKILL_DIR = skillHome;
  } else if (fs.existsSync(skillRepo)) {
    env.PILOTDECK_YIXIAOER_SKILL_DIR = skillRepo;
  }
}

function applyMediaToolsRuntimeEnv(env, config) {
  const tools = config?.tools;
  if (!isRecord(tools)) return;

  const applyOne = (toolConfig, prefix, defaultProvider) => {
    if (!isRecord(toolConfig)) return;
    const provider = normalizeString(toolConfig.provider) || defaultProvider;
    let apiKey = expandEnvApiKey(toolConfig.apiKey);
    const poolKey = readPoolApiKey(config, provider);
    const toolKeyMatchesProvider =
      apiKey &&
      (provider === 'qwen'
        ? /^sk-/i.test(apiKey)
        : provider === 'google'
          ? /^AIza/i.test(apiKey)
          : true);
    if (!toolKeyMatchesProvider && poolKey) apiKey = poolKey;
    else if (!apiKey) apiKey = poolKey;
    if (!apiKey && provider === 'qwen') apiKey = normalizeString(process.env.DASHSCOPE_API_KEY);
    if (!apiKey && provider === 'volcengine') {
      apiKey =
        normalizeString(process.env.VOLCENGINE_API_KEY) ||
        normalizeString(process.env.VOLC_ARK_API_KEY);
    }
    if (!apiKey && provider === 'google') apiKey = normalizeString(process.env.GOOGLE_API_KEY);

    const poolBase =
      provider === 'qwen'
        ? normalizeString(config?.model?.providers?.qwen?.url)
        : provider === 'volcengine'
          ? normalizeString(config?.model?.providers?.volc_ark?.url) ||
            normalizeString(config?.model?.providers?.volcengine?.url)
          : provider === 'google'
            ? normalizeGoogleNativeApiBaseUrl(config?.model?.providers?.google?.url)
            : '';
    const baseUrl = coalesceMediaBaseUrlForEnv(
      toolConfig.baseUrl,
      normalizeString(poolBase) || MEDIA_DEFAULT_BASE_URL[provider] || '',
      provider,
    );

    if (provider) env[`PILOTDECK_${prefix}_PROVIDER`] = provider;
    if (apiKey) {
      env[`PILOTDECK_${prefix}_API_KEY`] = apiKey;
      if (provider === 'qwen') env.DASHSCOPE_API_KEY = apiKey;
      if (provider === 'volcengine') env.VOLCENGINE_API_KEY = apiKey;
      if (provider === 'google') env.GOOGLE_API_KEY = apiKey;
    }
    if (baseUrl) env[`PILOTDECK_${prefix}_BASE_URL`] = baseUrl;
    if (normalizeString(toolConfig.model)) env[`PILOTDECK_${prefix}_MODEL`] = normalizeString(toolConfig.model);
  };

  applyOne(tools.image, 'IMAGE', 'qwen');
  applyOne(tools.video, 'VIDEO', 'volcengine');
  applyOne(tools.tts, 'TTS', 'qwen');
  applyOne(tools.speech, 'SPEECH', 'qwen');
}

// PD-SAAS-FORK: inject B-tier skill service API keys (fal, Typefully, VideoDB, etc.)
function applySkillServicesRuntimeEnv(env, config) {
  const services = config?.tools?.skillServices;
  if (!isRecord(services)) return;

  const inject = (field, envName) => {
    const block = services[field];
    if (!isRecord(block)) return;
    const apiKey = expandEnvApiKey(block.apiKey);
    if (apiKey) env[envName] = apiKey;
  };

  inject('fal', 'FAL_KEY');
  inject('typefully', 'TYPEFULLY_API_KEY');
  inject('videodb', 'VIDEO_DB_API_KEY');
  inject('music', 'PILOTDECK_SKILL_MUSIC_API_KEY');
  inject('wonda', 'PILOTDECK_SKILL_WONDA_API_KEY');
  if (isRecord(services.wonda)) {
    const wondaKey = expandEnvApiKey(services.wonda.apiKey);
    if (wondaKey) env.WONDA_API_KEY = wondaKey;
  }
  inject('nutrient', 'NUTRIENT_API_KEY');
  inject('sentry', 'SENTRY_DSN');

  const googlePoolKey = readPoolApiKey(config, 'google');
  if (googlePoolKey && /^AIza/i.test(googlePoolKey)) {
    env.PILOTDECK_NANOBANANA_GOOGLE_KEY = googlePoolKey;
  }
}

// PD-SAAS-FORK: inject document compose/OCR env for Agent builtins and UI export jobs
export function applyDocumentToolsRuntimeEnv(env, config) {
  const tools = config?.tools;
  if (!isRecord(tools)) return;

  const compose = tools.documentCompose;
  if (isRecord(compose)) {
    const aspectRatio = normalizeString(compose.aspectRatio) || '16:9';
    env.PILOTDECK_DOCUMENT_COMPOSE_ASPECT_RATIO = aspectRatio;
  }

  const documentBlock = tools.document;
  const exportCfg = isRecord(tools.documentExport)
    ? tools.documentExport
    : isRecord(documentBlock?.export)
      ? documentBlock.export
      : null;
  if (isRecord(exportCfg)) {
    const cloud = normalizeString(exportCfg.cloudPreference) || 'cloud_first';
    const quality = normalizeString(exportCfg.defaultQuality) || 'balanced';
    env.PILOTDECK_DOCUMENT_EXPORT_CLOUD = cloud;
    env.PILOTDECK_DOCUMENT_EXPORT_QUALITY = quality;
    const poolSize = exportCfg.playwright?.poolSize;
    if (typeof poolSize === 'number' && poolSize > 0) {
      env.PILOTDECK_DOCUMENT_EXPORT_POOL_SIZE = String(poolSize);
    }
    const nutrientKey = expandEnvApiKey(exportCfg.nutrient?.apiKey)
      || normalizeString(process.env.NUTRIENT_API_KEY);
    if (nutrientKey) {
      env.NUTRIENT_API_KEY = nutrientKey;
      env.PILOTDECK_NUTRIENT_API_KEY = nutrientKey;
    }
  }

  const ocr = isRecord(tools.documentOcr) ? tools.documentOcr : documentBlock?.ocr;
  if (!isRecord(ocr)) return;

  const provider = normalizeString(ocr.provider) || 'mineru';
  const mode = normalizeString(ocr.mode) || 'cloud';
  let apiKey = expandEnvApiKey(ocr.apiKey);
  const poolKey = readPoolApiKey(config, 'qwen');
  const mineruKeyMatches = apiKey && /^eyJ/i.test(apiKey);
  if (provider === 'mineru' && !mineruKeyMatches) {
    apiKey = normalizeString(process.env.MINERU_API_TOKEN) || '';
  }
  const qwenKey =
    provider === 'qwen-vl'
      ? poolKey || (/^sk-/i.test(apiKey) ? apiKey : '')
      : poolKey;
  const apiUrl =
    normalizeString(ocr.apiUrl) ||
    (mode === 'local' ? 'http://127.0.0.1:8000' : 'https://mineru.net/api/v4');
  const model = normalizeString(ocr.model) || 'qwen-vl-max';
  const fallback = normalizeString(ocr.fallbackProvider) || 'qwen-vl';

  env.PILOTDECK_DOCUMENT_OCR_PROVIDER = provider;
  env.PILOTDECK_DOCUMENT_OCR_MODE = mode;
  env.PILOTDECK_DOCUMENT_OCR_API_URL = apiUrl.replace(/\/+$/, '');
  env.PILOTDECK_DOCUMENT_OCR_MODEL = model;
  env.PILOTDECK_DOCUMENT_OCR_FALLBACK = fallback;
  if (mineruKeyMatches || (provider === 'mineru' && apiKey)) {
    env.MINERU_API_TOKEN = apiKey;
    env.PILOTDECK_DOCUMENT_OCR_API_KEY = apiKey;
  }
  if (qwenKey) {
    env.DASHSCOPE_API_KEY = qwenKey;
    if (provider === 'qwen-vl') {
      env.PILOTDECK_DOCUMENT_OCR_API_KEY = qwenKey;
    }
  }

  const baiduAi = isRecord(tools.baiduAi) ? tools.baiduAi : null;
  const baiduKey = expandEnvApiKey(baiduAi?.apiKey) || normalizeString(process.env.BAIDU_API_KEY);
  const baiduSecret = expandEnvApiKey(baiduAi?.secretKey) || normalizeString(process.env.BAIDU_SECRET_KEY);
  if (baiduKey) env.BAIDU_API_KEY = baiduKey;
  if (baiduSecret) env.BAIDU_SECRET_KEY = baiduSecret;

  const extractorMethod =
    normalizeString(ocr.extractorMethod) ||
    normalizeString(process.env.PILOTDECK_DOCUMENT_EXTRACTOR_METHOD) ||
    'hybrid';
  const inpaintMethod =
    normalizeString(ocr.inpaintMethod) ||
    normalizeString(process.env.PILOTDECK_INPAINT_METHOD) ||
    'baidu';
  env.PILOTDECK_DOCUMENT_EXTRACTOR_METHOD = extractorMethod;
  env.PILOTDECK_INPAINT_METHOD = inpaintMethod;
  env.PPT_EXPORT_MINERU_CACHE = env.PPT_EXPORT_MINERU_CACHE || '1';
  env.PPT_EXPORT_DEFAULT_INPAINT_METHOD = inpaintMethod === 'pil_fallback' ? 'pil' : 'baidu';
  env.PPT_EXPORT_INPAINT_ENHANCE_QUALITY = env.PPT_EXPORT_INPAINT_ENHANCE_QUALITY || '0';
  env.PPT_EXPORT_MAX_WORKERS = env.PPT_EXPORT_MAX_WORKERS || '4';
}

// PD-SAAS-FORK: inject document import env (separate from media/export)
export function applyDocumentImportRuntimeEnv(env, config) {
  const tools = config?.tools;
  if (!isRecord(tools)) return;

  const documentBlock = tools.document;
  const importCfg = isRecord(tools.documentImport)
    ? tools.documentImport
    : isRecord(documentBlock?.import)
      ? documentBlock.import
      : null;
  if (!isRecord(importCfg)) {
    env.PILOTDECK_DOCUMENT_IMPORT_ENABLED = env.PILOTDECK_DOCUMENT_IMPORT_ENABLED || '1';
    return;
  }

  if (typeof importCfg.enabled === 'boolean') {
    env.PILOTDECK_DOCUMENT_IMPORT_ENABLED = importCfg.enabled ? '1' : '0';
  } else {
    env.PILOTDECK_DOCUMENT_IMPORT_ENABLED = env.PILOTDECK_DOCUMENT_IMPORT_ENABLED || '1';
  }

  const cloud = normalizeString(importCfg.cloudPreference) || 'local_first';
  env.PILOTDECK_DOCUMENT_IMPORT_CLOUD = cloud;

  if (typeof importCfg.workerConcurrency === 'number' && importCfg.workerConcurrency > 0) {
    env.PILOTDECK_IMPORT_WORKER_CONCURRENCY = String(importCfg.workerConcurrency);
  }
  if (typeof importCfg.timeoutMs === 'number' && importCfg.timeoutMs >= 1000) {
    env.PILOTDECK_IMPORT_TIMEOUT_MS = String(importCfg.timeoutMs);
  }
  if (isRecord(importCfg.maxFileBytes)) {
    if (typeof importCfg.maxFileBytes.pdf === 'number' && importCfg.maxFileBytes.pdf > 0) {
      env.PILOTDECK_DOCUMENT_IMPORT_MAX_PDF_BYTES = String(importCfg.maxFileBytes.pdf);
    }
    if (typeof importCfg.maxFileBytes.office === 'number' && importCfg.maxFileBytes.office > 0) {
      env.PILOTDECK_DOCUMENT_IMPORT_MAX_OFFICE_BYTES = String(importCfg.maxFileBytes.office);
    }
  }
  if (isRecord(importCfg.truncate)) {
    if (typeof importCfg.truncate.maxChars === 'number' && importCfg.truncate.maxChars > 0) {
      env.PILOTDECK_DOCUMENT_IMPORT_MAX_CHARS = String(importCfg.truncate.maxChars);
    }
    if (typeof importCfg.truncate.maxTableRows === 'number' && importCfg.truncate.maxTableRows > 0) {
      env.PILOTDECK_DOCUMENT_IMPORT_MAX_TABLE_ROWS = String(importCfg.truncate.maxTableRows);
    }
  }
  const fallback = normalizeString(importCfg.fallbackProvider);
  if (fallback === 'mineru' || fallback === 'qwen-vl') {
    env.PILOTDECK_DOCUMENT_IMPORT_FALLBACK = fallback;
  }
}

export function buildRuntimeEnv(config) {
  const normalized = normalizePilotDeckConfig(config);
  const main = resolveModel(normalized, normalized.agent.model, { allowMissing: true });
  const runtime = normalized.webui?.runtime ?? {};

  const env = {
    SERVER_PORT: process.env.SERVER_PORT || String(runtime.serverPort ?? 3001),
    VITE_PORT: process.env.VITE_PORT || String(runtime.vitePort ?? 5173),
    HOST: process.env.HOST || String(runtime.host ?? '0.0.0.0'),
    API_TIMEOUT_MS: String(runtime.apiTimeoutMs ?? 120000),
    PILOTDECK_MEMORY_ENABLED: normalized.memory?.enabled ? '1' : '0',
    PILOTDECK_MEDIA_STRATEGY_RESOLVER:
      process.env.PILOTDECK_MEDIA_STRATEGY_RESOLVER
      ?? (runtime.workspacesRoot || normalized.webui?.runtime?.workspacesRoot ? '1' : '0'),
  };

  if (runtime.databasePath) env.DATABASE_PATH = expandTilde(runtime.databasePath);
  if (runtime.workspacesRoot) env.WORKSPACES_ROOT = expandTilde(runtime.workspacesRoot);
  const proxyUrl = normalized.proxy?.url
    || (typeof normalized.proxy === 'string' ? normalized.proxy : '')
    || runtime.httpsProxy || '';
  if (proxyUrl) {
    env.HTTPS_PROXY = proxyUrl;
    env.https_proxy = proxyUrl;
  }

  if (main) {
    env.PILOTDECK_API_BASE_URL = main.provider.url || '';
    env.PILOTDECK_API_KEY = main.provider.apiKey || '';
    env.PILOTDECK_MODEL = main.model;
    env.OPENAI_BASE_URL = main.provider.url || '';
    env.OPENAI_API_KEY = main.provider.apiKey || '';
    env.OPENAI_MODEL = main.model;
    env.ANTHROPIC_API_KEY = main.provider.apiKey || '';
    env.ANTHROPIC_MODEL = main.model;
  }

  // Reasoning models (DeepSeek-R1, MiniMax-M2.7, etc.) need a generous
  // output token cap; honor agent.params.maxOutputTokens / max_tokens.
  const mainParams = normalized.agent?.params ?? {};
  const requestedMaxOutput = Number.parseInt(
    String(
      mainParams.maxOutputTokens ??
        mainParams.max_output_tokens ??
        mainParams.max_tokens ??
        ''
    ).trim(),
    10,
  );
  if (Number.isFinite(requestedMaxOutput) && requestedMaxOutput > 0) {
    env.PILOTDECK_MAX_OUTPUT_TOKENS = String(requestedMaxOutput);
  } else if (process.env.PILOTDECK_MAX_OUTPUT_TOKENS) {
    env.PILOTDECK_MAX_OUTPUT_TOKENS = process.env.PILOTDECK_MAX_OUTPUT_TOKENS;
  }

  const tavilyKey = mainParams.tavilyApiKey ?? mainParams.tavily_api_key ?? process.env.TAVILY_API_KEY;
  if (tavilyKey) env.TAVILY_API_KEY = String(tavilyKey);

  // Memory uses memory.model (or inherits agent.model when blank).
  const memoryRef = normalizeString(normalized.memory?.model) || normalized.agent.model;
  const memory = resolveModel(normalized, memoryRef, { allowMissing: true });
  if (memory) {
    env.PILOTDECK_MEMORY_MODEL = memory.model;
    env.PILOTDECK_MEMORY_PROVIDER = memory.providerId;
    env.PILOTDECK_MEMORY_BASE_URL = memory.provider.url || '';
    env.PILOTDECK_MEMORY_API_KEY = memory.provider.apiKey || '';
    env.PILOTDECK_MEMORY_API_TYPE = normalizeString(normalized.memory?.apiType)
      || providerProtocolToMemoryApi(memory.provider.protocol);
  }

  // Pass through customEnv (UI-managed escape hatch).
  if (isRecord(normalized.customEnv)) {
    for (const [key, value] of Object.entries(normalized.customEnv)) {
      if (typeof value === 'string' && value.trim()) env[key] = value;
    }
  }

  applyMediaToolsRuntimeEnv(env, normalized);
  applyDocumentToolsRuntimeEnv(env, normalized);
  applyDocumentImportRuntimeEnv(env, normalized);
  applySkillServicesRuntimeEnv(env, normalized);
  applyYixiaoerRuntimeEnv(env, normalized);

  return env;
}

export function applyConfigToProcessEnv(config) {
  Object.assign(process.env, buildRuntimeEnv(config));
}

// ─── Memory service options ──────────────────────────────────────────────────

export function buildMemoryLlmOptions(config) {
  const normalized = normalizePilotDeckConfig(config);
  const ref = normalizeString(normalized.memory?.model) || normalized.agent.model;
  const memory = resolveModel(normalized, ref, { allowMissing: true });
  if (!memory) return undefined;
  return {
    provider: memory.providerId,
    model: memory.model,
    apiType: normalizeString(normalized.memory?.apiType)
      || providerProtocolToMemoryApi(memory.provider.protocol),
    baseUrl: memory.provider.url || '',
    apiKey: memory.provider.apiKey || '',
    headers: isRecord(memory.provider.headers) ? memory.provider.headers : {},
  };
}

export function buildMemoryDefaults(config) {
  const memory = normalizePilotDeckConfig(config).memory ?? {};
  return {
    llm: buildMemoryLlmOptions(config),
    defaultIndexingSettings: {
      reasoningMode: memory.reasoningMode,
      autoIndexIntervalMinutes: memory.autoIndexIntervalMinutes,
      autoDreamIntervalMinutes: memory.autoDreamIntervalMinutes,
    },
    captureStrategy: memory.captureStrategy,
    includeAssistant: memory.includeAssistant,
    maxMessageChars: memory.maxMessageChars,
    heartbeatBatchSize: memory.heartbeatBatchSize,
  };
}

// ─── File I/O ────────────────────────────────────────────────────────────────

export function getPilotDeckConfigPath() {
  if (process.env.PILOTDECK_CONFIG_PATH?.trim()) {
    return process.env.PILOTDECK_CONFIG_PATH.trim();
  }
  return DEFAULT_CONFIG_PATH;
}

export function readPilotDeckConfigFile() {
  const configPath = getPilotDeckConfigPath();
  if (!fs.existsSync(configPath)) {
    return {
      exists: false,
      configPath,
      raw: '',
      config: buildDefaultPilotDeckConfig(),
      rawYaml: {},
    };
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = parseYaml(raw) || {};
  const config = normalizePilotDeckConfig(parsed);
  return { exists: true, configPath, raw, config, rawYaml: parsed };
}

// Keep `router.scenarios.default` aligned with `agent.model` whenever we
// write the config. The gateway treats agent.model as the source of truth
// (loadPilotConfig.ts auto-overrides router.scenarios.default with
// agent.model on conflict, with a warning). Doing the rewrite here too
// means the on-disk yaml stays consistent — no stale router refs left
// over from before the user picked a new model in onboarding/settings.
//
// Scope is deliberately narrow:
//   • only touches `router.scenarios.default` (not tokenSaver tiers,
//     fallback chains, or other scenario keys — those are user-curated)
//   • no-ops when agent.model is empty or unparseable
//   • no-ops when router block doesn't exist (won't create one)
export function syncAgentModelWithRouter(config) {
  if (!isRecord(config)) return config;
  const agentRef = normalizeString(config.agent?.model);
  if (!agentRef) return config;
  const slash = agentRef.indexOf('/');
  if (slash <= 0 || slash >= agentRef.length - 1) return config;
  const providerId = agentRef.slice(0, slash);
  const modelId = agentRef.slice(slash + 1);

  if (!isRecord(config.router)) return config;
  if (!isRecord(config.router.scenarios)) return config;
  const currentDefault = config.router.scenarios.default;
  // Accept both string ("provider/model") and object ref shapes.
  const currentId = typeof currentDefault === 'string'
    ? currentDefault.trim()
    : (isRecord(currentDefault) ? normalizeString(currentDefault.id) : '');
  if (currentId === agentRef) return config;
  config.router.scenarios.default = typeof currentDefault === 'string'
    ? agentRef
    : { id: agentRef, provider: providerId, model: modelId };
  return config;
}

const BOOTSTRAP_PLACEHOLDER_KEY = 'PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE';

// Remove bootstrap placeholder providers — both the new `_placeholder` name
// and any legacy provider whose apiKey is still the onboarding sentinel.
// Called automatically on every config write so stale placeholders disappear
// as soon as the user saves real provider details.
function purgeBootstrapPlaceholder(config) {
  if (!isRecord(config)) return config;
  const providers = config?.model?.providers;
  if (isRecord(providers)) {
    for (const [pid, prov] of Object.entries(providers)) {
      if (pid === '_placeholder' || normalizeString(prov?.apiKey) === BOOTSTRAP_PLACEHOLDER_KEY) {
        delete providers[pid];
      }
    }
  }

  const agentModel = normalizeString(config?.agent?.model);
  if (agentModel === '_placeholder/_placeholder') {
    const realProviders = isRecord(providers) ? Object.keys(providers) : [];
    if (realProviders.length > 0) {
      const firstProvider = realProviders[0];
      const models = Object.keys(providers[firstProvider]?.models ?? {});
      if (models.length > 0) {
        config.agent.model = `${firstProvider}/${models[0]}`;
      }
    }
  }

  const router = config?.router;
  if (!isRecord(router)) return config;

  const agentRef = normalizeString(config.agent?.model);
  const survivingProviders = isRecord(providers) ? new Set(Object.keys(providers)) : new Set();

  function isOrphanRef(ref) {
    const s = normalizeString(ref);
    if (!s) return false;
    const slash = s.indexOf('/');
    if (slash <= 0) return false;
    return !survivingProviders.has(s.slice(0, slash));
  }

  if (isRecord(router.scenarios)) {
    for (const [key, val] of Object.entries(router.scenarios)) {
      if (isOrphanRef(val)) router.scenarios[key] = agentRef || val;
    }
  }
  if (Array.isArray(router.fallback?.default)) {
    router.fallback.default = router.fallback.default.map(
      v => isOrphanRef(v) ? (agentRef || v) : v
    );
  }
  if (isRecord(router.tokenSaver)) {
    if (isOrphanRef(router.tokenSaver.judge)) {
      router.tokenSaver.judge = agentRef || router.tokenSaver.judge;
    }
    if (isRecord(router.tokenSaver.tiers)) {
      for (const tier of Object.values(router.tokenSaver.tiers)) {
        if (isRecord(tier) && isOrphanRef(tier.model)) {
          tier.model = agentRef || tier.model;
        }
      }
    }
  }

  return config;
}

// Lossless writer — config object is the V2 disk shape, written verbatim
// after running through validation. UI-internal === disk schema, so
// there's no read-modify-write needed anymore (the previous translation
// layer existed only to bridge an older internal schema).
export async function writePilotDeckConfig(config) {
  const sanitized = seedEmptyCatalogProviderModels(
    purgeBootstrapPlaceholder(
      syncAgentModelWithRouter(
        sanitizeProviderCredentials(
          isRecord(config) ? deepMerge({}, config) : config,
        ),
      ),
    ),
  );
  if (isRecord(sanitized.memory)) {
    const memModel = sanitized.memory.model;
    if (typeof memModel === 'string' && !memModel.trim()) {
      delete sanitized.memory.model;
    }
  }
  const validation = validatePilotDeckConfig(sanitized);
  if (!validation.valid) {
    const error = new Error('Invalid PilotDeck config');
    error.validation = validation;
    throw error;
  }
  const configPath = getPilotDeckConfigPath();
  await fsPromises.mkdir(path.dirname(configPath), { recursive: true });
  const yamlObj = validation.config;
  if (isRecord(yamlObj.memory)) {
    const memModel = yamlObj.memory.model;
    if (typeof memModel === 'string' && !memModel.trim()) {
      delete yamlObj.memory.model;
    }
  }
  const raw = stringifyYaml(yamlObj, { lineWidth: 0 });
  await fsPromises.writeFile(configPath, raw, 'utf8');
  return { configPath, raw, validation, config: yamlObj };
}

// Kept as a thin alias for callers that supply an already-parsed YAML
// object (Raw YAML editor path). Behaviour is identical to
// writePilotDeckConfig now that internal === disk.
export async function writeRawPilotDeckYaml(yamlObj) {
  return writePilotDeckConfig(yamlObj);
}

export function expandTilde(value) {
  const text = normalizeString(value);
  if (text === '~') return os.homedir();
  if (text.startsWith('~/')) return path.join(os.homedir(), text.slice(2));
  return text;
}

export function configToYaml(config) {
  const normalized = normalizePilotDeckConfig(config);
  return stringifyYaml(normalized, { lineWidth: 0 });
}

// Lossless masked serialization for the "Raw YAML" view. Now that
// internal === disk, this is just `stringifyYaml(maskSecrets(rawYaml))`.
export function rawYamlToMaskedString(rawYaml) {
  const obj = isRecord(rawYaml) ? rawYaml : {};
  return stringifyYaml(maskSecrets(obj), { lineWidth: 0 });
}

export function parseConfigYaml(raw) {
  return normalizePilotDeckConfig(parseYaml(raw) || {});
}
