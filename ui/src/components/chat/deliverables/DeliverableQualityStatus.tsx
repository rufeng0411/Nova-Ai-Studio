// PD-SAAS-FORK P0-8: certificate-v2 final quality badge shared by Dock and summary.
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type {
  DeliverableCompletionStateUi,
  DeliverableQualityStatusUi,
} from '../../../shared/turnAcceptanceMeta';

type DeliverableQualityStatusProps = {
  status?: DeliverableQualityStatusUi | null;
  className?: string;
  /** PD-SAAS-FORK VAP P1: optional provenance counts for hover title. */
  provenance?: {
    officialEntries?: number;
    placeholderCount?: number;
  } | null;
};

type QualityPresentation = {
  labelKey:
    | 'deliverables.qualityStatus.complete'
    | 'deliverables.qualityStatus.contentPassedAligning'
    | 'deliverables.qualityStatus.officialMediaDegraded'
    | 'deliverables.qualityStatus.userAcknowledged'
    | 'deliverables.qualityStatus.blocked'
    | 'deliverables.qualityStatus.needsRepair'
    | 'deliverables.qualityStatus.notApplicable';
  defaultValue: string;
  tone: 'success' | 'muted' | 'warning';
};

function presentationForStatus(status: DeliverableQualityStatusUi): QualityPresentation {
  if (
    status.qualityCompletion === 'passed'
    && status.completionState === 'incomplete'
  ) {
    return {
      labelKey: 'deliverables.qualityStatus.contentPassedAligning',
      defaultValue: '内容已通过 · 清单对齐中',
      tone: 'warning',
    };
  }
  switch (status.completionState) {
    case 'complete':
      return status.qualityCompletion === 'not_applicable'
        ? {
            labelKey: 'deliverables.qualityStatus.notApplicable',
            defaultValue: '质量检查不适用',
            tone: 'muted',
          }
        : {
            labelKey: 'deliverables.qualityStatus.complete',
            defaultValue: '质量验收通过',
            tone: 'success',
          };
    case 'accepted_partial':
      if (status.partialReason === 'official_media_degraded') {
        return {
          labelKey: 'deliverables.qualityStatus.officialMediaDegraded',
          defaultValue: '已接受部分成果 · 官方素材已降级',
          tone: 'warning',
        };
      }
      if (status.partialReason === 'user_acknowledged') {
        return {
          labelKey: 'deliverables.qualityStatus.userAcknowledged',
          defaultValue: '已按您的确认验收',
          tone: 'muted',
        };
      }
      return {
        labelKey: 'deliverables.qualityStatus.needsRepair',
        defaultValue: '质量仍需完善',
        tone: 'warning',
      };
    case 'incomplete':
      return {
        labelKey: 'deliverables.qualityStatus.needsRepair',
        defaultValue: '质量仍需完善',
        tone: 'warning',
      };
    case 'blocked':
      return {
        labelKey: 'deliverables.qualityStatus.blocked',
        defaultValue: '质量验收受阻',
        tone: 'warning',
      };
    default: {
      const exhaustive: never = status.completionState;
      return exhaustive;
    }
  }
}

export function completionStateDataValue(
  completionState: DeliverableCompletionStateUi,
): DeliverableCompletionStateUi {
  return completionState;
}

export default function DeliverableQualityStatus({
  status,
  className,
  provenance,
}: DeliverableQualityStatusProps) {
  const { t } = useTranslation('chat');
  if (!status) return null;
  const presentation = presentationForStatus(status);
  const label = t(presentation.labelKey, { defaultValue: presentation.defaultValue });
  const officialEntries = provenance?.officialEntries;
  const placeholderCount = provenance?.placeholderCount;
  const provenanceHint = [
    typeof officialEntries === 'number' && officialEntries > 0
      ? t('deliverables.qualityStatus.officialAssets', {
          defaultValue: '官方素材 {{count}}',
          count: officialEntries,
        })
      : null,
    typeof placeholderCount === 'number' && placeholderCount > 0
      ? t('deliverables.qualityStatus.placeholders', {
          defaultValue: '占位图 {{count}}',
          count: placeholderCount,
        })
      : null,
  ].filter(Boolean).join(' · ');
  const title = provenanceHint ? `${label} · ${provenanceHint}` : label;

  return (
    <div
      data-testid="deliverable-quality-status"
      data-deliverable-completion-state={completionStateDataValue(status.completionState)}
      data-deliverable-quality-completion={status.qualityCompletion}
      data-official-asset-count={typeof officialEntries === 'number' ? officialEntries : undefined}
      data-placeholder-count={typeof placeholderCount === 'number' ? placeholderCount : undefined}
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2 py-1 text-[11px] font-medium',
        presentation.tone === 'success'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : presentation.tone === 'warning'
            ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300'
            : 'bg-muted text-muted-foreground',
        className,
      )}
      title={title}
    >
      <span className="truncate">{label}</span>
    </div>
  );
}
