import type { ModelConfig } from "../../model/protocol/canonical.js";
import {
  resolveApiKey as resolveApiKeyValue,
  type CredentialEnv,
} from "../../model/config/resolveCredentials.js";
import type {
  PilotBaiduAiConfig,
  PilotDocumentComposeConfig,
  PilotDocumentExportConfig,
  PilotDocumentOcrConfig,
  PilotDocumentOcrExtractorMethod,
  PilotDocumentOcrInpaintMethod,
  PilotDocumentOcrMode,
  PilotDocumentOcrProvider,
  PilotDocumentToolsConfig,
} from "./types.js";
import type { ResolvedDocumentExportConfig } from "../../saas/document-export/types.js";

export type { ResolvedDocumentExportConfig };
import {
  isConfiguredApiKey,
  modelConfigToProviderSlices,
} from "./resolveMediaFromModelProviders.js";

// PD-SAAS-FORK: resolve documentCompose / documentOcr from pilotdeck.yaml + model pool
export type ResolvedDocumentComposeConfig = {
  aspectRatio: string;
};

export type ResolvedDocumentOcrConfig = {
  provider: PilotDocumentOcrProvider;
  mode: PilotDocumentOcrMode;
  apiUrl: string;
  apiKey?: string;
  model: string;
  fallbackProvider?: PilotDocumentOcrProvider;
  dashscopeApiKey?: string;
  extractorMethod: PilotDocumentOcrExtractorMethod;
  inpaintMethod: PilotDocumentOcrInpaintMethod;
  baiduApiKey?: string;
  baiduSecretKey?: string;
};

export type ResolvedBaiduAiConfig = {
  apiKey?: string;
  secretKey?: string;
  configured: boolean;
};

export type ResolvedEditablePptxConfig = ResolvedDocumentOcrConfig & {
  baiduConfigured: boolean;
  hybridReady: boolean;
};

const DEFAULT_COMPOSE_ASPECT_RATIO = "16:9";
const DEFAULT_OCR_API_URL_CLOUD = "https://mineru.net/api/v4";
const DEFAULT_OCR_API_URL_LOCAL = "http://127.0.0.1:8000";
const DEFAULT_QWEN_VL_MODEL = "qwen-vl-max";

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

export function matchesMineruApiKey(apiKey: string): boolean {
  const key = apiKey.trim();
  if (!key) return false;
  return /^eyJ/i.test(key) || key.length >= 32;
}

function readDashScopePoolKey(
  modelProviders: ReturnType<typeof modelConfigToProviderSlices>,
  env: CredentialEnv,
): string | undefined {
  const ids = ["qwen", "dashscope"];
  for (const id of ids) {
    const resolved = tryResolveApiKeyString(modelProviders?.[id]?.apiKey, env);
    if (resolved && /^sk-/i.test(resolved)) return resolved;
  }
  const fromEnv = String(env.DASHSCOPE_API_KEY ?? "").trim();
  return fromEnv && /^sk-/i.test(fromEnv) ? fromEnv : undefined;
}

function resolveMineruApiKey(
  explicit: string | undefined,
  env: CredentialEnv,
): string | undefined {
  const explicitResolved = tryResolveApiKeyString(explicit, env);
  if (explicitResolved && matchesMineruApiKey(explicitResolved)) {
    return explicitResolved;
  }
  const fromEnv = String(env.MINERU_API_TOKEN ?? env.PILOTDECK_DOCUMENT_OCR_API_KEY ?? "").trim();
  if (fromEnv && matchesMineruApiKey(fromEnv)) return fromEnv;
  return undefined;
}

function isConfiguredSecret(value: string | undefined): boolean {
  const trimmed = String(value || "").trim();
  return Boolean(trimmed && !/^\*+$/.test(trimmed));
}

export function resolveBaiduAiConfig(
  explicit: PilotBaiduAiConfig | undefined,
  env: CredentialEnv = process.env,
): ResolvedBaiduAiConfig {
  const apiKey =
    tryResolveApiKeyString(explicit?.apiKey, env) ||
    String(env.BAIDU_API_KEY ?? "").trim() ||
    undefined;
  const secretKey =
    tryResolveApiKeyString(explicit?.secretKey, env) ||
    String(env.BAIDU_SECRET_KEY ?? "").trim() ||
    undefined;
  const enabled = explicit?.enabled !== false;
  const bceV3 = Boolean(apiKey?.startsWith("bce-v3/"));
  const configured =
    enabled && isConfiguredSecret(apiKey) && (bceV3 || isConfiguredSecret(secretKey));
  return { apiKey, secretKey, configured };
}

