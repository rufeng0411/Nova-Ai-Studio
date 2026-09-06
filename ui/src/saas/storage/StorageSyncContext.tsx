/**
 * PD-SAAS-FORK: post-login cloud hub provision (Phase 2 — no sync polling).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useAuth } from '../../components/auth/context/AuthContext';
import { saasApi } from '../api/saasApi';
import {
  dispatchStorageReconcileDone,
  hasStorageReconcileRun,
  markStorageReconcileRun,
} from './postLoginReconcile';

type StorageSyncContextValue = {
  syncingProjectIds: ReadonlySet<string>;
  isProjectSyncing: (_projectId: string) => boolean;
  notifySyncStarted: () => void;
};

const StorageSyncContext = createContext<StorageSyncContextValue | null>(null);

const EMPTY = new Set<string>();

export function StorageSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const reconcileStartedRef = useRef(false);

  const runPostLoginReconcile = useCallback(async () => {
    try {
      const response = await saasApi.reconcileStorage();
      const result = (await response.json().catch(() => null)) as { changed?: boolean; provisioned?: number } | null;
      // PD-SAAS-FORK: avoid a second /api/projects fetch when reconcile made no storage changes.
      if (result?.changed || Number(result?.provisioned ?? 0) > 0) {
        window.refreshProjects?.();
      } else {
        // Safety net: if the first login fetch raced gateway startup, retry once after reconcile.
        window.setTimeout(() => {
          window.refreshProjects?.();
        }, 1500);
      }
      dispatchStorageReconcileDone();
    } catch {
      window.setTimeout(() => {
        window.refreshProjects?.();
      }, 1500);
      // silent — login must not block on reconcile
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      reconcileStartedRef.current = false;
      return;
    }
    if (reconcileStartedRef.current || hasStorageReconcileRun(user.id)) return;
    reconcileStartedRef.current = true;
    markStorageReconcileRun(user.id);
    void runPostLoginReconcile();
  }, [user?.id, runPostLoginReconcile]);

  const value = useMemo<StorageSyncContextValue>(
    () => ({
      syncingProjectIds: EMPTY,
      isProjectSyncing: () => false,
      notifySyncStarted: () => {},
    }),
    [],
  );

  return <StorageSyncContext.Provider value={value}>{children}</StorageSyncContext.Provider>;
}

export function useStorageSync(_projectId?: string) {
  const ctx = useContext(StorageSyncContext);
  return {
    syncing: false,
    isProjectSyncing: ctx?.isProjectSyncing ?? (() => false),
    notifySyncStarted: ctx?.notifySyncStarted ?? (() => {}),
  };
}

export function dispatchStorageSyncStart() {
  /* no-op in cloud-only mode */
}
