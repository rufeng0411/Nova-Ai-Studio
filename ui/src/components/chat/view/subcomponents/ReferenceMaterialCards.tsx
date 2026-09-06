// PD-SAAS-FORK: uploaded files and @ references share the same reference-material cards
import { FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChatAttachment } from '../../types/types';
import {
  getAttachmentAccent,
  getAttachmentTypeLabel,
} from '../../../../shared/referenceMaterials';
import { cn } from '../../../../lib/utils';

export type ReferenceMaterialCardsProps = {
  attachments: ChatAttachment[];
  onRemove?: (path: string) => void;
  className?: string;
  cardClassName?: string;
};

export default function ReferenceMaterialCards({
  attachments,
  onRemove,
  className,
  cardClassName,
}: ReferenceMaterialCardsProps) {
  const { t } = useTranslation('chat');

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid grid-cols-1 gap-2', className)}>
      {attachments.map((attachment, index) => {
        const path = attachment.path || attachment.name;
        const removeKey = attachment.path || attachment.name;
        return (
          <div
            key={`${attachment.name || 'reference'}-${path}-${index}`}
            aria-label={path}
            className={cn(
              'group/card relative flex min-w-0 items-center gap-3 rounded-2xl bg-card/90 p-2.5 pr-3 text-foreground',
              cardClassName,
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                getAttachmentAccent(attachment.name, attachment.mimeType),
              )}
            >
              <FileText className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13px] font-semibold">{attachment.name}</div>
              <div className="mt-0.5 text-[11px] font-medium uppercase text-muted-foreground">
                {getAttachmentTypeLabel(attachment.name, attachment.mimeType)}
              </div>
            </div>
            {onRemove && removeKey ? (
              <button
                type="button"
                aria-label={t('input.fileReference.remove', {
                  name: attachment.name,
                  defaultValue: `Remove reference ${attachment.name}`,
                })}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover/card:opacity-100"
                onClick={() => onRemove(removeKey)}
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
