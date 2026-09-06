/**
 * PD-SAAS-FORK: per-folder cloud sync status + action (file tree bottom bar).
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/app';
import { saasApi, type SyncNowResponse } from '../api/saasApi';
import CloudSyncPulse from './CloudSyncPulse';
import { dispatchStorageSyncStart, useStorageSync } from './StorageSyncContext';
import { formatSyncTimestamp, resolveSyncFeedback } from './syncDisplayUtils';
import { cn } from '../../lib/utils.js';

type FolderSyncFooterProps = {
  project: Project | null;
};

export default function FolderSyncFooter({ project }: FolderSyncFooterProps) {
  const { t, i18n } = useTranslation(['common', 'settings']);
  const [cloudSyncOn, setCloudSyncOn] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(
    null,
  );

  const projectSyncing = useStorageSync(project?.name ?? null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await saasApi.storageStatus();
      if (!res.ok) return;
      const payload = await res.json();
      setCloudSyncOn(payload?.fileStorage?.syncLocalToCloud !== false);
      setLastSyncedAt(
        typeof payload?.lastSyncedAt === 'string'
          ? payload.lastSyncedAt
          : payload?.fileStorage?.lastSyncedAt ?? null,
      );
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [project?.name, refreshStatus]);

  const onSyncNow = async () => {
    if (!project?.name) return;
    setSyncing(true);
    setSyncFeedback(null);
    dispatchStorageSyncStart();
    try {
      const res = await saasApi.syncStorageNow(project.name);
      let payload: SyncNowResponse | null = null;
      if (res.ok) {
        payload = (await res.json()) as SyncNowResponse;
      }
      await refreshStatus();
      const feedback = resolveSyncFeedback(payload, (key) => t(key, { ns: 'settings' }));
      if (feedback.kind !== 'ok') {
        setSyncFeedback(feedback);
      }
    } catch {
      setSyncFeedback({
        kind: 'err',
        text: t('fileStorage.cloudSync.syncFailed', { ns: 'settings' }),
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!project || !cloudSyncOn) {
    return null;
  }

  const busy = syncing || projectSyncing;
  const timeLabel = lastSyncedAt ? formatSyncTimestamp(lastSyncedAt, i18n.language) : null;
  const syncTitle = t('fileTree.sync.syncNow');

  return (
    <div className="shrink-0 border-t border-border bg-muted/20 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {busy ? (
            <CloudSyncPulse />
          ) : lastSyncedAt ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          ) : (
            <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          )}
          {timeLabel ? (
            <time
              dateTime={lastSyncedAt ?? undefined}
              className="truncate font-mono text-[11px] text-muted-foreground"
              title={syncTitle}
            >
              {timeLabel}
            </time>
          ) : (
            <CloudOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} aria-hidden />
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSyncNow()}
          title={busy ? t('fileTree.sync.syncing') : syncTitle}
          aria-label={busy ? t('fileTree.sync.syncing') : syncTitle}
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition',
            'hover:bg-muted disabled:opacity-50',
          )}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} strokeWidth={1.75} />
        </button>
      </div>
      {syncFeedback ? (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{syncFeedback.text}</p>
      ) : null}
    </div>
  );
}
