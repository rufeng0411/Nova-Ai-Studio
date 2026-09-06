/**
 * PD-SAAS-FORK: gentle empty state when workspaces live on another device.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saasApi, type StorageStatusResponse } from '../api/saasApi';

type Props = {
  onOpenSettings?: () => void;
};

export default function StorageEmptyHint({ onOpenSettings }: Props) {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<StorageStatusResponse | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await saasApi.storageStatus();
        if (!res.ok || !alive) return;
        setStatus((await res.json()) as StorageStatusResponse);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!status?.storageHint || status.storageHint === 'no_workspaces') {
    return null;
  }

  const messageKey =
    status.storageHint === 'local_other_device'
      ? 'fileStorage.empty.otherDevice'
      : 'fileStorage.empty.generic';

  return (
    <div
      className="mx-4 mb-3 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
      data-testid="storage-empty-hint"
    >
      <p>{t(messageKey)}</p>
      {onOpenSettings ? (
        <button
          type="button"
          className="mt-2 text-xs font-medium text-primary hover:underline"
          onClick={onOpenSettings}
        >
          {t('fileStorage.empty.openSettings')}
        </button>
      ) : null}
    </div>
  );
}
