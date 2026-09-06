/**
 * PD-SAAS-FORK: UI-only session sidebar flags (task complete + lock).
 * Disk session ids stay unchanged; flags live in localStorage keyed by normalized session id.
 */
import { useEffect, useState } from 'react';
import {
  clearSessionSidebarState,
  getSessionSidebarFlags,
  isSessionSidebarCompleted,
  isSessionSidebarLocked,
  isSessionSidebarRevokedAutoComplete,
  SESSION_SIDEBAR_STATE_CHANGE_EVENT,
  SESSION_SIDEBAR_UNMARK_FOCUS_EVENT,
  SESSION_SIDEBAR_STATE_STORAGE_KEY,
  setSessionSidebarCompleted,
  setSessionSidebarLocked,
  setSessionSidebarRevokedAutoComplete,
  toggleSessionSidebarCompleted,
  toggleSessionSidebarLocked,
} from '../../shared/sessionSidebarState.mjs';

export type SessionSidebarFlags = {
  completed?: boolean;
  locked?: boolean;
  revokedAutoComplete?: boolean;
};

export {
  clearSessionSidebarState,
  getSessionSidebarFlags,
  isSessionSidebarCompleted,
  isSessionSidebarLocked,
  isSessionSidebarRevokedAutoComplete,
  SESSION_SIDEBAR_STATE_CHANGE_EVENT,
  SESSION_SIDEBAR_UNMARK_FOCUS_EVENT,
  SESSION_SIDEBAR_STATE_STORAGE_KEY,
  setSessionSidebarCompleted,
  setSessionSidebarLocked,
  setSessionSidebarRevokedAutoComplete,
  toggleSessionSidebarCompleted,
  toggleSessionSidebarLocked,
};

export function useSessionSidebarStateVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_SIDEBAR_STATE_STORAGE_KEY) bump();
    };
    window.addEventListener(SESSION_SIDEBAR_STATE_CHANGE_EVENT, bump);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_SIDEBAR_STATE_CHANGE_EVENT, bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return version;
}
