// PD-SAAS-FORK: read-only reasoning + process replay after turn completes
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProcessAttachment } from './processGrouping';
import { isThinkingStep, mergeProcessSteps } from './mergeProcessSteps';
import type { ProcessTraceStep } from './ProcessTrace';

type ProcessWorkReplayProps = {
  processAttachments: ProcessAttachment[];
  className?: string;
};

export function ProcessWorkReplay({ processAttachments, className = '' }: ProcessWorkReplayProps) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);

  const steps = useMemo(
    () => mergeProcessSteps(processAttachments, t),
    [processAttachments, t],
  );

  if (steps.length === 0) {
    return null;
  }

  const thinkingCount = steps.filter(isThinkingStep).length;

  return (
    <div
      className={`mt-2 rounded-xl border border-border/70 bg-muted/15 ${className}`.trim()}
      data-testid="process-work-replay"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        <span>{t('process.replay.title', { defaultValue: '推理与过程回放' })}</span>
      </button>
      {expanded ? (
        <ol className="list-none space-y-1.5 border-t border-border/60 px-3 py-2 text-[12px] text-muted-foreground">
          {steps.map((step, index) => {
            const thinking = isThinkingStep(step);
            return (
              <li
                key={step.id ? `${step.id}-${index}` : `step-${index}`}
                className={`flex gap-2 ${thinking ? 'rounded-md bg-muted/30 px-1.5 py-1' : ''}`}
              >
                <span className="min-w-0">
                  <span className={thinking ? 'italic text-foreground/85' : 'text-foreground'}>
                    {step.title}
                  </span>
                  {step.detail && step.detail !== step.title ? (
                    <span
                      className="mt-0.5 block text-muted-foreground line-clamp-2"
                      title={step.detail}
                    >
                      {step.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : thinkingCount > 0 ? (
        <p className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          {t('process.replay.thinkingHint', {
            defaultValue: '展开可回看推理摘要',
          })}
        </p>
      ) : null}
    </div>
  );
}

export default ProcessWorkReplay;
