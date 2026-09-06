import type { ModelConfig, ProviderConfig } from "../../model/protocol/canonical.js";
import {
  resolveApiKey as resolveApiKeyValue,
  type CredentialEnv,
} from "../../model/config/resolveCredentials.js";
import type { PilotMediaProvider, PilotMediaToolConfig } from "./types.js";
import { inferModelKind, modelEntryKinds, type ModelKind } from "./modelKinds.js";

export type ModelProviderSlice = {
  url?: string;
  apiKey?: string;
  models?: Record<string, Record<string, unknown> | null>;
};

const DEFAULT_BASE_URL: Record<PilotMediaProvider, string> = {
  "openai-compatible": "",
  google: "https://generativelanguage.googleapis.com/v1beta",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  volcengine: "https://ark.cn-beijing.volces.com/api/v3",
  baidu: "https://qianfan.baidubce.com/v2",
  azure: "",
  cloud: "",
};

const DEFAULT_IMAGE_MODEL: Record<PilotMediaProvider, string> = {
  "openai-compatible": "gpt-image-1",
  google: "imagen-3.0-generate-002",
  qwen: "qwen-image-plus",
  volcengine: "doubao-seedream-3-0-t2i-250415",
  baidu: "ernie-vilg-v2",
  azure: "gpt-image-1",
  cloud: "gpt-image-1",
};

const DEFAULT_TTS_MODEL: Record<PilotMediaProvider, string> = {
  "openai-compatible": "tts-1",
  google: "gemini-2.5-flash-preview-tts",
  qwen: "cosyvoice-v3-flash",
  volcengine: "doubao-tts",
  baidu: "ernie-tts",
  azure: "tts-1",
  cloud: "tts-1",
};

const DEFAULT_SPEECH_MODEL: Record<PilotMediaProvider, string> = {
  "openai-compatible": "whisper-1",
  google: "gemini-2.5-flash",
  qwen: "fun-asr",
  volcengine: "volc-asr",
  baidu: "ernie-asr",
  azure: "whisper-1",
  cloud: "whisper-1",
};

const DEFAULT_VIDEO_MODEL: Record<PilotMediaProvider, string> = {
  "openai-compatible": "sora",
  google: "veo-2.0-generate-001",
  qwen: "wanx2.1-t2v-turbo",
  volcengine: "doubao-seedance-1-5-pro-251215",
  baidu: "ernie-videogen",
  azure: "sora",
  cloud: "sora",
};

const MEDIA_PROVIDER_IDS: Record<PilotMediaProvider, string[]> = {
  qwen: ["qwen", "dashscope"],
  volcengine: ["volc_ark", "volcengine"],
  google: ["google"],
  baidu: ["baidu", "qianfan"],
  "openai-compatible": [],
  azure: ["azure"],
  cloud: ["cloud"],
};

const OPENAI_PLACEHOLDER_BASE_URLS = new Set([
  "https://api.openai.com/v1",
  "https://api.openai.com",
]);

const MEDIA_ENV_API_KEYS: Record<PilotMediaProvider, string[]> = {
  qwen: ["DASHSCOPE_API_KEY"],
  volcengine: ["VOLCENGINE_API_KEY", "VOLC_ARK_API_KEY", "ARK_API_KEY"],
  google: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  baidu: ["QIANFAN_API_KEY"],
  "openai-compatible": ["OPENAI_API_KEY", "PILOTDECK_IMAGE_API_KEY", "PILOTDECK_VIDEO_API_KEY"],
  azure: ["AZURE_OPENAI_API_KEY"],
  cloud: ["OPENAI_API_KEY"],
};

export function mapProviderIdToMediaProvider(providerId: string): PilotMediaProvider {
  const id = providerId.trim().toLowerCase();
  if (id === "qwen" || id === "dashscope") return "qwen";
  if (id === "volc_ark" || id === "volcengine") return "volcengine";
  if (id === "google") return "google";
  if (id === "baidu" || id === "qianfan") return "baidu";
  if (id === "azure") return "azure";
  if (id === "cloud") return "cloud";
  return "openai-compatible";
}

