// PD-SAAS-FORK: resolve primary + fallback media/search tool registry options

import { clampToolCapabilityFallbacks } from "./toolCapabilityFallbacks.js";
import type { PilotMediaToolConfig, PilotWebSearchConfig } from "./types.js";
import {
  modelConfigToProviderSlices,
  resolveMediaToolFromModelProviders,
  type ModelProviderSlice,
} from "./resolveMediaFromModelProviders.js";
import type { ModelConfig } from "../../model/protocol/canonical.js";
import type { CredentialEnv } from "../../model/config/resolveCredentials.js";
import type { CreateGenerateImageToolOptions } from "../../tool/builtin/generateImage.js";
import type { CreateGenerateVideoToolOptions } from "../../tool/builtin/generateVideo.js";
import type { CreateWebSearchToolOptions } from "../../tool/builtin/webSearch.js";

type MediaKind = "image" | "video" | "tts" | "speech";

function toMediaRegistryOptions(
  resolved: PilotMediaToolConfig | undefined,
): CreateGenerateImageToolOptions | CreateGenerateVideoToolOptions | undefined {
  if (!resolved) return undefined;
  return {
    ...(resolved.provider ? { provider: resolved.provider as CreateGenerateImageToolOptions["provider"] } : {}),
    ...(resolved.apiKey ? { apiKey: resolved.apiKey } : {}),
    ...(resolved.baseUrl ? { baseUrl: resolved.baseUrl } : {}),
    ...(resolved.model ? { model: resolved.model } : {}),
  };
}

export function buildResolvedMediaToolOptions(
  explicit: PilotMediaToolConfig | undefined,
  modelProviders: Record<string, ModelProviderSlice> | undefined,
  mediaKind: MediaKind,
  env: CredentialEnv = process.env,
): CreateGenerateImageToolOptions | CreateGenerateVideoToolOptions | undefined {
  const primary = resolveMediaToolFromModelProviders(explicit, modelProviders, mediaKind, env);
  const primaryOptions = toMediaRegistryOptions(primary);
  if (!primaryOptions) return undefined;

  const fallbacks = clampToolCapabilityFallbacks(explicit?.fallbacks)
    .map((entry) => toMediaRegistryOptions(resolveMediaToolFromModelProviders(entry, modelProviders, mediaKind, env)))
    .filter((entry): entry is CreateGenerateImageToolOptions => Boolean(entry));

  return fallbacks.length > 0 ? { ...primaryOptions, fallbacks } : primaryOptions;
}

export function buildResolvedWebSearchToolOptions(
  explicit: PilotWebSearchConfig | undefined,
): CreateWebSearchToolOptions | undefined {
  if (!explicit) return undefined;
  const primary: CreateWebSearchToolOptions = {
    ...(explicit.provider ? { provider: explicit.provider } : {}),
    ...(explicit.apiKey ? { apiKey: explicit.apiKey } : {}),
    ...(explicit.endpoint ? { endpoint: explicit.endpoint } : {}),
    ...(explicit.customProvider ? { customProvider: explicit.customProvider } : {}),
  };
  const fallbacks = clampToolCapabilityFallbacks(explicit.fallbacks)
    .map((entry) => ({
      ...(entry.provider ? { provider: entry.provider } : {}),
      ...(entry.apiKey ? { apiKey: entry.apiKey } : {}),
      ...(entry.endpoint ? { endpoint: entry.endpoint } : {}),
      ...(entry.customProvider ? { customProvider: entry.customProvider } : {}),
    }))
    .filter((entry) => Object.keys(entry).length > 0);
  return fallbacks.length > 0 ? { ...primary, fallbacks } : primary;
}

export function buildModelProviderSlicesFromConfig(model: ModelConfig | undefined) {
  return modelConfigToProviderSlices(model);
}
