/**
 * UI-side mirror of the provider catalog in `src/model/catalog/providers.ts`.
 * Kept here as a hand-curated subset because the UI bundle can't reach into
 * the engine catalog (different tsconfig / build root).
 *
 * Keep this in sync with the engine catalog when adding providers/models.
 * The engine catalog auto-fills capabilities and multimodal — this UI list
 * only needs the IDs and display names.
 */

export type ModelKind = 'chat' | 'vl' | 'image' | 'video' | 'tts' | 'speech';

export type CatalogModel = {
  id: string;
  displayName: string;
  /** Primary capability for grouping in the models panel. */
  modelKind?: ModelKind;
  /** Whether the model accepts image input. Drives the 🖼 indicator in the UI. */
  supportsImage?: boolean;
  /** Context window size (tokens). Drives the placeholder in the max-context-tokens setting. */
  maxContextTokens?: number;
  /**百炼等平台有免费额度的模型；在模型池单独展示「免费额度专区」。 */
  freeTier?: boolean;
};

export type CatalogProviderCategory = 'international' | 'domestic' | 'local' | 'gateway';

export type CatalogProvider = {
  id: string;
  displayName: string;
  protocol: 'anthropic' | 'openai';
  defaultUrl: string;
  models: CatalogModel[];
  /** 添加供应商弹窗分组（国际 / 国内 / 本地 / 聚合与兼容） */
  category?: CatalogProviderCategory;
  /** 本地部署等场景可不填 API Key */
  optionalApiKey?: boolean;
  /** 卡片副标题（如默认地址提示） */
  pickerHint?: string;
};

export const CATALOG_PROVIDER_GROUPS: Array<{
  id: CatalogProviderCategory;
  labelKey: string;
  defaultLabel: string;
}> = [
  { id: 'international', labelKey: 'pilotDeckConfig.panels.models.providerGroupInternational', defaultLabel: '国际官方' },
  { id: 'domestic', labelKey: 'pilotDeckConfig.panels.models.providerGroupDomestic', defaultLabel: '国内主流' },
  { id: 'local', labelKey: 'pilotDeckConfig.panels.models.providerGroupLocal', defaultLabel: '本地部署' },
  { id: 'gateway', labelKey: 'pilotDeckConfig.panels.models.providerGroupGateway', defaultLabel: '聚合与兼容' },
];

/** 百炼控制台「免费额度用完即停」模型（2026-08 同步）— 通义 provider 专用展示专区。 */
export const QWEN_FREE_TIER_MODELS: CatalogModel[] = [
  { id: 'qwen3.7-max-2026-06-08', displayName: '千问 3.7 Max（06-08）', freeTier: true, maxContextTokens: 1048576 },
  { id: 'qwen3.7-plus', displayName: '千问 3.7 Plus', freeTier: true, supportsImage: true, maxContextTokens: 1048576 },
  { id: 'qwen3.7-plus-2026-05-26', displayName: '千问 3.7 Plus（05-26）', freeTier: true, supportsImage: true, maxContextTokens: 1048576 },
  { id: 'qwen3.5-ocr', displayName: '千问 3.5 OCR', freeTier: true, modelKind: 'vl', supportsImage: true, maxContextTokens: 131072 },
  { id: 'glm-5.2', displayName: 'GLM 5.2', freeTier: true, maxContextTokens: 131072 },
  { id: 'kimi-k2.7-code', displayName: 'Kimi K2.7 Code', freeTier: true, maxContextTokens: 262144 },
];

export const QWEN_FREE_TIER_MODEL_IDS = new Set(QWEN_FREE_TIER_MODELS.map((m) => m.id));

export function isCatalogFreeTierModel(modelId: string, catalogModels?: CatalogModel[]): boolean {
  const id = modelId.trim();
  if (!id) return false;
  const fromCatalog = catalogModels?.find((m) => m.id === id);
  if (fromCatalog?.freeTier) return true;
  return QWEN_FREE_TIER_MODEL_IDS.has(id);
}

export function catalogFreeTierModels(models: CatalogModel[]): CatalogModel[] {
  return models.filter((m) => m.freeTier);
}

export function catalogModelsExcludingFreeTier(models: CatalogModel[]): CatalogModel[] {
  return models.filter((m) => !m.freeTier);
}

