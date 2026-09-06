/**
 * PD-SAAS-FORK: per-user UI preferences (project continuity toggle, etc.).
 */
import { getControlDriver } from './db/control.js';
import { normalizeHubFavorites } from '../../shared/hubFavorites.mjs';

const DEFAULT_FILE_STORAGE = {
  cloudOnly: true,
  migrationVersion: 2,
};

const DEFAULT_PREFERENCES = {
  projectContinuity: true,
  avatarUpdatedAt: null,
  fileStorage: { ...DEFAULT_FILE_STORAGE },
  /** Mirrors UI design canvas toggle (Gateway tools use PILOTDECK_DESIGN_CANVAS env). */
  designCanvasEnabled: false,
  hubFavorites: { capabilities: [], templates: [] },
  /** PD-SAAS-FORK: workbench beta tour / next-chip dismiss */
  workbenchTour: { v1: { completedAt: null, skipped: false } },
  workbenchNextDismiss: {},
};

function normalizeFileStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FILE_STORAGE };
  }
  return {
    cloudOnly: raw.cloudOnly !== false,
    migrationVersion: typeof raw.migrationVersion === 'number' ? raw.migrationVersion : 2,
  };
}

function parsePreferencesJson(raw) {
  if (!raw || typeof raw !== 'string') return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFERENCES };
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      projectContinuity: parsed.projectContinuity !== false,
      designCanvasEnabled: parsed.designCanvasEnabled === true,
      avatarUpdatedAt:
        typeof parsed.avatarUpdatedAt === 'string' && parsed.avatarUpdatedAt.trim()
          ? parsed.avatarUpdatedAt
          : null,
      fileStorage: normalizeFileStorage(parsed.fileStorage),
      hubFavorites: normalizeHubFavorites(parsed.hubFavorites),
      workbenchTour: normalizeWorkbenchTour(parsed.workbenchTour),
      workbenchNextDismiss:
        parsed.workbenchNextDismiss && typeof parsed.workbenchNextDismiss === 'object'
          ? parsed.workbenchNextDismiss
          : {},
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function normalizeWorkbenchTour(raw) {
  if (!raw || typeof raw !== 'object') {
    return { v1: { completedAt: null, skipped: false } };
  }
  const v1 = raw.v1 && typeof raw.v1 === 'object' ? raw.v1 : {};
  return {
    v1: {
      completedAt: typeof v1.completedAt === 'string' ? v1.completedAt : null,
      skipped: v1.skipped === true,
    },
  };
}

export async function getUserPreferences(userId) {
  if (!userId) return { ...DEFAULT_PREFERENCES };
  const db = await getControlDriver();
  const row = await db.queryOne('SELECT preferences_json FROM users WHERE id = ?', [userId]);
  return parsePreferencesJson(row?.preferences_json);
}

export async function getUserProjectContinuityEnabled(userId) {
  const prefs = await getUserPreferences(userId);
  return prefs.projectContinuity !== false;
}

export async function updateUserPreferences(userId, partial) {
  const current = await getUserPreferences(userId);
  const next = {
    ...current,
    ...(partial && typeof partial === 'object' ? partial : {}),
  };
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'projectContinuity')) {
    next.projectContinuity = partial.projectContinuity !== false;
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'avatarUpdatedAt')) {
    next.avatarUpdatedAt =
      typeof partial.avatarUpdatedAt === 'string' && partial.avatarUpdatedAt.trim()
        ? partial.avatarUpdatedAt
        : null;
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'designCanvasEnabled')) {
    next.designCanvasEnabled = partial.designCanvasEnabled === true;
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'fileStorage')) {
    next.fileStorage = normalizeFileStorage({
      ...current.fileStorage,
      ...(partial.fileStorage && typeof partial.fileStorage === 'object' ? partial.fileStorage : {}),
    });
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'hubFavorites')) {
    next.hubFavorites = normalizeHubFavorites(partial.hubFavorites);
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'workbenchTour')) {
    next.workbenchTour = normalizeWorkbenchTour(partial.workbenchTour);
  }
  if (partial && Object.prototype.hasOwnProperty.call(partial, 'workbenchNextDismiss')) {
    next.workbenchNextDismiss =
      partial.workbenchNextDismiss && typeof partial.workbenchNextDismiss === 'object'
        ? { ...current.workbenchNextDismiss, ...partial.workbenchNextDismiss }
        : current.workbenchNextDismiss;
  }
  const db = await getControlDriver();
  await db.execute('UPDATE users SET preferences_json = ? WHERE id = ?', [JSON.stringify(next), userId]);
  return next;
}
