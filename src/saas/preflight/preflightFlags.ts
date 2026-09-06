// PD-SAAS-FORK: Preflight Studio engine flags (off | shadow | enforce)
// Env wins; else config/platform-features.json (same contract as scripts/lib/platformFeatures.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type PreflightStudioMode = 'off' | 'shadow' | 'enforce';

function readEnv(name: string): string | undefined {
  if (typeof process !== 'undefined') {
    const v = process.env[name];
    if (v != null) return v;
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

function readPlatformFeaturesPreflightMode(): PreflightStudioMode {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(here, '../../../config/platform-features.json'),
      path.resolve(process.cwd(), 'config/platform-features.json'),
    ];
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { preflightStudio?: unknown };
      return normalizePreflightStudioMode(
        parsed?.preflightStudio != null ? String(parsed.preflightStudio) : undefined,
      );
    }
  } catch {
    // fall through
  }
  return 'off';
}

/** Env PILOTDECK_PREFLIGHT_STUDIO wins; otherwise platform-features.json; default off. */
export function resolvePreflightStudioMode(): PreflightStudioMode {
  const envRaw = readEnv('PILOTDECK_PREFLIGHT_STUDIO')?.trim();
  if (envRaw) return normalizePreflightStudioMode(envRaw);
  return readPlatformFeaturesPreflightMode();
}

export function isPreflightStudioEnabled(mode = resolvePreflightStudioMode()): boolean {
  return mode === 'shadow' || mode === 'enforce';
}

export function isPreflightStudioEnforced(mode = resolvePreflightStudioMode()): boolean {
  return mode === 'enforce';
}

export function shouldSuppressPptFlaskConfirm(): boolean {
  const raw = readEnv('PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM');
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return isPreflightStudioEnabled();
}

export function isPreflightEagerThumbsEnabled(): boolean {
  const raw = readEnv('PILOTDECK_PREFLIGHT_EAGER_THUMBS');
  return raw === '1' || raw === 'true' || raw === 'on';
}
