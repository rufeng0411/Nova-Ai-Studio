// PD-SAAS-FORK: T0 informal process stack — muted, left-rail, default collapsed
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import type { Project } from '../../types/app';
import type { DeliverableItem } from '../../shared/collectDeliverables';
import { getArtifactFileName } from '../../shared/artifactPaths';
import type { ProcessAttachment } from './processGrouping';
import { INFORMAL_PROCESS } from './processVisualTokens';
import { mergeProcessSteps } from './mergeProcessSteps';
import { ProcessTimeline } from './ProcessTimeline';

export type TurnRunMeta = {
  durationMs: number;
  stepCount: number;
};

type InformalProcessStackProps = {
  attachments: ProcessAttachment[];
  processArtifacts?: DeliverableItem[];
  runMeta?: TurnRunMeta | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  isRunning?: boolean;
  hasDeliverables?: boolean;
  processDetailLevel?: 'minimal' | 'standard' | 'detailed';
  renderDetail?: (attachment: ProcessAttachment) => ReactNode;
  selectedProject?: Project | null;
  onFileOpen?: (filePath: string) => void;
  className?: string;
};

export function ProcessArtifactStrip({
  items,
  onFileOpen,
  className = '',
}: {
  items: DeliverableItem[];
  onFileOpen?: (filePath: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={`${INFORMAL_PROCESS.artifactStrip} ${className}`.trim()}
      data-testid="process-artifact-strip"
    >
      {items.map((item) => {
        const name = getArtifactFileName(item.apiPath || item.path);
        const clickable = item.kind !== 'url' && Boolean(onFileOpen);
        const body = (
          <>
            <span className="truncate">{name}</span>
          </>
        );
        if (!clickable) {
          return (
            <span key={item.id} className={INFORMAL_PROCESS.artifactChip}>
              {body}
            </span>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={`${INFORMAL_PROCESS.artifactChip} hover:bg-muted/35`}
            onClick={() => onFileOpen?.(item.apiPath || item.path)}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

export function InformalProcessStack({
  attachments,
  processArtifacts = [],
  runMeta,
  expanded,
  onExpandedChange,
  isRunning = false,
  hasDeliverables = false,
  processDetailLevel = 'standard',
  renderDetail,
  onFileOpen,
  className = '',
}: InformalProcessStackProps) {
  const { t } = useTranslation('chat');
  const localeIsZh = i18n.language?.startsWith('zh') ?? true;

  const steps = useMemo(
    () => mergeProcessSteps(attachments, t, { processDetailLevel, localeIsZh }),
    [attachments, localeIsZh, processDetailLevel, t],
  );

  if (steps.length === 0 && !runMeta) {
    return null;
  }

  const minimalLocked = processDetailLevel === 'minimal' && hasDeliverables;
  const canExpand = !minimalLocked && (steps.length > 0 || Boolean(renderDetail));

  return (
    <div data-testid="informal-process-stack">
    <ProcessTimeline
      mode="completed"
      steps={steps}
      isRunning={isRunning}
      expanded={expanded && canExpand}
      onExpandedChange={(next) => {
        if (canExpand) onExpandedChange(next);
      }}
      durationMs={runMeta?.durationMs ?? null}
      processDetailLevel={processDetailLevel}
      showActivitySummary={false}
      headerCollapsible={canExpand}
      className={className}
    >
      {expanded && canExpand
        ? attachments.map((attachment) => (
            <div key={attachment.id} className="mt-2 space-y-1">
              {renderDetail ? renderDetail(attachment) : null}
            </div>
          ))
        : null}
      {expanded && canExpand ? (
        <ProcessArtifactStrip items={processArtifacts} onFileOpen={onFileOpen} />
      ) : null}
    </ProcessTimeline>
    </div>
  );
}

export default InformalProcessStack;
