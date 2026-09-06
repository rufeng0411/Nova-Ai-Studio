// PD-SAAS-FORK: capability hub client cache — instant cards, refresh when skills/catalog change
import { DEFAULT_UI_LANGUAGE } from '../i18n/languages.js';

const STORAGE_KEY = 'pilotdeck:capability-hub:v1';
const CACHE_VERSION = 6;

export type CapabilityHubCacheReport = {
  catalog_generated_at?: string | null;
  skills_revision?: string | null;
  total_runtime_skills?: number;
  locale?: string;
  hub_visibility_updated_at?: string | null;
};

export type CapabilityHubCachedPayload = {
  stages: unknown[];
  education_bands?: unknown[];
  flywheel_task_groups?: Record<string, unknown[]>;
  geo_flywheel_stages?: unknown[];
  major_categories?: Record<string, unknown>;
  capabilities: unknown[];
};

export type CapabilityHubCacheEntry = {
  version: typeof CACHE_VERSION;
  fingerprint: string;
  locale: string;
  projectPath: string;
  payload: CapabilityHubCachedPayload;
  /** PD-SAAS-FORK: 与 payload 同步的可见性 doc，避免 Tab 与卡片在刷新前不一致 */
  hubVisibility?: Record<string, unknown>;
  cachedAt: number;
};

export function buildCapabilityHubFingerprint(report: CapabilityHubCacheReport): string {
  const catalogAt = report.catalog_generated_at || '';
  const skillsRevision = report.skills_revision
    || String(report.total_runtime_skills ?? 0);
  const locale = report.locale || '';
  const hubVisAt = report.hub_visibility_updated_at || '';
  return `${catalogAt}|${skillsRevision}|${locale}|${hubVisAt}`;
}

function normalizeProjectPath(projectPath?: string | null): string {
  return (projectPath || '').trim();
}

function normalizeLocale(locale?: string | null): string {
  const value = (locale || DEFAULT_UI_LANGUAGE).trim().toLowerCase();
  return value.startsWith('zh') ? 'zh-CN' : 'en';
}

export function readCapabilityHubCache(
  locale: string,
  projectPath?: string | null,
): CapabilityHubCacheEntry | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CapabilityHubCacheEntry;
    if (parsed.version !== CACHE_VERSION) return null;
    if (normalizeLocale(parsed.locale) !== normalizeLocale(locale)) return null;
    if (normalizeProjectPath(parsed.projectPath) !== normalizeProjectPath(projectPath)) return null;
    if (!parsed.payload || !Array.isArray(parsed.payload.capabilities)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCapabilityHubCache(entry: Omit<CapabilityHubCacheEntry, 'version' | 'cachedAt'>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const payload: CapabilityHubCacheEntry = {
      version: CACHE_VERSION,
      cachedAt: Date.now(),
      ...entry,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore; bundled fallback still works.
  }
}

export function clearCapabilityHubCache(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** PD-SAAS-FORK: fingerprint for session capability binding cache invalidation */
export function readCapabilityHubCacheFingerprint(): string {
  if (typeof sessionStorage === 'undefined') return 'default';
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 'default';
    const parsed = JSON.parse(raw) as CapabilityHubCacheEntry;
    return parsed.fingerprint || 'default';
  } catch {
    return 'default';
  }
}
