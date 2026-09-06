import type { PilotDeckSettings } from '../types/types';
import { authenticatedFetch } from '../../../utils/api.js';
import { readDefaultAutoContinueEnabled } from '../../../shared/manualContinuePolicy';

export const PILOTDECK_SETTINGS_KEY = 'pilotdeck-settings';
export const AUTO_RECOVERY_CONTINUE_USER_SET_KEY = 'autoRecoveryContinueUserSet';

export const safeLocalStorage = {
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old data');

        const keys = Object.keys(localStorage);
        const draftKeys = keys.filter((k) => k.startsWith('draft_input_'));
        draftKeys.forEach((k) => {
          localStorage.removeItem(k);
        });

        try {
          localStorage.setItem(key, value);
        } catch (retryError) {
          console.error('Failed to save to localStorage even after cleanup:', retryError);
        }
      } else {
        console.error('localStorage error:', error);
      }
    }
  },
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('localStorage getItem error:', error);
      return null;
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('localStorage removeItem error:', error);
    }
  },
};

// When localStorage has no cached permission settings, align with server default
// (skipPermissions=true). Disk authority: ~/.pilotdeck/permissions.json — synced on Settings load.

function resolveStoredAutoRecoveryContinue(parsed: Record<string, unknown>): boolean {
  const defaultEnabled = readDefaultAutoContinueEnabled();
  if (typeof parsed.autoRecoveryContinue !== 'boolean') {
    return defaultEnabled;
  }
  if (parsed.autoRecoveryContinue) {
    return true;
  }
  // Honor explicit user opt-out; legacy false from old product default → default ON.
  if (parsed[AUTO_RECOVERY_CONTINUE_USER_SET_KEY] === true) {
    return false;
  }
  return defaultEnabled;
}

function buildDefaultPilotDeckSettings(): PilotDeckSettings {
  return {
    allowedTools: [],
    disallowedTools: [],
    skipPermissions: true,
    projectSortOrder: 'date',
    autoRecoveryContinue: readDefaultAutoContinueEnabled(),
  };
}

export function getPilotDeckSettings(): PilotDeckSettings {
  const raw = safeLocalStorage.getItem(PILOTDECK_SETTINGS_KEY);
  if (!raw) {
    return buildDefaultPilotDeckSettings();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...parsed,
      allowedTools: Array.isArray(parsed.allowedTools) ? parsed.allowedTools : [],
      disallowedTools: Array.isArray(parsed.disallowedTools) ? parsed.disallowedTools : [],
      skipPermissions:
        typeof parsed.skipPermissions === 'boolean'
          ? parsed.skipPermissions
          : true,
      projectSortOrder: parsed.projectSortOrder === 'name' ? 'name' : 'date',
      autoRecoveryContinue: resolveStoredAutoRecoveryContinue(parsed),
    };
  } catch {
    return buildDefaultPilotDeckSettings();
  }
}

export async function fetchPilotDeckPermissionSettings(): Promise<PilotDeckSettings> {
  const response = await authenticatedFetch('/api/settings/permissions');
  if (!response.ok) {
    throw new Error(`Failed to fetch permission settings: HTTP ${response.status}`);
  }
  const data = await response.json();
  return mergePermissionSettings(data.permissions);
}

export async function savePilotDeckPermissionSettings(
  updates: Partial<PilotDeckSettings>,
): Promise<PilotDeckSettings> {
  const response = await authenticatedFetch('/api/settings/permissions', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`Failed to save permission settings: HTTP ${response.status}`);
  }
  const data = await response.json();
  const next = mergePermissionSettings(data.permissions);
  safeLocalStorage.setItem(PILOTDECK_SETTINGS_KEY, JSON.stringify({
    ...getPilotDeckSettings(),
    ...next,
  }));
  window.dispatchEvent(new Event('pilotdeck-settings-changed'));
  return next;
}

function mergePermissionSettings(value: unknown): PilotDeckSettings {
  const current = getPilotDeckSettings();
  const parsed = value && typeof value === 'object' ? value as Partial<PilotDeckSettings> : {};
  const mergedRaw = { ...current, ...parsed } as Record<string, unknown>;
  return {
    ...current,
    ...parsed,
    allowedTools: Array.isArray(parsed.allowedTools) ? parsed.allowedTools : [],
    disallowedTools: Array.isArray(parsed.disallowedTools) ? parsed.disallowedTools : [],
    skipPermissions:
      typeof parsed.skipPermissions === 'boolean'
        ? parsed.skipPermissions
        : current.skipPermissions,
    projectSortOrder: current.projectSortOrder === 'name' ? 'name' : 'date',
    autoRecoveryContinue: resolveStoredAutoRecoveryContinue(mergedRaw),
  };
}
