// PD-SAAS-FORK: Preflight Studio UI gate (off | shadow | enforce)
import { getRuntimeFeatureFlags } from './runtimeFeatureFlags';

export type PreflightStudioMode = 'off' | 'shadow' | 'enforce';

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

export function normalizePreflightStudioMode(raw?: string): PreflightStudioMode {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on') return 'enforce';
  if (v === 'shadow') return 'shadow';
  if (v === 'off' || v === '0' || v === 'false') return 'off';
  return 'off';
}

export function resolvePreflightStudioMode(): PreflightStudioMode {
  const runtime = getRuntimeFeatureFlags();
  if (runtime != null) return runtime.preflightStudioMode;
  // Fail-closed：runtime 未 hydrate 前不以 Vite 构建 bake 值开启（避免云端旧 bundle 误开）
  return 'off';
}

export function isPreflightStudioEnabled(mode = resolvePreflightStudioMode()): boolean {
  return mode === 'shadow' || mode === 'enforce';
}

export function isPreflightStudioEnforced(mode = resolvePreflightStudioMode()): boolean {
  return mode === 'enforce';
}

export function isPreflightEagerThumbsEnabled(): boolean {
  const raw = readEnv('PILOTDECK_PREFLIGHT_EAGER_THUMBS');
  return raw === '1' || raw === 'true' || raw === 'on';
}

export function shouldSuppressPptFlaskConfirm(): boolean {
  const raw = readEnv('PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM');
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return isPreflightStudioEnabled();
}
