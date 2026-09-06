/**
 * PD-SAAS-FORK: session-scoped flag so login reconcile runs once per browser session.
 */
export const STORAGE_RECONCILE_SESSION_PREFIX = 'saas-storage-reconcile-';

export function storageReconcileSessionKey(userId: number | string): string {
  return `${STORAGE_RECONCILE_SESSION_PREFIX}${userId}`;
}

export function clearStorageReconcileSessionFlags(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(STORAGE_RECONCILE_SESSION_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }
}

export function hasStorageReconcileRun(userId: number | string): boolean {
  try {
    return sessionStorage.getItem(storageReconcileSessionKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function markStorageReconcileRun(userId: number | string): void {
  try {
    sessionStorage.setItem(storageReconcileSessionKey(userId), '1');
  } catch {
    // ignore
  }
}

export const STORAGE_RECONCILE_DONE = 'saas-storage-reconcile-done';

export function dispatchStorageReconcileDone(): void {
  window.dispatchEvent(new CustomEvent(STORAGE_RECONCILE_DONE));
}
