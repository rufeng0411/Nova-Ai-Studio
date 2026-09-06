/**
 * PD-SAAS-FORK: inline pulse placeholder during cold session message load.
 */
import { useTranslation } from 'react-i18next';

export function SessionMessagesLoadingPlaceholder() {
  const { t } = useTranslation('chat');

  return (
    <div
      className="mx-auto max-w-[936px] px-4 pt-7"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="sr-only">
        {t('session.loadingConversation', { defaultValue: 'Loading conversation…' })}
      </p>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-[72%] animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-[58%] animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-[64%] animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-[48%] animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