export function resolveBaiduAiFromTools(
  tools: PilotToolsConfigLike | undefined,
  env: CredentialEnv = process.env,
): ResolvedBaiduAiConfig {
  return resolveBaiduAiConfig(tools?.baiduAi, env);
}

export function resolveEditablePptxConfig(
  tools: PilotToolsConfigLike | undefined,
  modelConfig: ModelConfig | undefined,
  env: CredentialEnv = process.env,
): ResolvedEditablePptxConfig | undefined {
  const ocr = resolveDocumentOcrFromTools(tools, modelConfig, env);
  if (!ocr) return undefined;
  const baidu = resolveBaiduAiFromTools(tools, env);
  const hybridReady =
    ocr.extractorMethod === "mineru" || (ocr.extractorMethod === "hybrid" && baidu.configured);
  return {
    ...ocr,
    baiduConfigured: baidu.configured,
    hybridReady,
  };
}

export function resolveDocumentComposeConfig(
  explicit: PilotDocumentComposeConfig | undefined,
  env: CredentialEnv = process.env,
): ResolvedDocumentComposeConfig {
  const fromEnv = String(env.PILOTDECK_DOCUMENT_COMPOSE_ASPECT_RATIO ?? "").trim();
  const aspectRatio =
    explicit?.aspectRatio?.trim() ||
    fromEnv ||
    DEFAULT_COMPOSE_ASPECT_RATIO;
  return { aspectRatio };
}

export function resolveDocumentOcrConfig(
  explicit: PilotDocumentOcrConfig | undefined,
  modelProviders: ReturnType<typeof modelConfigToProviderSlices>,
  env: CredentialEnv = process.env,
  baiduAi?: PilotBaiduAiConfig,
): ResolvedDocumentOcrConfig | undefined {
  const provider =
    (explicit?.provider ??
      (env.PILOTDECK_DOCUMENT_OCR_PROVIDER as PilotDocumentOcrProvider | undefined) ??
      "mineru") as PilotDocumentOcrProvider;
  const mode =
    (explicit?.mode ??
      (env.PILOTDECK_DOCUMENT_OCR_MODE as PilotDocumentOcrMode | undefined) ??
      "cloud") as PilotDocumentOcrMode;
  const fallbackProvider =
    explicit?.fallbackProvider ??
    ((env.PILOTDECK_DOCUMENT_OCR_FALLBACK as PilotDocumentOcrProvider | undefined) || "qwen-vl");

  const apiUrlRaw =
    explicit?.apiUrl?.trim() ||
    String(env.PILOTDECK_DOCUMENT_OCR_API_URL ?? "").trim() ||
    (mode === "local" ? DEFAULT_OCR_API_URL_LOCAL : DEFAULT_OCR_API_URL_CLOUD);
  const apiUrl = apiUrlRaw.replace(/\/+$/, "");

  const mineruKey = resolveMineruApiKey(explicit?.apiKey, env);
  const dashscopeApiKey = readDashScopePoolKey(modelProviders, env);
  const model =
    explicit?.model?.trim() ||
    String(env.PILOTDECK_DOCUMENT_OCR_MODEL ?? "").trim() ||
    DEFAULT_QWEN_VL_MODEL;
  const extractorMethod =
    explicit?.extractorMethod ??
    ((env.PILOTDECK_DOCUMENT_EXTRACTOR_METHOD as PilotDocumentOcrExtractorMethod | undefined) ||
      "hybrid");
  const inpaintMethod =
    explicit?.inpaintMethod ??
    ((env.PILOTDECK_INPAINT_METHOD as PilotDocumentOcrInpaintMethod | undefined) || "baidu");
  const baidu = resolveBaiduAiConfig(baiduAi, env);

  const baseFields = {
    mode,
    apiUrl,
    model,
    fallbackProvider,
    extractorMethod,
    inpaintMethod,
    baiduApiKey: baidu.apiKey,
    baiduSecretKey: baidu.secretKey,
  };

  if (provider === "mineru") {
    if (!mineruKey && fallbackProvider !== "qwen-vl") {
      return undefined;
    }
    if (!mineruKey && !dashscopeApiKey) {
      return undefined;
    }
    return {
      provider: mineruKey ? "mineru" : "qwen-vl",
      apiKey: mineruKey ?? dashscopeApiKey,
      dashscopeApiKey,
      ...baseFields,
    };
  }

  if (!dashscopeApiKey && !isConfiguredApiKey(explicit?.apiKey)) {
    return undefined;
  }

  return {
    provider: "qwen-vl",
    apiKey: dashscopeApiKey,
    dashscopeApiKey,
    ...baseFields,
  };
}

