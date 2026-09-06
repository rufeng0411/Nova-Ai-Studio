// PD-SAAS-FORK: Bento deck preview/edit feature gate（默认关闭；后台 platform-features 或 env 开启）
import { getRuntimeFeatureFlags, subscribeRuntimeFeatureFlags } from './runtimeFeatureFlags';

const BENTO_ENV_KEYS = ['PILOTDECK_BENTO_DECK_EDITOR', 'VITE_BENTO_DECK_PREVIEW'] as const;

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
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

function readBentoEnvOverride(): boolean | null {
  for (const key of BENTO_ENV_KEYS) {
    const parsed = parseEnvBoolean(readEnv(key));
    if (parsed != null) return parsed;
  }
  return null;
}

export function isBentoDeckBuildDisabled(): boolean {
  return readBentoEnvOverride() === false;
}

export function isBentoDeckEnabled(): boolean {
  if (isBentoDeckBuildDisabled()) return false;

  const runtime = getRuntimeFeatureFlags();
  if (runtime != null) return runtime.bentoDeckEditor;

  const envOverride = readBentoEnvOverride();
  if (envOverride != null) return envOverride;

  return false;
}

export function subscribeBentoDeckEnabled(onChange: () => void): () => void {
  const unsubRuntime = subscribeRuntimeFeatureFlags(onChange);
  if (typeof window === 'undefined') {
    return unsubRuntime;
  }
  return unsubRuntime;
}
