import {
  ANTHROPIC_DEFAULT_CAPABILITIES,
  ANTHROPIC_DEFAULT_MULTIMODAL,
} from "../providers/anthropic/defaults.js";
import {
  OPENAI_DEFAULT_CAPABILITIES,
  OPENAI_DEFAULT_MULTIMODAL,
} from "../providers/openai/defaults.js";
import type {
  ModelConfig,
  ModelDefinition,
  ModelProtocol,
  ProviderConfig,
} from "../protocol/canonical.js";
import { mergeCapabilities, type ModelCapabilities } from "../protocol/capabilities.js";
import { ModelConfigError } from "../protocol/errors.js";
import {
  DEFAULT_MULTIMODAL_CONSTRAINTS,
  isInputModality,
  type MultimodalConstraints,
} from "../protocol/multimodal.js";
import { lookupCatalogModel, lookupCatalogProvider } from "../catalog/index.js";
import { resolveApiKey, type CredentialEnv } from "./resolveCredentials.js";
import {
  isModelProtocol,
  isRecord,
  type RawCapabilities,
  type RawModelConfig,
  type RawModelDefinition,
  type RawMultimodal,
  type RawProviderConfig,
} from "./schema.js";
import { normalizeProviderApiKeySlots } from "./providerApiKeys.js";

export type ParseModelConfigOptions = {
  env?: CredentialEnv;
};

export function parseModelConfig(
  rawConfig: RawModelConfig | unknown,
  options: ParseModelConfigOptions = {},
): ModelConfig {
  if (!isRecord(rawConfig)) {
    throw new ModelConfigError("invalid_model_config", "Model config must be an object.");
  }

  if (!isRecord(rawConfig.providers) || Object.keys(rawConfig.providers).length === 0) {
    throw new ModelConfigError("missing_provider", "Model config must contain at least one provider.");
  }

  const providers: Record<string, ProviderConfig> = {};
  for (const [providerId, rawProvider] of Object.entries(rawConfig.providers)) {
    providers[providerId] = parseProvider(providerId, rawProvider, options.env);
  }

  return {
    providers,
  };
}

function parseProvider(providerId: string, rawProvider: unknown, env?: CredentialEnv): ProviderConfig {
  if (!isRecord(rawProvider)) {
    throw new ModelConfigError("invalid_provider", `Provider ${providerId} must be an object.`);
  }

  const provider = rawProvider as RawProviderConfig;
  const catalogProvider = lookupCatalogProvider(providerId);

  const protocol = isModelProtocol(provider.protocol)
    ? provider.protocol
    : catalogProvider?.protocol;
  if (!protocol) {
    throw new ModelConfigError("unsupported_protocol", `Provider ${providerId} has unsupported protocol.`, {
      providerId,
      protocol: provider.protocol,
    });
  }

  const trimmedUrl = typeof provider.url === "string" ? provider.url.trim() : "";
  const rawUrl = trimmedUrl.length > 0 ? trimmedUrl : catalogProvider?.defaultUrl;
  if (!rawUrl) {
    throw new ModelConfigError("invalid_config_value", `Provider ${providerId} requires a url.`, { providerId });
  }
  assertValidUrl(rawUrl, providerId);

  if (!isRecord(provider.models) || Object.keys(provider.models).length === 0) {
    throw new ModelConfigError("empty_models", `Provider ${providerId} must contain at least one model.`, {
      providerId,
    });
  }

  const models: Record<string, ModelDefinition> = {};
  for (const [modelId, rawModel] of Object.entries(provider.models)) {
    models[modelId] = parseModelDefinition(modelId, protocol, rawModel, providerId);
  }

  const keySlots = normalizeProviderApiKeySlots({
    apiKey: typeof provider.apiKey === "string" ? provider.apiKey.trim() : "",
    apiKeys: Array.isArray(provider.apiKeys)
      ? provider.apiKeys.filter((entry): entry is string => typeof entry === "string")
      : [],
  }).map((entry) => resolveApiKey(entry, env));
  if (keySlots.length === 0) {
    throw new ModelConfigError("missing_api_key", `Provider ${providerId} requires at least one apiKey.`, {
      providerId,
    });
  }

  return {
    id: providerId,
    protocol,
    url: rawUrl,
    apiKey: keySlots[0]!,
    alternateApiKeys: keySlots.length > 1 ? keySlots.slice(1) : undefined,
    timeoutMs: readOptionalPositiveNumber(provider.timeoutMs, "timeoutMs"),
    headers: readStringRecord(provider.headers, "headers"),
    extraBody: mergeProviderExtraBody(providerId, provider.extraBody),
    retry: isRecord(provider.retry) ? provider.retry : undefined,
    models,
  };
}

