// PD-SAAS-FORK: Markdown browser tool gate（Hub 插件 + /tools/md-browser）
import { getRuntimeFeatureFlags, subscribeRuntimeFeatureFlags } from './runtimeFeatureFlags';

const MD_BROWSER_ENV_KEYS = ['PILOTDECK_MD_BROWSER_TOOL', 'VITE_MD_BROWSER_TOOL'] as const;

function readEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[name] != null) {
    return process.env[name];
  }
  const viteEnv = typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
    : undefined;
  if (viteEnv) {
    const direct = viteEnv[name];
    if (direct != null) return direct;
    const vite = viteEnv[`VITE_${name}`];
    if (vite != null) return vite;
  }
  return undefined;
}

function parseEnvBoolean(raw: string | undefined): boolean | null {
  if (raw == null || raw === '') return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readMdBrowserEnvOverride(): boolean | null {
  for (const key of MD_BROWSER_ENV_KEYS) {
    const parsed = parseEnvBoolean(readEnv(key));
    if (parsed != null) return parsed;
  }
  return null;
}

export function isMdBrowserBuildDisabled(): boolean {
  return readMdBrowserEnvOverride() === false;
}

/** Prefer Bridge runtime flags; fall back to env; default off until hydrated. */
export function isMdBrowserToolEnabled(): boolean {
  if (isMdBrowserBuildDisabled()) return false;

  const runtime = getRuntimeFeatureFlags();
  if (runtime != null) return runtime.mdBrowserTool === true;

  const envOverride = readMdBrowserEnvOverride();
  if (envOverride != null) return envOverride;

  return false;
}

export function subscribeMdBrowserToolEnabled(onChange: () => void): () => void {
  return subscribeRuntimeFeatureFlags(onChange);
}
