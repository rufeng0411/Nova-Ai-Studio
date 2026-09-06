import { resolveModelKindsForPoolEntry, type ModelKind } from './modelKinds';

export type MediaProvider =
  | 'openai-compatible'
  | 'google'
  | 'qwen'
  | 'volcengine'
  | 'baidu'
  | 'azure'
  | 'cloud';

export type MediaToolConfig = {
  provider?: MediaProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type ModelProviderSlice = {
  url?: string;
  apiKey?: string;
  models?: Record<string, Record<string, unknown> | null>;
};

const DEFAULT_BASE_URL: Record<MediaProvider, string> = {
  'openai-compatible': '',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  baidu: 'https://qianfan.baidubce.com/v2',
  azure: '',
  cloud: '',
};

const DEFAULT_IMAGE_MODEL: Record<MediaProvider, string> = {
  'openai-compatible': 'gpt-image-1',
  google: 'imagen-3.0-generate-002',
  qwen: 'qwen-image-plus',
  volcengine: 'doubao-seedream-3-0-t2i-250415',
  baidu: 'ernie-vilg-v2',
  azure: 'gpt-image-1',
  cloud: 'gpt-image-1',
};

const DEFAULT_TTS_MODEL: Record<MediaProvider, string> = {
  'openai-compatible': 'tts-1',
  google: 'gemini-2.5-flash-preview-tts',
  qwen: 'cosyvoice-v3-flash',
  volcengine: 'doubao-tts',
  baidu: 'ernie-tts',
  azure: 'tts-1',
  cloud: 'tts-1',
};

const DEFAULT_SPEECH_MODEL: Record<MediaProvider, string> = {
  'openai-compatible': 'whisper-1',
  google: 'gemini-2.5-flash',
  qwen: 'fun-asr',
  volcengine: 'volc-asr',
  baidu: 'ernie-asr',
  azure: 'whisper-1',
  cloud: 'whisper-1',
};

const DEFAULT_VIDEO_MODEL: Record<MediaProvider, string> = {
  'openai-compatible': 'sora',
  google: 'veo-2.0-generate-001',
  qwen: 'wanx2.1-t2v-turbo',
  volcengine: 'doubao-seedance-1-5-pro-251215',
  baidu: 'ernie-videogen',
  azure: 'sora',
  cloud: 'sora',
};

const MEDIA_PROVIDER_IDS: Record<MediaProvider, string[]> = {
  qwen: ['qwen', 'dashscope'],
  volcengine: ['volc_ark', 'volcengine'],
  google: ['google'],
  baidu: ['baidu', 'qianfan'],
  'openai-compatible': [],
  azure: ['azure'],
  cloud: ['cloud'],
};

/** True when yaml has a key set (including masked ******** from saved config). */
export function isConfiguredApiKey(apiKey: string | undefined): boolean {
  const key = String(apiKey || '').trim();
  if (!key) return false;
  if (/^\*+$/.test(key)) return true;
  if (key === 'PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE') return false;
  if (key.startsWith('PLACEHOLDER_')) return false;
  return true;
}

/** True when a non-masked, non-placeholder secret is present (usable for API calls / edits). */
export function hasUsableSecret(value: string | undefined): boolean {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return false;
  if (/^\*+$/.test(trimmed)) return false;
  if (trimmed === 'PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE') return false;
  if (trimmed.startsWith('PLACEHOLDER_')) return false;
  return true;
}

function hasUsableApiKey(apiKey: string | undefined): boolean {
  return hasUsableSecret(apiKey);
}

function matchesMediaProviderApiKey(mediaProvider: MediaProvider, apiKey: string): boolean {
  const key = apiKey.trim();
  if (!key) return false;
  if (mediaProvider === 'qwen') return /^sk-/i.test(key);
  if (mediaProvider === 'google') return /^AIza/i.test(key);
  if (mediaProvider === 'baidu') return key.length >= 8;
  return true;
}

export function mapProviderIdToMediaProvider(providerId: string): MediaProvider {
  const id = providerId.trim().toLowerCase();
  if (id === 'qwen' || id === 'dashscope') return 'qwen';
  if (id === 'volc_ark' || id === 'volcengine') return 'volcengine';
  if (id === 'google') return 'google';
  if (id === 'baidu' || id === 'qianfan') return 'baidu';
  if (id === 'azure') return 'azure';
  if (id === 'cloud') return 'cloud';
  return 'openai-compatible';
}

export function normalizeGoogleNativeApiBaseUrl(url: string | undefined): string {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.replace(/\/openai$/i, '');
}

function resolveBaseUrlForMedia(mediaProvider: MediaProvider, url: string | undefined): string | undefined {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (trimmed) {
    return mediaProvider === 'google' ? normalizeGoogleNativeApiBaseUrl(trimmed) : trimmed;
  }
  const fallback = DEFAULT_BASE_URL[mediaProvider];
  return fallback || undefined;
}

export type MediaPoolKind = 'image' | 'video' | 'tts' | 'speech';

function pickModelFromProvider(
  providerId: string,
  provider: ModelProviderSlice,
  mediaKind: MediaPoolKind,
  mediaProvider: MediaProvider,
): string {
  const models = provider.models ?? {};
  for (const [id, meta] of Object.entries(models)) {
    const kinds = resolveModelKindsForPoolEntry(providerId, id, meta);
    if (kinds.includes(mediaKind)) return id;
  }
  if (mediaKind === 'image') return DEFAULT_IMAGE_MODEL[mediaProvider];
  if (mediaKind === 'video') return DEFAULT_VIDEO_MODEL[mediaProvider];
  if (mediaKind === 'tts') return DEFAULT_TTS_MODEL[mediaProvider];
  return DEFAULT_SPEECH_MODEL[mediaProvider];
}

export function findModelProviderForMedia(
  providers: Record<string, ModelProviderSlice> | undefined,
  preferred?: MediaProvider,
): { providerId: string; provider: ModelProviderSlice; mediaProvider: MediaProvider } | null {
  if (!providers) return null;

  const priority: MediaProvider[] = preferred
    ? [preferred, 'qwen', 'volcengine', 'google', 'baidu', 'openai-compatible']
    : ['qwen', 'volcengine', 'google', 'baidu', 'openai-compatible'];

  for (const media of priority) {
    const ids = MEDIA_PROVIDER_IDS[media];
    const candidates =
      ids.length > 0
        ? ids.map((id) => [id, providers[id]] as const).filter(([, p]) => p)
        : Object.entries(providers).filter(([id]) => mapProviderIdToMediaProvider(id) === media);

    for (const [providerId, provider] of candidates) {
      if (!provider || !isConfiguredApiKey(provider.apiKey)) continue;
      return {
        providerId,
        provider,
        mediaProvider: mapProviderIdToMediaProvider(providerId),
      };
    }
  }

  for (const [providerId, provider] of Object.entries(providers)) {
    if (provider && isConfiguredApiKey(provider.apiKey)) {
      return {
        providerId,
        provider,
        mediaProvider: mapProviderIdToMediaProvider(providerId),
      };
    }
  }
  return null;
}

export type PoolMediaModelEntry = {
  id: string;
  providerId: string;
  mediaProvider: MediaProvider;
  kinds: ModelKind[];
};

export type ListPoolMediaModelsOptions = {
  /** Only this model-pool provider id (e.g. qwen, volc_ark). */
  providerId?: string;
  /** Only providers in this API family (qwen, volcengine, …). */
  mediaProvider?: MediaProvider;
  /** Scan every configured provider (default for capability hub). */
  allProviders?: boolean;
};

function providerMatchesMediaFilter(
  providerId: string,
  options: ListPoolMediaModelsOptions,
): boolean {
  if (options.providerId) return providerId === options.providerId;
  if (options.allProviders || !options.mediaProvider) return true;
  const mediaProvider = mapProviderIdToMediaProvider(providerId);
  const allowedIds = MEDIA_PROVIDER_IDS[options.mediaProvider] ?? [];
  return mediaProvider === options.mediaProvider || allowedIds.includes(providerId);
}

/** Provider with the most enabled image/video models in the model pool. */
export function findBestModelPoolProviderForKind(
  providers: Record<string, ModelProviderSlice> | undefined,
  mediaKind: MediaPoolKind,
): { providerId: string; provider: ModelProviderSlice; mediaProvider: MediaProvider; count: number } | null {
  if (!providers) return null;

  let best: {
    providerId: string;
    provider: ModelProviderSlice;
    mediaProvider: MediaProvider;
    count: number;
  } | null = null;

  for (const [providerId, provider] of Object.entries(providers)) {
    if (!provider?.models || !isConfiguredApiKey(provider.apiKey)) continue;
    let count = 0;
    for (const [id, meta] of Object.entries(provider.models)) {
      if (resolveModelKindsForPoolEntry(providerId, id, meta).includes(mediaKind)) count += 1;
    }
    if (count > (best?.count ?? 0)) {
      best = {
        providerId,
        provider,
        mediaProvider: mapProviderIdToMediaProvider(providerId),
        count,
      };
    }
  }
  return best;
}

/** Enabled models from model.providers for image/video (optionally all suppliers). */
export function listEnabledMediaModelsFromPool(
  providers: Record<string, ModelProviderSlice> | undefined,
  mediaKind: MediaPoolKind,
  options: ListPoolMediaModelsOptions = { allProviders: true },
): PoolMediaModelEntry[] {
  if (!providers) return [];

  const results: PoolMediaModelEntry[] = [];
  const seen = new Set<string>();

  for (const [providerId, provider] of Object.entries(providers)) {
    if (!provider?.models) continue;
    if (!providerMatchesMediaFilter(providerId, options)) continue;
    const mediaProvider = mapProviderIdToMediaProvider(providerId);

    for (const [id, meta] of Object.entries(provider.models)) {
      const kinds = resolveModelKindsForPoolEntry(providerId, id, meta);
      if (!kinds.includes(mediaKind)) continue;
      const dedupeKey = `${providerId}:${id}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      results.push({ id, providerId, mediaProvider, kinds });
    }
  }

  return results;
}

/** All enabled models on the inherited provider (any kind), for summary UI. */
export function listAllEnabledModelsFromPoolProvider(
  providers: Record<string, ModelProviderSlice> | undefined,
  preferred?: MediaProvider,
): Array<{ id: string; providerId: string; kinds: ModelKind[] }> {
  const inherited = findModelProviderForMedia(providers, preferred);
  if (!inherited?.provider.models) return [];
  return Object.entries(inherited.provider.models).map(([id, meta]) => ({
    id,
    providerId: inherited.providerId,
    kinds: resolveModelKindsForPoolEntry(inherited.providerId, id, meta),
  }));
}

export function resolveMediaToolFromModelProviders(
  explicit: MediaToolConfig | undefined,
  modelProviders: Record<string, ModelProviderSlice> | undefined,
  mediaKind: MediaPoolKind,
): MediaToolConfig | undefined {
  const inherited = findModelProviderForMedia(modelProviders, explicit?.provider);
  if (!explicit && !inherited) return undefined;

  const mediaProvider = explicit?.provider ?? inherited?.mediaProvider ?? 'openai-compatible';
  const explicitKey = explicit?.apiKey?.trim();
  const inheritedKey = inherited?.provider.apiKey?.trim();
  const rawKey =
    hasUsableApiKey(explicitKey) && matchesMediaProviderApiKey(mediaProvider, explicitKey!)
      ? explicitKey
      : hasUsableApiKey(inheritedKey)
        ? inheritedKey
        : explicitKey || inheritedKey;
  if (!isConfiguredApiKey(rawKey) && !explicit?.model?.trim() && !inherited) {
    return explicit;
  }

  const poolBaseUrl = resolveBaseUrlForMedia(mediaProvider, inherited?.provider.url);
  const baseUrl = coalesceMediaBaseUrl(
    explicit?.baseUrl,
    resolveBaseUrlForMedia(mediaProvider, poolBaseUrl),
    mediaProvider,
  );
  const model =
    explicit?.model?.trim() ||
    (inherited ? pickModelFromProvider(inherited.providerId, inherited.provider, mediaKind, mediaProvider) : undefined) ||
    (mediaKind === 'image'
      ? DEFAULT_IMAGE_MODEL[mediaProvider]
      : mediaKind === 'video'
        ? DEFAULT_VIDEO_MODEL[mediaProvider]
        : mediaKind === 'tts'
          ? DEFAULT_TTS_MODEL[mediaProvider]
          : DEFAULT_SPEECH_MODEL[mediaProvider]);

  const merged: MediaToolConfig = {
    provider: mediaProvider,
    model,
  };
  if (hasUsableApiKey(rawKey)) {
    merged.apiKey = rawKey;
  }
  if (baseUrl) merged.baseUrl = baseUrl;
  return merged;
}

const OPENAI_PLACEHOLDER_BASE_URLS = new Set([
  'https://api.openai.com/v1',
  'https://api.openai.com',
]);

/** Prefer model-pool URL when tools.* still has OpenAI placeholder but provider is qwen/volc. */
export function coalesceMediaBaseUrl(
  explicit: string | undefined,
  effective: string | undefined,
  mediaProvider: MediaProvider,
): string {
  const trimmed = String(explicit || '').trim().replace(/\/+$/, '');
  if (!trimmed) return String(effective || '').trim();
  if (mediaProvider !== 'openai-compatible' && OPENAI_PLACEHOLDER_BASE_URLS.has(trimmed)) {
    return String(effective || trimmed).trim();
  }
  if (mediaProvider === 'google') {
    return normalizeGoogleNativeApiBaseUrl(trimmed || effective);
  }
  return trimmed;
}

export type { ModelKind };