/** Merge free-tier entries into a provider catalog without duplicate ids. */
export function mergeCatalogWithFreeTier(base: CatalogModel[], freeTier: CatalogModel[]): CatalogModel[] {
  const seen = new Set(base.map((m) => m.id));
  const out = [...base];
  for (const entry of freeTier) {
    if (seen.has(entry.id)) {
      const idx = out.findIndex((m) => m.id === entry.id);
      if (idx >= 0) out[idx] = { ...out[idx], ...entry, freeTier: true };
    } else {
      out.push(entry);
      seen.add(entry.id);
    }
  }
  return out;
}

export const CATALOG_PROVIDERS: CatalogProvider[] = [
  {
    id: 'anthropic',
    displayName: 'Claude（Anthropic）',
    category: 'international',
    protocol: 'anthropic',
    defaultUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-sonnet-4.6', displayName: 'Claude Sonnet 4.6', supportsImage: true, maxContextTokens: 200000 },
      { id: 'claude-opus-4-20250514', displayName: 'Claude Opus 4', supportsImage: true, maxContextTokens: 200000 },
      { id: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', supportsImage: true, maxContextTokens: 200000 },
      { id: 'claude-sonnet-4-5-20250929', displayName: 'Claude Sonnet 4.5', supportsImage: true, maxContextTokens: 200000 },
      { id: 'claude-haiku-3-5-20241022', displayName: 'Claude 3.5 Haiku', supportsImage: true, maxContextTokens: 200000 },
    ],
  },
  {
    id: 'openai',
    displayName: 'OpenAI（GPT / o 系列）',
    category: 'international',
    protocol: 'openai',
    defaultUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4.1', displayName: 'GPT-4.1', supportsImage: true, maxContextTokens: 1047576 },
      { id: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini', supportsImage: true, maxContextTokens: 1047576 },
      { id: 'gpt-4o', displayName: 'GPT-4o', supportsImage: true, maxContextTokens: 128000 },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', supportsImage: true, maxContextTokens: 128000 },
      { id: 'o3', displayName: 'o3', supportsImage: true, maxContextTokens: 200000 },
      { id: 'o3-mini', displayName: 'o3 Mini', maxContextTokens: 200000 },
    ],
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    category: 'domestic',
    protocol: 'openai',
    defaultUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', maxContextTokens: 131072 },
      { id: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', maxContextTokens: 1048576 },
      { id: 'deepseek-chat', displayName: 'DeepSeek Chat (V3)', maxContextTokens: 65536 },
      { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', maxContextTokens: 65536 },
    ],
  },
  {
    id: 'google',
    displayName: 'Google AI（Gemini）',
    category: 'international',
    protocol: 'openai',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      // ── 对话（Gemini 3.x / 2.5 主力）──
      { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash Preview', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-3.1-flash-lite-preview', displayName: 'Gemini 3.1 Flash Lite Preview', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-flash-latest', displayName: 'Gemini Flash Latest', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-pro-latest', displayName: 'Gemini Pro Latest', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportsImage: true, maxContextTokens: 1048576 },
      // ── 图片生成（Imagen / Gemini Image / Nano Banana）──
      { id: 'imagen-4.0-generate-001', displayName: 'Imagen 4', modelKind: 'image', maxContextTokens: 0 },
      { id: 'imagen-3.0-generate-002', displayName: 'Imagen 3', modelKind: 'image', maxContextTokens: 0 },
      { id: 'gemini-3-pro-image-preview', displayName: 'Gemini 3 Pro Image', modelKind: 'image', maxContextTokens: 0 },
      { id: 'gemini-3.1-flash-image-preview', displayName: 'Gemini 3.1 Flash Image', modelKind: 'image', maxContextTokens: 0 },
      { id: 'gemini-2.5-flash-image', displayName: 'Gemini 2.5 Flash Image', modelKind: 'image', maxContextTokens: 0 },
      { id: 'nano-banana-pro-preview', displayName: 'Nano Banana Pro（图片）', modelKind: 'image', maxContextTokens: 0 },
      // ── 视频（Veo）──
      { id: 'veo-3.0-generate-preview', displayName: 'Veo 3 Preview', modelKind: 'video', maxContextTokens: 0 },
      { id: 'veo-2.0-generate-001', displayName: 'Veo 2', modelKind: 'video', maxContextTokens: 0 },
      // ── 语音合成 ──
      { id: 'gemini-2.5-flash-preview-tts', displayName: 'Gemini 2.5 Flash TTS', modelKind: 'tts', maxContextTokens: 0 },
      { id: 'gemini-2.5-pro-preview-tts', displayName: 'Gemini 2.5 Pro TTS', modelKind: 'tts', maxContextTokens: 0 },
    ],
  },
  {
    id: 'qwen',
    displayName: '通义千问 (DashScope)',
    category: 'domestic',
    protocol: 'openai',
    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: mergeCatalogWithFreeTier(
      [
      {
        id: 'qwen3.8-max-preview',
        displayName: '通义千问 3.8 Max Preview',
        supportsImage: true,
        maxContextTokens: 1048576,
      },
      { id: 'qwen3.7-max', displayName: '通义千问 3.7 Max', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'qwen3.7-max-preview', displayName: '通义千问 3.7 Max Preview', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'qwen3.7-max-2026-05-17', displayName: '通义千问 3.7 Max（05-17）', maxContextTokens: 1048576 },
      { id: 'qwen3.7-max-2026-05-20', displayName: '通义千问 3.7 Max（05-20）', maxContextTokens: 1048576 },
      { id: 'qwen3.7-flash', displayName: '通义千问 3.7 Flash', maxContextTokens: 1048576 },
      { id: 'qwen3.7-flash-2026-07-15', displayName: '通义千问 3.7 Flash（07-15）', maxContextTokens: 1048576 },
      { id: 'qwen3.6-plus', displayName: '通义千问 3.6 Plus', maxContextTokens: 1048576 },
      { id: 'qwen3.6-flash', displayName: '通义千问 3.6 Flash', maxContextTokens: 1048576 },
      { id: 'qwen-max', displayName: '通义千问 Max', maxContextTokens: 131072 },
      { id: 'qwen-plus', displayName: '通义千问 Plus', maxContextTokens: 131072 },
      { id: 'qwen-turbo', displayName: '通义千问 Turbo', maxContextTokens: 131072 },
      { id: 'qwen-long', displayName: '通义千问 Long（超长上下文）', maxContextTokens: 10000000 },
      { id: 'qwen-vl-max', displayName: '通义千问 VL Max（识图）', modelKind: 'vl', supportsImage: true, maxContextTokens: 131072 },
      { id: 'qwen-vl-plus', displayName: '通义千问 VL Plus（识图）', modelKind: 'vl', supportsImage: true, maxContextTokens: 131072 },
      { id: 'qwen2.5-72b-instruct', displayName: 'Qwen 2.5 72B', maxContextTokens: 131072 },
      { id: 'qwen2.5-32b-instruct', displayName: 'Qwen 2.5 32B', maxContextTokens: 131072 },
      { id: 'qwen-image-3.0-pro', displayName: 'Qwen Image 3.0 Pro', modelKind: 'image', maxContextTokens: 0 },
      { id: 'qwen-image-plus', displayName: '通义万相 图片 Plus', modelKind: 'image', maxContextTokens: 0 },
      { id: 'qwen-image-max', displayName: '通义万相 图片 Max', modelKind: 'image', maxContextTokens: 0 },
      { id: 'qwen-image-2.0-pro', displayName: '通义万相 图片 2.0 Pro', modelKind: 'image', maxContextTokens: 0 },
      { id: 'wanx2.1-t2i-plus', displayName: '万相 2.1 文生图 Plus', modelKind: 'image', maxContextTokens: 0 },
      { id: 'wanx2.1-t2v-turbo', displayName: '万相 2.1 文生视频 Turbo', modelKind: 'video', maxContextTokens: 0 },
      { id: 'happyhorse-1.0', displayName: 'Happy Horse 图生视频', modelKind: 'video', maxContextTokens: 0 },
      ],
      QWEN_FREE_TIER_MODELS,
    ),
  },
  {
    id: 'zhipu',
    displayName: '智谱 GLM',
    category: 'domestic',
    protocol: 'openai',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    pickerHint: 'OpenAI 兼容 · open.bigmodel.cn',
    models: [
      { id: 'glm-4.6', displayName: 'GLM-4.6', supportsImage: true, maxContextTokens: 200000 },
      { id: 'glm-4.5', displayName: 'GLM-4.5', supportsImage: true, maxContextTokens: 128000 },
      { id: 'glm-4.5-air', displayName: 'GLM-4.5 Air', maxContextTokens: 128000 },
      { id: 'glm-4.5-flash', displayName: 'GLM-4.5 Flash', maxContextTokens: 128000 },
      { id: 'glm-4-flash', displayName: 'GLM-4 Flash', maxContextTokens: 128000 },
      { id: 'glm-4-plus', displayName: 'GLM-4 Plus', maxContextTokens: 128000 },
      { id: 'glm-4.6v', displayName: 'GLM-4.6V（识图）', modelKind: 'vl', supportsImage: true, maxContextTokens: 128000 },
      { id: 'glm-4.5v', displayName: 'GLM-4.5V（识图）', modelKind: 'vl', supportsImage: true, maxContextTokens: 128000 },
    ],
  },
  {
    id: 'kimi',
    displayName: 'Kimi（月之暗面）',
    category: 'domestic',
    protocol: 'openai',
    defaultUrl: 'https://api.moonshot.cn/v1',
    pickerHint: '月之暗面 OpenAI 兼容',
    models: [
      { id: 'kimi-k2.6', displayName: 'Kimi K2.6', supportsImage: true, maxContextTokens: 262144 },
      { id: 'kimi-k2.5', displayName: 'Kimi K2.5', maxContextTokens: 262144 },
      { id: 'kimi-k1.5', displayName: 'Kimi K1.5', supportsImage: true, maxContextTokens: 131072 },
    ],
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    category: 'gateway',
    protocol: 'openai',
    defaultUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'anthropic/claude-sonnet-4.6', displayName: 'Claude Sonnet 4.6', supportsImage: true, maxContextTokens: 200000 },
      { id: 'google/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportsImage: true, maxContextTokens: 1048576 },
      { id: 'deepseek/deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', maxContextTokens: 1048576 },
      { id: 'moonshotai/kimi-k2.6', displayName: 'Kimi K2.6', supportsImage: true, maxContextTokens: 262144 },
    ],
  },
  {
    id: 'openai_compatible',
    displayName: 'OpenAI 通用协议',
    category: 'gateway',
    protocol: 'openai',
    defaultUrl: '',
    optionalApiKey: true,
    pickerHint: 'OneAPI / NewAPI / 自建中转等',
    models: [],
  },
  {
    id: 'ollama',
    displayName: 'Ollama（本地）',
    category: 'local',
    protocol: 'openai',
    defaultUrl: 'http://127.0.0.1:11434/v1',
    optionalApiKey: true,
    pickerHint: '默认 localhost:11434',
    models: [
      { id: 'llama3.3', displayName: 'Llama 3.3', maxContextTokens: 131072 },
      { id: 'qwen2.5:14b', displayName: 'Qwen 2.5 14B', maxContextTokens: 131072 },
      { id: 'qwen2.5:7b', displayName: 'Qwen 2.5 7B', maxContextTokens: 131072 },
      { id: 'deepseek-r1:8b', displayName: 'DeepSeek R1 8B', maxContextTokens: 65536 },
      { id: 'mistral', displayName: 'Mistral', maxContextTokens: 32768 },
      { id: 'gemma2:9b', displayName: 'Gemma 2 9B', maxContextTokens: 8192 },
    ],
  },
  {
    id: 'lmstudio',
    displayName: 'LM Studio（本地）',
    category: 'local',
    protocol: 'openai',
    defaultUrl: 'http://127.0.0.1:1234/v1',
    optionalApiKey: true,
    pickerHint: '默认 localhost:1234',
    models: [],
  },
  {
    id: 'vllm',
    displayName: 'vLLM / LocalAI（本地）',
    category: 'local',
    protocol: 'openai',
    defaultUrl: 'http://127.0.0.1:8000/v1',
    optionalApiKey: true,
    pickerHint: 'OpenAI 兼容推理服务',
    models: [],
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    category: 'domestic',
    protocol: 'openai',
    defaultUrl: 'https://api.minimaxi.com/v1',
    models: [
      { id: 'MiniMax-M2.5', displayName: 'MiniMax M2.5', maxContextTokens: 1000000 },
      { id: 'MiniMax-M2.7-highspeed', displayName: 'MiniMax M2.7 Highspeed', maxContextTokens: 1000000 },
    ],
  },
  {
    id: 'volc_ark',
    displayName: '火山方舟 (Volcano Ark)',
    category: 'domestic',
    protocol: 'openai',
    defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-seed-1-8-251228', displayName: 'Doubao Seed 1.8', supportsImage: true, maxContextTokens: 262144 },
      { id: 'doubao-seed-1-6-251015', displayName: 'Doubao Seed 1.6', supportsImage: true, maxContextTokens: 262144 },
      { id: 'doubao-seed-1-6-flash', displayName: 'Doubao Seed 1.6 Flash', maxContextTokens: 262144 },
      { id: 'doubao-seed-1-6-lite', displayName: 'Doubao Seed 1.6 Lite', maxContextTokens: 262144 },
      { id: 'doubao-seed-1-6-thinking', displayName: 'Doubao Seed 1.6 Thinking', maxContextTokens: 262144 },
      { id: 'doubao-1.5-pro-256k', displayName: 'Doubao 1.5 Pro 256K', supportsImage: true, maxContextTokens: 262144 },
      { id: 'doubao-1.5-pro-32k', displayName: 'Doubao 1.5 Pro 32K', supportsImage: true, maxContextTokens: 32768 },
      { id: 'doubao-1.5-pro', displayName: 'Doubao 1.5 Pro', supportsImage: true, maxContextTokens: 131072 },
      { id: 'doubao-1.5-lite-128k', displayName: 'Doubao 1.5 Lite 128K', maxContextTokens: 131072 },
      { id: 'doubao-1.5-lite-32k', displayName: 'Doubao 1.5 Lite 32K', maxContextTokens: 32768 },
      { id: 'doubao-1.5-lite', displayName: 'Doubao 1.5 Lite', maxContextTokens: 32768 },
      { id: 'doubao-1.5-vision-pro-32k', displayName: 'Doubao 1.5 Vision Pro', supportsImage: true, maxContextTokens: 32768 },
      { id: 'doubao-seed-code-preview-latest', displayName: 'Doubao Seed Code', maxContextTokens: 262144 },
      { id: 'deepseek-r1', displayName: 'DeepSeek R1 (Volc)', maxContextTokens: 65536 },
      { id: 'deepseek-v3', displayName: 'DeepSeek V3 (Volc)', maxContextTokens: 65536 },
      { id: 'doubao-seedream-4-5-251128', displayName: 'Seedream 4.5（图片）', modelKind: 'image', maxContextTokens: 0 },
      { id: 'doubao-seedance-1-5-pro-251215', displayName: 'Seedance 1.5 Pro（视频）', modelKind: 'video', maxContextTokens: 0 },
      { id: 'Doubao-Seedance-2.0', displayName: 'Seedance 2.0（视频）', modelKind: 'video', maxContextTokens: 0 },
    ],
  },
];