export function isConfiguredApiKey(apiKey: string | undefined): boolean {
  const key = String(apiKey || "").trim();
  if (!key) return false;
  if (/^\*+$/.test(key)) return true;
  if (key === "PLACEHOLDER_RUN_ONBOARDING_TO_REPLACE") return false;
  if (key.startsWith("PLACEHOLDER_")) return false;
  return true;
}

function hasUsableApiKey(apiKey: string | undefined): boolean {
  const key = String(apiKey || "").trim();
  return key.length > 0 && !/^\*+$/.test(key);
}

/** Reject keys saved under the wrong tool (e.g. yixiaoer key in tools.image for qwen). */
function matchesMediaProviderApiKey(
  mediaProvider: PilotMediaProvider,
  apiKey: string,
): boolean {
  const key = apiKey.trim();
  if (!key) return false;
  if (mediaProvider === "qwen") return /^sk-/i.test(key);
  if (mediaProvider === "google") return /^AIza/i.test(key);
  if (mediaProvider === "baidu") return key.length >= 8;
  return true;
}

function readEnvApiKey(mediaProvider: PilotMediaProvider, env: CredentialEnv): string | undefined {
  for (const name of MEDIA_ENV_API_KEYS[mediaProvider] ?? []) {
    const value = String(env[name] ?? "").trim();
    if (value && !/^\*+$/.test(value)) return value;
  }
  return undefined;
}

function tryResolveApiKeyString(
  apiKey: string | undefined,
  env: CredentialEnv,
): string | undefined {
  const trimmed = String(apiKey || "").trim();
  if (!trimmed || /^\*+$/.test(trimmed)) return undefined;
  if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(trimmed)) {
    try {
      return resolveApiKeyValue(trimmed, env);
    } catch {
      return undefined;
    }
  }
  return trimmed;
}

function resolveMediaApiKey(
  explicitKey: string | undefined,
  inheritedKey: string | undefined,
  mediaProvider: PilotMediaProvider,
  env: CredentialEnv,
): string | undefined {
  const explicitResolved = tryResolveApiKeyString(explicitKey, env);
  const inheritedResolved = tryResolveApiKeyString(inheritedKey, env);
  if (
    explicitResolved &&
    matchesMediaProviderApiKey(mediaProvider, explicitResolved)
  ) {
    return explicitResolved;
  }
  return inheritedResolved ?? readEnvApiKey(mediaProvider, env);
}

export function normalizeGoogleNativeApiBaseUrl(url: string | undefined): string {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\/openai$/i, "");
}

function resolveBaseUrlForMedia(
  mediaProvider: PilotMediaProvider,
  url: string | undefined,
): string | undefined {
  const trimmed = String(url || "").trim().replace(/\/+$/, "");
  if (trimmed) {
    return mediaProvider === "google" ? normalizeGoogleNativeApiBaseUrl(trimmed) : trimmed;
  }
  const fallback = DEFAULT_BASE_URL[mediaProvider];
  return fallback || undefined;
}

/** Prefer model-pool URL when tools.* still has OpenAI placeholder but provider is qwen/volc. */
export function coalesceMediaBaseUrl(
  explicit: string | undefined,
  effective: string | undefined,
  mediaProvider: PilotMediaProvider,
): string {
  const trimmed = String(explicit || "").trim().replace(/\/+$/, "");
  if (!trimmed) return String(effective || "").trim();
  if (mediaProvider !== "openai-compatible" && OPENAI_PLACEHOLDER_BASE_URLS.has(trimmed)) {
    return String(effective || trimmed).trim();
  }
  if (mediaProvider === "google") {
    return normalizeGoogleNativeApiBaseUrl(trimmed || effective);
  }
  return trimmed;
}

function pickModelFromProvider(
  provider: ModelProviderSlice,
  mediaKind: "image" | "video" | "tts" | "speech",
  mediaProvider: PilotMediaProvider,
): string {
  const models = provider.models ?? {};
  for (const [id, meta] of Object.entries(models)) {
    const kinds = modelEntryKinds(id, meta);
    if (kinds.includes(mediaKind)) return id;
  }
  if (mediaKind === "image") return DEFAULT_IMAGE_MODEL[mediaProvider];
  if (mediaKind === "video") return DEFAULT_VIDEO_MODEL[mediaProvider];
  if (mediaKind === "tts") return DEFAULT_TTS_MODEL[mediaProvider];
  return DEFAULT_SPEECH_MODEL[mediaProvider];
}

