// PD-SAAS-FORK: resolve UI/system language for agent prompts and recovery copy
import type { PilotConfig } from "../../pilot/config/types.js";

export type PromptLanguage = "en" | "zh-CN";

const VALID_LANGUAGES = new Set<string>(["en", "zh-CN"]);

export function normalizePromptLanguage(value: unknown): PromptLanguage | undefined {
  if (typeof value !== "string" || !VALID_LANGUAGES.has(value)) {
    return undefined;
  }
  return value as PromptLanguage;
}

function resolveOsLocale(env: NodeJS.ProcessEnv = process.env): PromptLanguage | undefined {
  const raw = env.LC_ALL || env.LANG || "";
  if (!raw) return undefined;
  const normalized = raw.toLowerCase().replace(/_/g, "-");
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("en")) return "en";
  return undefined;
}

/**
 * Priority: top-level config.language → alwaysOn.language → OS locale → "zh-CN".
 */
type PromptLanguageConfig = Pick<PilotConfig, "alwaysOn"> & {
  language?: unknown;
};

export function resolvePromptLanguage(
  config: PromptLanguageConfig,
  env?: NodeJS.ProcessEnv,
): PromptLanguage {
  const topLevel = normalizePromptLanguage(config.language);
  if (topLevel) return topLevel;

  const alwaysOn = normalizePromptLanguage(config.alwaysOn?.language);
  if (alwaysOn) return alwaysOn;

  // PD-SAAS-FORK: Nova 新装默认中文工作语言
  return resolveOsLocale(env) ?? "zh-CN";
}