/** Providers whose remote list-models merge should only keep catalog representatives (not 100+ raw ids). */
const CURATED_DISCOVER_PROVIDER_IDS = new Set(['google', 'volc_ark']);

export function shouldCurateDiscoveredMerge(providerId: string): boolean {
  return CURATED_DISCOVER_PROVIDER_IDS.has(providerId.trim().toLowerCase());
}

/** Keep only catalog chip ids when merging a remote model list into the model pool. */
export function filterDiscoveredForCatalogMerge(
  providerId: string,
  discovered: Array<{ id: string; kinds?: string[] }>,
): Array<{ id: string; kinds?: string[] }> {
  const catalog = findCatalogProviderById(providerId);
  if (!catalog) return discovered;
  const allowed = new Set(catalog.models.map((m) => m.id));
  return discovered.filter((entry) => allowed.has(entry.id));
}

/** First chat (or first) catalog model to auto-enable when adding a provider. */
export function defaultEnabledModelsForProvider(
  catalog: CatalogProvider,
): Record<string, Record<string, unknown>> {
  if (catalog.id === 'openai_compatible' || catalog.id === 'lmstudio' || catalog.id === 'vllm') {
    return {};
  }

  if (catalog.id === 'google') {
    const picks = [
      { id: 'gemini-3.1-pro-preview' },
      { id: 'imagen-3.0-generate-002', modelKind: 'image' as const },
      { id: 'veo-2.0-generate-001', modelKind: 'video' as const },
    ];
    const result: Record<string, Record<string, unknown>> = {};
    for (const pick of picks) {
      const model = catalog.models.find((m) => m.id === pick.id);
      if (!model) continue;
      const kind = pick.modelKind ?? model.modelKind;
      if (kind === 'vl') {
        result[model.id] = { kinds: ['vl', 'chat'] };
      } else if (kind) {
        result[model.id] = { kinds: [kind] };
      } else {
        result[model.id] = {};
      }
    }
    if (Object.keys(result).length > 0) return result;
  }

  const pick =
    catalog.models.find((m) => !m.modelKind || m.modelKind === 'chat') ?? catalog.models[0];
  if (!pick) return {};
  const meta: Record<string, unknown> = {};
  if (pick.modelKind) {
    meta.kinds = pick.modelKind === 'vl' ? ['vl', 'chat'] : [pick.modelKind];
  }
  return { [pick.id]: meta };
}

export function findCatalogProviderById(id: string): CatalogProvider | undefined {
  return CATALOG_PROVIDERS.find((p) => p.id === id);
}

export function findCatalogProviderByUrl(url: string): CatalogProvider | undefined {
  return CATALOG_PROVIDERS.find((p) => p.defaultUrl === url);
}
