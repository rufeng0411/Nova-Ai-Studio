import express from 'express';
import {
  annotateModelsWithKinds,
  filterModelsByKinds,
  supplementsAsModels,
} from '../data/listModelsSupplements.js';
import { readPilotDeckConfigFile } from '../services/pilotdeckConfig.js';

const router = express.Router();

const DEFAULT_TIMEOUT_MS = 15_000;
const GOOGLE_PAGE_SIZE = 1000;
const MAX_GOOGLE_PAGES = 20;

function readJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function expandEnvPlaceholders(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] || '');
}

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  if (!value) return 'openai-compatible';
  if (value === 'volc_ark') return 'volcengine';
  if (value === 'dashscope') return 'qwen';
  if (value === 'glm' || value === 'bigmodel') return 'zhipu';
  if (value === 'moonshot') return 'kimi';
  if (value === 'openai_compatible') return 'openai-compatible';
  return value;
}

const LOCAL_OPTIONAL_KEY_PROVIDERS = new Set(['ollama', 'lmstudio', 'vllm', 'openai-compatible']);

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

async function runWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function modelEntryId(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const id = readString(entry.id) || readString(entry.model) || readString(entry.model_id);
  if (id) return id;
  const name = readString(entry.name);
  if (name.startsWith('models/')) return name.slice('models/'.length);
  return name;
}

function modelEntryLabel(entry, id) {
  const label =
    readString(entry.displayName) ||
    readString(entry.display_name) ||
    readString(entry.label) ||
    readString(entry.name) ||
    id;
  if (label.startsWith('models/')) return label.slice('models/'.length);
  return label || id;
}

function dedupeModels(models) {
  const byId = new Map();
  for (const entry of models) {
    const id = readString(entry?.id);
    if (!id) continue;
    const normalized = {
      id,
      label: readString(entry?.label) || id,
      ...(entry?.ownedBy ? { ownedBy: entry.ownedBy } : {}),
      ...(Array.isArray(entry?.kinds) && entry.kinds.length > 0 ? { kinds: entry.kinds } : {}),
    };
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, normalized);
      continue;
    }
    if (!existing.kinds?.length && normalized.kinds?.length) {
      byId.set(id, { ...existing, kinds: normalized.kinds });
    }
  }
  return [...byId.values()];
}

function mergeModelLists(...lists) {
  return dedupeModels(lists.flat());
}