export function findModelProviderForMedia(
  providers: Record<string, ModelProviderSlice> | undefined,
  preferred?: PilotMediaProvider,
): { providerId: string; provider: ModelProviderSlice; mediaProvider: PilotMediaProvider } | null {
  if (!providers) return null;

  const priority: PilotMediaProvider[] = preferred
    ? [preferred, "qwen", "volcengine", "google", "baidu", "openai-compatible"]
    : ["qwen", "volcengine", "google", "baidu", "openai-compatible"];

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

export function resolveMediaToolFromModelProviders(
  explicit: PilotMediaToolConfig | undefined,
  modelProviders: Record<string, ModelProviderSlice> | undefined,
  mediaKind: "image" | "video" | "tts" | "speech",
  env: CredentialEnv = process.env,
): PilotMediaToolConfig | undefined {
  const inherited = findModelProviderForMedia(modelProviders, explicit?.provider);
  if (!explicit && !inherited) return undefined;

  const mediaProvider =
    explicit?.provider ?? inherited?.mediaProvider ?? ("openai-compatible" as PilotMediaProvider);
  const explicitKey = explicit?.apiKey?.trim();
  const inheritedKey = inherited?.provider.apiKey?.trim();
  const resolvedKey = resolveMediaApiKey(explicitKey, inheritedKey, mediaProvider, env);
  const rawKey = resolvedKey ?? explicitKey ?? inheritedKey;

  if (!resolvedKey && !isConfiguredApiKey(rawKey) && !explicit?.model?.trim() && !inherited) {
    return explicit;
  }

  const poolBaseUrl = resolveBaseUrlForMedia(
    mediaProvider,
    inherited?.provider.url,
  );
  const baseUrl = coalesceMediaBaseUrl(
    explicit?.baseUrl,
    resolveBaseUrlForMedia(mediaProvider, poolBaseUrl),
    mediaProvider,
  );
  const model =
    explicit?.model?.trim() ||
    (inherited ? pickModelFromProvider(inherited.provider, mediaKind, mediaProvider) : undefined) ||
    (mediaKind === "image"
      ? DEFAULT_IMAGE_MODEL[mediaProvider]
      : mediaKind === "video"
        ? DEFAULT_VIDEO_MODEL[mediaProvider]
        : mediaKind === "tts"
          ? DEFAULT_TTS_MODEL[mediaProvider]
          : DEFAULT_SPEECH_MODEL[mediaProvider]);

  const merged: PilotMediaToolConfig = {
    provider: mediaProvider,
    model,
  };
  if (resolvedKey) {
    merged.apiKey = resolvedKey;
  }
  if (baseUrl) merged.baseUrl = baseUrl;
  return merged;
}

export function modelConfigToProviderSlices(
  model: ModelConfig | undefined,
): Record<string, ModelProviderSlice> | undefined {
  if (!model?.providers) return undefined;
  const out: Record<string, ModelProviderSlice> = {};
  for (const [id, provider] of Object.entries(model.providers)) {
    out[id] = providerConfigToSlice(provider);
  }
  return out;
}

function providerConfigToSlice(provider: ProviderConfig): ModelProviderSlice {
  const models: Record<string, Record<string, unknown> | null> = {};
  for (const [id] of Object.entries(provider.models)) {
    models[id] = { kinds: modelEntryKinds(id, null) };
  }
  return {
    url: provider.url,
    apiKey: provider.apiKey,
    models,
  };
}

export function groupModelIdsByKind(
  modelIds: string[],
  modelsMeta?: Record<string, Record<string, unknown> | null>,
): Record<ModelKind, string[]> {
  const groups: Record<ModelKind, string[]> = {
    chat: [],
    vl: [],
    image: [],
    video: [],
    tts: [],
    speech: [],
  };
  for (const id of modelIds) {
    const kinds = modelEntryKinds(id, modelsMeta?.[id]);
    const kind = kinds.includes("vl") ? "vl" : kinds[0] ?? inferModelKind(id);
    groups[kind].push(id);
  }
  return groups;
}