/** PD-SAAS-FORK: 通义默认开启模型侧联网（enable_search），与 web_search 工具并行 */
function mergeProviderExtraBody(
  providerId: string,
  rawExtraBody: unknown,
): Record<string, unknown> | undefined {
  const userExtra = isRecord(rawExtraBody) ? (rawExtraBody as Record<string, unknown>) : {};
  const defaults =
    providerId === "qwen" && userExtra.enable_search === undefined
      ? { enable_search: true }
      : {};
  const merged = { ...defaults, ...userExtra };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function parseModelDefinition(
  modelId: string,
  protocol: ModelProtocol,
  rawModel: unknown,
  providerId: string,
): ModelDefinition {
  const effectiveRaw = rawModel ?? {};
  if (!isRecord(effectiveRaw)) {
    throw new ModelConfigError("invalid_model", `Model ${modelId} must be an object.`);
  }

  const model = effectiveRaw as RawModelDefinition;
  const catalogHit = lookupCatalogModel(providerId, modelId);
  const catalogModel = catalogHit.model;
  const inferredMultimodal = inferProviderMultimodalDefaults(providerId, modelId, catalogModel?.multimodal);

  const capabilities = parseCapabilities(protocol, model.capabilities, catalogModel?.capabilities);
  const multimodal = parseMultimodal(protocol, model.multimodal, inferredMultimodal ?? catalogModel?.multimodal);

  return {
    id: modelId,
    displayName: typeof model.displayName === "string"
      ? model.displayName
      : catalogModel?.displayName,
    capabilities,
    multimodal,
    aliases: readStringArray(model.aliases, "aliases"),
  };
}

function parseCapabilities(
  protocol: ModelProtocol,
  rawCapabilities: unknown,
  catalogCapabilities?: ModelCapabilities,
): ModelCapabilities {
  const protocolDefaults =
    protocol === "anthropic" ? ANTHROPIC_DEFAULT_CAPABILITIES : OPENAI_DEFAULT_CAPABILITIES;
  const defaults = catalogCapabilities ?? protocolDefaults;

  if (rawCapabilities === undefined) {
    return defaults;
  }

  if (!isRecord(rawCapabilities)) {
    throw new ModelConfigError("invalid_capabilities", "Model capabilities must be an object.");
  }

  const capabilities = rawCapabilities as RawCapabilities;
  const overrides: Partial<ModelCapabilities> = {};

  for (const key of [
    "supportsToolUse",
    "supportsStreaming",
    "supportsParallelToolCalls",
    "supportsThinking",
    "supportsJsonSchema",
    "supportsSystemPrompt",
    "supportsPromptCache",
  ] as const) {
    if (capabilities[key] !== undefined) {
      if (typeof capabilities[key] !== "boolean") {
        throw new ModelConfigError("invalid_capabilities", `Capability ${key} must be boolean.`);
      }
      overrides[key] = capabilities[key];
    }
  }

  // Accept `contextWindow` as an alias for `maxContextTokens` so that
  // YAML configs using the friendlier name are not silently ignored.
  const raw = rawCapabilities as Record<string, unknown>;
  if (raw.contextWindow !== undefined && capabilities.maxContextTokens === undefined) {
    overrides.maxContextTokens = readPositiveNumber(raw.contextWindow, "contextWindow");
  }

  for (const key of ["maxContextTokens", "maxOutputTokens"] as const) {
    if (capabilities[key] !== undefined) {
      overrides[key] = readPositiveNumber(capabilities[key], key);
    }
  }

  return mergeCapabilities(defaults, overrides);
}

const QWEN_NATIVE_MULTIMODAL_DEFAULTS: MultimodalConstraints = {
  input: ["text", "image"],
  maxImagesPerRequest: 250,
  supportedImageMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  imageDetail: "auto",
};

/** DashScope Qwen3.5+ unified chat models (plus/flash/max/omni), not legacy qwen-vl-* only. */
export function isQwenNativeMultimodalModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (/vl|vision|omni/i.test(id)) return true;
  if (/^qwen3\.(?:5|6|7|8)-(?:plus|flash|max|omni)/.test(id)) return true;
  if (/^qwen3\.6-(?:35b-a3b|27b)/.test(id)) return true;
  return false;
}

