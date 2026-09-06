/**
 * PD-SAAS-FORK: shared cloud sync timestamp + result messaging.
 */
import type { SyncNowResponse } from '../api/saasApi';

/** Server stores UTC ISO; show in the user's locale with second precision. */
export function formatSyncTimestamp(iso: string, locale: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function resolveSyncFeedback(
  payload: SyncNowResponse | null,
  t: (key: string) => string,
): { kind: 'ok' | 'warn' | 'err'; text: string } {
  if (!payload) {
    return { kind: 'err', text: t('fileStorage.cloudSync.syncFailed') };
  }
  if (Array.isArray(payload.results)) {
    const results = payload.results;
    if (results.length === 0) {
      return { kind: 'warn', text: t('fileStorage.cloudSync.syncNone') };
    }
    const succeeded = results.filter((row) => row.ok);
    if (succeeded.length === results.length) {
      return { kind: 'ok', text: t('fileStorage.cloudSync.syncSuccess') };
    }
    if (succeeded.length > 0) {
      return { kind: 'warn', text: t('fileStorage.cloudSync.syncPartial') };
    }
    return { kind: 'err', text: t('fileStorage.cloudSync.syncFailed') };
  }
  if (payload.ok === true) {
    return { kind: 'ok', text: t('fileStorage.cloudSync.syncSuccess') };
  }
  return { kind: 'err', text: t('fileStorage.cloudSync.syncFailed') };
}