export function resolveDocumentOcrFromModelConfig(
  explicit: PilotDocumentOcrConfig | undefined,
  modelConfig: ModelConfig | undefined,
  env: CredentialEnv = process.env,
  baiduAi?: PilotBaiduAiConfig,
): ResolvedDocumentOcrConfig | undefined {
  return resolveDocumentOcrConfig(explicit, modelConfigToProviderSlices(modelConfig), env, baiduAi);
}

function mergeDocumentTools(
  documentBlock: PilotDocumentToolsConfig | undefined,
  legacyCompose: PilotDocumentComposeConfig | undefined,
  legacyOcr: PilotDocumentOcrConfig | undefined,
  legacyExport: PilotDocumentExportConfig | undefined,
): PilotDocumentToolsConfig & { baiduAi?: PilotBaiduAiConfig } {
  return {
    compose: documentBlock?.compose ?? legacyCompose,
    ocr: documentBlock?.ocr ?? legacyOcr,
    export: documentBlock?.export ?? legacyExport,
  };
}

const DEFAULT_EXPORT_PROVIDERS: Record<string, boolean | "auto"> = {
  "playwright-pdf": true,
  "docx-js": true,
  "python-pptx-ir": true,
  exceljs: true,
  "mineru-ocr-pptx": true,
  nutrient: "auto",
  "minimax-pdf": true,
};

export function resolveDocumentExportConfig(
  tools: {
    document?: PilotDocumentToolsConfig;
    documentCompose?: PilotDocumentComposeConfig;
    documentOcr?: PilotDocumentOcrConfig;
    documentExport?: PilotDocumentExportConfig;
  } | undefined,
  env: CredentialEnv = process.env,
): ResolvedDocumentExportConfig {
  const merged = mergeDocumentTools(
    tools?.document,
    tools?.documentCompose,
    tools?.documentOcr,
    tools?.documentExport,
  );
  const explicit = merged.export;
  const cloudPreference =
    explicit?.cloudPreference ??
    (env.PILOTDECK_DOCUMENT_EXPORT_CLOUD as "cloud_first" | "local_only" | undefined) ??
    "cloud_first";
  const defaultQuality =
    explicit?.defaultQuality ??
    (env.PILOTDECK_DOCUMENT_EXPORT_QUALITY as "fast" | "balanced" | "fidelity" | undefined) ??
    "balanced";
  const poolSize = explicit?.playwright?.poolSize ?? Number(env.PILOTDECK_DOCUMENT_EXPORT_POOL_SIZE ?? 1);
  const nutrientFromEnv = String(env.NUTRIENT_API_KEY ?? env.PILOTDECK_NUTRIENT_API_KEY ?? "").trim();
  const nutrientApiKey =
    tryResolveApiKeyString(explicit?.nutrient?.apiKey, env) ?? (nutrientFromEnv || undefined);
  return {
    cloudPreference,
    defaultQuality,
    playwrightPoolSize: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 1,
    nutrientApiKey,
    enabledProviders: { ...DEFAULT_EXPORT_PROVIDERS, ...(explicit?.providers ?? {}) },
  };
}

export function resolveDocumentComposeFromTools(
  tools: PilotToolsConfigLike | undefined,
  env: CredentialEnv = process.env,
): ResolvedDocumentComposeConfig {
  const merged = mergeDocumentTools(
    tools?.document,
    tools?.documentCompose,
    tools?.documentOcr,
    tools?.documentExport,
  );
  return resolveDocumentComposeConfig(merged.compose, env);
}

export function resolveDocumentOcrFromTools(
  tools: PilotToolsConfigLike | undefined,
  modelConfig: ModelConfig | undefined,
  env: CredentialEnv = process.env,
): ResolvedDocumentOcrConfig | undefined {
  const merged = mergeDocumentTools(
    tools?.document,
    tools?.documentCompose,
    tools?.documentOcr,
    tools?.documentExport,
  );
  return resolveDocumentOcrFromModelConfig(merged.ocr, modelConfig, env, tools?.baiduAi);
}

type PilotToolsConfigLike = {
  document?: PilotDocumentToolsConfig;
  documentCompose?: PilotDocumentComposeConfig;
  documentOcr?: PilotDocumentOcrConfig;
  documentExport?: PilotDocumentExportConfig;
  baiduAi?: PilotBaiduAiConfig;
};