function normalizeRows(rows) {
  return rows
    .map((entry) => {
      const id = modelEntryId(entry);
      if (!id) return null;
      return {
        id,
        label: modelEntryLabel(entry, id),
        ownedBy: readString(entry.owned_by) || readString(entry.ownedBy) || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeOpenAiModels(body) {
  const rows = Array.isArray(body?.data) ? body.data : [];
  return normalizeRows(rows);
}

function normalizeGoogleModels(body) {
  const rows = Array.isArray(body?.models) ? body.models : [];
  return normalizeRows(rows);
}

function normalizeNestedModels(body) {
  const rows = Array.isArray(body?.data?.models)
    ? body.data.models
    : Array.isArray(body?.models)
      ? body.models
      : Array.isArray(body?.result?.models)
        ? body.result.models
        : [];
  return normalizeRows(rows);
}

function collectArrayCandidates(body) {
  const candidates = [];
  if (Array.isArray(body?.data)) candidates.push(body.data);
  if (Array.isArray(body?.models)) candidates.push(body.models);
  if (Array.isArray(body?.items)) candidates.push(body.items);
  if (Array.isArray(body?.result?.Items)) candidates.push(body.result.Items);
  if (Array.isArray(body?.result?.items)) candidates.push(body.result.items);
  return candidates.flat();
}

function normalizeGenericModels(body) {
  const rows = collectArrayCandidates(body);
  if (rows.length === 0) return [];
  return normalizeRows(rows);
}

async function fetchJson(url, headers, timeoutMs) {
  const response = await runWithTimeout(
    (signal) => fetch(url, { method: 'GET', headers, signal }),
    timeoutMs,
  );
  const text = await response.text();
  const json = readJsonSafe(text);
  if (!response.ok) {
    const detail =
      json?.error?.message ||
      json?.message ||
      json?.error_msg ||
      `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return json;
}

async function listModelsViaOpenAiLike(baseUrl, apiKey, timeoutMs) {
  if (!baseUrl) {
    throw new Error('baseUrl is required for OpenAI-compatible model discovery.');
  }
  const url = `${normalizeBaseUrl(baseUrl)}/models`;
  const headers = { Accept: 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const json = await fetchJson(url, headers, timeoutMs);
  return normalizeOpenAiModels(json);
}

async function listModelsViaGoogle(baseUrl, apiKey, timeoutMs) {
  const root = normalizeBaseUrl(baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(
    /\/openai$/,
    '',
  );
  const all = [];
  let pageToken = '';
  for (let page = 0; page < MAX_GOOGLE_PAGES; page += 1) {
    const params = new URLSearchParams({
      key: apiKey,
      pageSize: String(GOOGLE_PAGE_SIZE),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const json = await fetchJson(
      `${root}/models?${params.toString()}`,
      { Accept: 'application/json' },
      timeoutMs,
    );
    all.push(...normalizeGoogleModels(json));
    pageToken = readString(json?.nextPageToken);
    if (!pageToken) break;
  }

  let openAiCompat = [];
  try {
    openAiCompat = await listModelsViaOpenAiLike(`${root}/openai`, apiKey, timeoutMs);
  } catch {
    // optional secondary source
  }

  return mergeModelLists(all, openAiCompat);
}

function dashScopeApiOrigin(baseUrl) {
  const root = normalizeBaseUrl(baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  if (/dashscope-intl\.aliyuncs\.com/i.test(root)) {
    return 'https://dashscope-intl.aliyuncs.com';
  }
  return 'https://dashscope.aliyuncs.com';
}

async function listModelsViaQwen(baseUrl, apiKey, timeoutMs) {
  const root = normalizeBaseUrl(baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  const apiOrigin = dashScopeApiOrigin(root);
  const attempts = [];

  try {
    const openAiModels = await listModelsViaOpenAiLike(root, apiKey, timeoutMs);
    attempts.push(...openAiModels);
  } catch {
    // continue — compatible /models often omits image/video/TTS models
  }

  for (const modelsUrl of [
    `${apiOrigin}/api/v1/models`,
    `${root.replace(/\/compatible-mode\/v1$/, '')}/api/v1/models`,
  ]) {
    try {
      const json = await fetchJson(
        modelsUrl,
        {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        timeoutMs,
      );
      attempts.push(...normalizeGenericModels(json), ...normalizeOpenAiModels(json));
    } catch {
      // continue
    }
  }

  // Remote list may fail (key/region/network) or return only chat models.
  // Caller merges curated supplements (image/video/TTS) in finalizeModelList.
  return mergeModelLists(attempts);
}

async function listModelsViaVolcengine(baseUrl, apiKey, timeoutMs) {
  const root = normalizeBaseUrl(baseUrl || 'https://ark.cn-beijing.volces.com/api/v3');
  const attempts = [];

  try {
    const openAiModels = await listModelsViaOpenAiLike(root, apiKey, timeoutMs);
    attempts.push(...openAiModels);
  } catch {
    // continue
  }

  for (const suffix of ['/models', '/endpoints']) {
    try {
      const json = await fetchJson(
        `${root}${suffix}`,
        {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        timeoutMs,
      );
      attempts.push(
        ...normalizeOpenAiModels(json),
        ...normalizeNestedModels(json),
        ...normalizeGenericModels(json),
      );
    } catch {
      // continue
    }
  }

  if (attempts.length === 0) {
    throw new Error(
      '火山方舟未返回可解析的模型列表。请确认 API Key，或在模型字段手动填写推理接入点 ID（ep-xxx）。',
    );
  }

  return mergeModelLists(attempts);
}

async function listModelsViaBaidu(baseUrl, apiKey, timeoutMs) {
  const root = baseUrl || 'https://qianfan.baidubce.com/v2';
  const [ak, sk] = String(apiKey || '').split('|');
  if (!ak || !sk) {
    throw new Error('Baidu provider requires apiKey as "AK|SK" for model discovery.');
  }
  const tokenResponse = await runWithTimeout(
    (signal) =>
      fetch(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(ak)}&client_secret=${encodeURIComponent(sk)}`,
        { method: 'POST', signal },
      ),
    timeoutMs,
  );
  const tokenText = await tokenResponse.text();
  const tokenJson = readJsonSafe(tokenText);
  if (!tokenResponse.ok || !tokenJson?.access_token) {
    throw new Error(tokenJson?.error_description || 'Failed to get Baidu access token.');
  }
  const json = await fetchJson(
    `${normalizeBaseUrl(root)}/model/list`,
    {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: 'application/json',
    },
    timeoutMs,
  );
  const rows = Array.isArray(json?.data) ? json.data : [];
  return normalizeRows(
    rows.map((entry) => ({
      id: entry?.model,
      name: entry?.name,
    })),
  );
}

function normalizeKinds(raw) {
  if (!Array.isArray(raw)) return undefined;
  const kinds = raw.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  return kinds.length > 0 ? kinds : undefined;
}

function finalizeModelList(providerKey, models, kinds) {
  const annotated = annotateModelsWithKinds(models);
  const supplementKey = providerKey === 'volc_ark' ? 'volcengine' : providerKey;
  const merged = mergeModelLists(annotated, supplementsAsModels(supplementKey, { kinds }));
  return filterModelsByKinds(merged, kinds);
}

function isMaskedApiKey(value) {
  const key = String(value || '').trim();
  return /^\*+$/.test(key) || key === 'PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE';
}

const PROVIDER_ENV_KEYS = {
  qwen: ['DASHSCOPE_API_KEY'],
  dashscope: ['DASHSCOPE_API_KEY'],
  volcengine: ['VOLCENGINE_API_KEY', 'VOLC_ARK_API_KEY', 'ARK_API_KEY'],
  volc_ark: ['VOLCENGINE_API_KEY', 'VOLC_ARK_API_KEY', 'ARK_API_KEY'],
  google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  baidu: ['QIANFAN_API_KEY'],
  qianfan: ['QIANFAN_API_KEY'],
  zhipu: ['ZHIPU_API_KEY', 'GLM_API_KEY'],
  kimi: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
  moonshot: ['MOONSHOT_API_KEY', 'KIMI_API_KEY'],
};

function resolveApiKeyFromEnv(provider, poolId) {
  const keys = [
    ...(PROVIDER_ENV_KEYS[provider] ?? []),
    ...(PROVIDER_ENV_KEYS[poolId] ?? []),
  ];
  const seen = new Set();
  for (const name of keys) {
    if (seen.has(name)) continue;
    seen.add(name);
    const value = String(process.env[name] || '').trim();
    if (value && !isMaskedApiKey(value)) return value;
  }
  return '';
}

function resolveCredentialsFromModelPool(modelPoolProviderId, provider, baseUrlInput) {
  const poolId = String(modelPoolProviderId || '').trim();
  if (!poolId) return { apiKey: '', baseUrl: baseUrlInput };

  const { config } = readPilotDeckConfigFile();
  const poolProvider = config?.model?.providers?.[poolId];
  if (!poolProvider) {
    return { apiKey: resolveApiKeyFromEnv(provider, poolId), baseUrl: baseUrlInput };
  }

  let apiKey = expandEnvPlaceholders(String(poolProvider.apiKey || '').trim());
  let baseUrl = baseUrlInput;
  const poolUrl = expandEnvPlaceholders(String(poolProvider.url || '').trim());
  if (!baseUrl && poolUrl) {
    baseUrl = normalizeBaseUrl(poolUrl);
  }
  if (!apiKey || isMaskedApiKey(apiKey)) {
    apiKey = resolveApiKeyFromEnv(provider, poolId);
  }
  return { apiKey, baseUrl };
}

router.post('/list-models', async (req, res) => {
  const provider = normalizeProvider(req.body?.provider);
  let baseUrl = normalizeBaseUrl(expandEnvPlaceholders(req.body?.baseUrl));
  let apiKey = String(expandEnvPlaceholders(req.body?.apiKey) || '').trim();
  const kinds = normalizeKinds(req.body?.kinds);
  const timeoutMs = Number.isFinite(req.body?.timeoutMs)
    ? Math.max(2_000, Math.min(60_000, Number(req.body.timeoutMs)))
    : DEFAULT_TIMEOUT_MS;

  const poolId = String(req.body?.modelPoolProviderId || '').trim();
  if (poolId) {
    const fromPool = resolveCredentialsFromModelPool(poolId, provider, baseUrl);
    // Capability hub inherits model pool credentials — do not let a stale tools.* key override.
    if (fromPool.apiKey) apiKey = fromPool.apiKey;
    if (fromPool.baseUrl) baseUrl = fromPool.baseUrl;
  }

  const allowOptionalApiKey =
    Boolean(req.body?.allowOptionalApiKey)
    || LOCAL_OPTIONAL_KEY_PROVIDERS.has(provider)
    || LOCAL_OPTIONAL_KEY_PROVIDERS.has(String(req.body?.modelPoolProviderId || '').trim().toLowerCase());

  if ((!apiKey || isMaskedApiKey(apiKey)) && !allowOptionalApiKey) {
    const poolHint = req.body?.modelPoolProviderId
      ? `（模型池 ${req.body.modelPoolProviderId}：请先点右上角保存配置，或设置环境变量如 DASHSCOPE_API_KEY）`
      : '';
    return res.status(400).json({
      ok: false,
      error: `apiKey is required.${poolHint}`,
    });
  }

  if (allowOptionalApiKey && !baseUrl) {
    return res.status(400).json({
      ok: false,
      error: 'baseUrl is required for local or OpenAI-compatible providers.',
    });
  }

  try {
    let models = [];
    if (provider === 'google') {
      models = await listModelsViaGoogle(baseUrl, apiKey, timeoutMs);
    } else if (provider === 'qwen') {
      models = await listModelsViaQwen(baseUrl, apiKey, timeoutMs);
    } else if (provider === 'volcengine') {
      models = await listModelsViaVolcengine(baseUrl, apiKey, timeoutMs);
    } else if (provider === 'baidu' || provider === 'qianfan') {
      models = await listModelsViaBaidu(baseUrl, apiKey, timeoutMs);
    } else {
      models = await listModelsViaOpenAiLike(
        baseUrl || 'https://api.openai.com/v1',
        apiKey,
        timeoutMs,
      );
    }

    const remoteCount = models.length;
    models = finalizeModelList(provider, models, kinds);

    return res.json({
      ok: true,
      provider,
      total: models.length,
      remoteCount,
      supplemented: models.length > remoteCount,
      kinds: kinds ?? null,
      models,
      ...(remoteCount === 0 && models.length > 0
        ? {
            hint:
              '远程接口未返回模型，已使用内置补充清单（通义/火山的图片、视频模型通常不在 GET /models 中）。可直接从下方下拉选择。',
          }
        : kinds?.length && remoteCount > 0 && models.length < remoteCount
          ? {
              hint: `远程共 ${remoteCount} 个模型，已按类型筛选出 ${models.length} 个；图片/视频类已合并内置补充清单。`,
            }
          : {}),
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
