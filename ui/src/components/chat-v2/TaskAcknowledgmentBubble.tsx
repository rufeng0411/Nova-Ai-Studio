// PD-SAAS-FORK: instant acknowledgment while the model's first thinking turn is slow
import { useTranslation } from 'react-i18next';
import { buildTaskAcknowledgmentMessage } from '../../shared/buildTaskAcknowledgmentCopy';
import { TEXT_INFORMAL } from './conversationSurfaceTokens';

type TaskAcknowledgmentBubbleProps = {
  className?: string;
};

export function TaskAcknowledgmentBubble({ className = '' }: TaskAcknowledgmentBubbleProps) {
  const { t, i18n } = useTranslation('chat');
  const localeIsZh = i18n.language?.startsWith('zh') ?? true;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="task-acknowledgment"
      className={`min-w-0 ${TEXT_INFORMAL} ${className}`.trim()}
    >
      {t('taskAcknowledgment.message', {
        defaultValue: buildTaskAcknowledgmentMessage(localeIsZh),
      })}
    </div>
  );
}
