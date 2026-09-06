// PD-SAAS-FORK: weak quality hint — does not trigger engine repair.
import { useTranslation } from 'react-i18next';
import {
  resolveDeliverableQualityHint,
  type DeliverableQualityHint,
} from '../../../shared/deliverableQualityHints';

type DeliverableQualityHintNoticeProps = {
  filePath: string;
  previewFailed?: boolean;
  openFailed?: boolean;
  className?: string;
};

function hintMessage(
  hint: DeliverableQualityHint,
  t: (key: string, options?: { defaultValue?: string }) => string,
): string {
  return t(hint.messageKey, { defaultValue: hint.defaultMessage });
}

export default function DeliverableQualityHintNotice({
  filePath,
  previewFailed = false,
  openFailed = false,
  className = '',
}: DeliverableQualityHintNoticeProps) {
  const { t } = useTranslation('chat');
  const hint = resolveDeliverableQualityHint(filePath, { previewFailed, openFailed });
  if (!hint) return null;

  return (
    <p className={`text-[12px] leading-relaxed text-muted-foreground ${className}`.trim()}>
      {hintMessage(hint, t)}
    </p>
  );
}