function inferProviderMultimodalDefaults(
  providerId: string,
  modelId: string,
  catalogMultimodal?: MultimodalConstraints,
): MultimodalConstraints | undefined {
  if (catalogMultimodal) {
    return catalogMultimodal;
  }
  if (providerId !== "qwen") {
    return undefined;
  }
  if (isQwenNativeMultimodalModel(modelId)) {
    return QWEN_NATIVE_MULTIMODAL_DEFAULTS;
  }
  return { input: ["text"] };
}

function parseMultimodal(
  protocol: ModelProtocol,
  rawMultimodal: unknown,
  catalogMultimodal?: MultimodalConstraints,
): MultimodalConstraints {
  const protocolDefaults =
    protocol === "anthropic" ? ANTHROPIC_DEFAULT_MULTIMODAL : OPENAI_DEFAULT_MULTIMODAL;
  const defaults = catalogMultimodal ?? { ...DEFAULT_MULTIMODAL_CONSTRAINTS, ...protocolDefaults };

  if (rawMultimodal === undefined) {
    return defaults;
  }

  if (!isRecord(rawMultimodal)) {
    throw new ModelConfigError("invalid_multimodal", "Model multimodal config must be an object.");
  }

  const multimodal = rawMultimodal as RawMultimodal;
  if (!Array.isArray(multimodal.input)) {
    throw new ModelConfigError("invalid_multimodal_input", "multimodal.input must be a string list.");
  }

  const input = multimodal.input.map((value) => {
    if (!isInputModality(value)) {
      throw new ModelConfigError("invalid_multimodal_input", "multimodal.input contains unsupported modality.", {
        modality: value,
      });
    }
    return value;
  });

  return {
    ...defaults,
    input,
    maxImagesPerRequest: readOptionalPositiveNumber(
      multimodal.maxImagesPerRequest,
      "maxImagesPerRequest",
    ),
    maxImageBytes: readOptionalPositiveNumber(multimodal.maxImageBytes, "maxImageBytes"),
    supportedImageMimeTypes: readStringArray(
      multimodal.supportedImageMimeTypes,
      "supportedImageMimeTypes",
    ),
    maxPdfPages: readOptionalPositiveNumber(multimodal.maxPdfPages, "maxPdfPages"),
    maxPdfBytes: readOptionalPositiveNumber(multimodal.maxPdfBytes, "maxPdfBytes"),
    maxAudioSeconds: readOptionalPositiveNumber(multimodal.maxAudioSeconds, "maxAudioSeconds"),
    imageDetail: parseImageDetail(multimodal.imageDetail),
  };
}

function readRequiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ModelConfigError("invalid_config_value", `${key} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new ModelConfigError("invalid_config_value", `${key} must be a non-empty string.`);
  }
  return value;
}

function readPositiveNumber(value: unknown, key: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ModelConfigError("invalid_config_value", `${key} must be a positive number.`);
  }
  return value;
}

function readOptionalPositiveNumber(value: unknown, key: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return readPositiveNumber(value, key);
}

function readStringRecord(value: unknown, key: string): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    throw new ModelConfigError("invalid_config_value", `${key} must be an object.`);
  }

  const output: Record<string, string> = {};
  for (const [recordKey, recordValue] of Object.entries(value)) {
    if (typeof recordValue !== "string") {
      throw new ModelConfigError("invalid_config_value", `${key}.${recordKey} must be a string.`);
    }
    output[recordKey] = recordValue;
  }
  return output;
}

function readStringArray(value: unknown, key: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ModelConfigError("invalid_config_value", `${key} must be a string list.`);
  }

  return value;
}

function parseImageDetail(value: unknown): MultimodalConstraints["imageDetail"] {
  if (value === undefined) {
    return undefined;
  }

  if (value === "auto" || value === "low" || value === "high") {
    return value;
  }

  throw new ModelConfigError("invalid_multimodal", "multimodal.imageDetail must be auto, low or high.");
}

function assertValidUrl(value: string, providerId: string): void {
  try {
    new URL(value);
  } catch {
    throw new ModelConfigError("invalid_url", `Provider ${providerId} url is invalid.`, {
      providerId,
      url: value,
    });
  }
}
