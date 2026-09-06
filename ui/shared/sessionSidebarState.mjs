// PD-SAAS-FORK: per-session sidebar flags (completed + locked), UI-only overlay keyed by session id

export const SESSION_SIDEBAR_STATE_STORAGE_KEY = 'pilotdeck:sessionSidebarState';
export const SESSION_SIDEBAR_STATE_CHANGE_EVENT = 'sessionsidebarstate:changed';
/** Fired after user「取消任务完成」— ChatInterface focuses composer, no auto-continue. */
export const SESSION_SIDEBAR_UNMARK_FOCUS_EVENT = 'pilotdeck:session-unmark-focus';

/** @typedef {{ completed?: boolean; locked?: boolean; revokedAutoComplete?: boolean }} SessionSidebarFlags */

/** @param {unknown} value */
export function normalizeSessionIdKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^web:s_/, 'web-s_');
}

/** @returns {Record<string, SessionSidebarFlags>} */
export function emptySessionSidebarStateMap() {
  return {};
}

/** @param {unknown} raw */
export function normalizeSessionSidebarStateMap(raw) {
  if (!raw || typeof raw !== 'object') return emptySessionSidebarStateMap();
  /** @type {Record<string, SessionSidebarFlags>} */
  const next = {};
  for (const [key, value] of Object.entries(raw)) {
    const sessionKey = normalizeSessionIdKey(key);
    if (!sessionKey || !value || typeof value !== 'object') continue;
    const completed = value.completed === true;
    const locked = value.locked === true;
    const revokedAutoComplete = value.revokedAutoComplete === true;
    if (!completed && !locked && !revokedAutoComplete) continue;
    next[sessionKey] = {
      ...(completed ? { completed: true } : {}),
      ...(locked ? { locked: true } : {}),
      ...(revokedAutoComplete ? { revokedAutoComplete: true } : {}),
    };
  }
  return next;
}

/** @param {string} sessionId */
export function getSessionSidebarFlags(sessionId) {
  const key = normalizeSessionIdKey(sessionId);
  if (!key) return {};
  const map = readSessionSidebarStateMap();
  return map[key] ?? {};
}

/** @param {string} sessionId */
export function isSessionSidebarCompleted(sessionId) {
  return getSessionSidebarFlags(sessionId).completed === true;
}

/** @param {string} sessionId */
export function isSessionSidebarRevokedAutoComplete(sessionId) {
  return getSessionSidebarFlags(sessionId).revokedAutoComplete === true;
}

/** @param {string} sessionId */
export function isSessionSidebarLocked(sessionId) {
  return getSessionSidebarFlags(sessionId).locked === true;
}

/** @returns {Record<string, SessionSidebarFlags>} */
export function readSessionSidebarStateMap() {
  if (typeof localStorage === 'undefined') return emptySessionSidebarStateMap();
  try {
    const raw = localStorage.getItem(SESSION_SIDEBAR_STATE_STORAGE_KEY);
    if (!raw) return emptySessionSidebarStateMap();
    return normalizeSessionSidebarStateMap(JSON.parse(raw));
  } catch {
    return emptySessionSidebarStateMap();
  }
}

/** @param {Record<string, SessionSidebarFlags>} map */
export function writeSessionSidebarStateMap(map) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_SIDEBAR_STATE_STORAGE_KEY, JSON.stringify(map));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_SIDEBAR_STATE_CHANGE_EVENT));
  }
}

/** @param {string} sessionId @param {boolean} completed */
export function setSessionSidebarCompleted(sessionId, completed) {
  const key = normalizeSessionIdKey(sessionId);
  if (!key) return;
  const map = readSessionSidebarStateMap();
  const current = map[key] ?? {};
  if (completed) {
    const next = { ...current, completed: true };
    delete next.revokedAutoComplete;
    map[key] = next;
  } else {
    const next = { ...current };
    delete next.completed;
    if (!next.locked && !next.revokedAutoComplete) delete map[key];
    else map[key] = next;
  }
  writeSessionSidebarStateMap(map);
}

/** @param {string} sessionId @param {boolean} revoked */
export function setSessionSidebarRevokedAutoComplete(sessionId, revoked) {
  const key = normalizeSessionIdKey(sessionId);
  if (!key) return;
  const map = readSessionSidebarStateMap();
  const current = map[key] ?? {};
  if (revoked) {
    map[key] = { ...current, revokedAutoComplete: true };
  } else {
    const next = { ...current };
    delete next.revokedAutoComplete;
    if (!next.completed && !next.locked) delete map[key];
    else map[key] = next;
  }
  writeSessionSidebarStateMap(map);
}

/** @param {string} sessionId @param {boolean} locked */
export function setSessionSidebarLocked(sessionId, locked) {
  const key = normalizeSessionIdKey(sessionId);
  if (!key) return;
  const map = readSessionSidebarStateMap();
  const current = map[key] ?? {};
  if (locked) {
    map[key] = { ...current, locked: true };
  } else {
    const next = { ...current };
    delete next.locked;
    if (!next.completed && !next.revokedAutoComplete) delete map[key];
    else map[key] = next;
  }
  writeSessionSidebarStateMap(map);
}

/** @param {string} sessionId */
export function toggleSessionSidebarCompleted(sessionId) {
  const next = !isSessionSidebarCompleted(sessionId);
  if (next) {
    setSessionSidebarRevokedAutoComplete(sessionId, false);
  } else {
    setSessionSidebarRevokedAutoComplete(sessionId, true);
  }
  setSessionSidebarCompleted(sessionId, next);
  return next;
}

/** @param {string} sessionId */
export function toggleSessionSidebarLocked(sessionId) {
  const next = !isSessionSidebarLocked(sessionId);
  setSessionSidebarLocked(sessionId, next);
  return next;
}

/** @param {string} sessionId */
export function clearSessionSidebarState(sessionId) {
  const key = normalizeSessionIdKey(sessionId);
  if (!key) return;
  const map = readSessionSidebarStateMap();
  if (!map[key]) return;
  delete map[key];
  writeSessionSidebarStateMap(map);
}
