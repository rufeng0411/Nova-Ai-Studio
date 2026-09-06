// PD-SAAS-FORK: user-facing blocker notice card (muted, non-red)
import { useTranslation } from 'react-i18next';
import GentleNotice from '../chat/shared/GentleNotice';
export type UserActionRequiredCardProps = {
  title: string;
  reason: string;
  steps: string[];
  settingsDeepLink?: string;
  confirmedAttempts?: number;
  onOpenSettings?: () => void;
};

export function UserActionRequiredCard({
  title,
  reason,
  steps,
  settingsDeepLink,
  confirmedAttempts,
  onOpenSettings,
}: UserActionRequiredCardProps) {
  const { t } = useTranslation('chat');
  return (
    <GentleNotice severity="pause" title={title}>
      <p className="text-sm text-muted-foreground mb-2">{reason}</p>
      {typeof confirmedAttempts === 'number' && confirmedAttempts >= 3 ? (
        <p className="text-xs text-muted-foreground mb-2">
          {t('userActionRequired.confirmedAfterThree', {
            defaultValue: '同一问题已确认 3 次，请按下列步骤处理后再继续',
          })}
        </p>
      ) : null}
      <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {settingsDeepLink && onOpenSettings ? (
        <button
          type="button"
          className="mt-2 text-sm text-primary hover:underline"
          onClick={onOpenSettings}
        >
          {t('userActionRequired.openSettings', { defaultValue: '前往设置' })}
        </button>
      ) : null}
    </GentleNotice>
  );
}

export default UserActionRequiredCard;
