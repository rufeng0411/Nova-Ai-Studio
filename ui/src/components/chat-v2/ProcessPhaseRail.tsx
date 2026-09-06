// PD-SAAS-FORK: macro phase checklist during assistant runs
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProcessPhaseId } from '../../shared/processNarrative';

const PHASE_ORDER: ProcessPhaseId[] = [
  'understand',
  'gather',
  'analyze',
  'produce',
  'deliver',
];

type ProcessPhaseRailProps = {
  currentPhase: ProcessPhaseId;
  className?: string;
};

function phaseIndex(phase: ProcessPhaseId): number {
  return PHASE_ORDER.indexOf(phase);
}

export function ProcessPhaseRail({ currentPhase, className = '' }: ProcessPhaseRailProps) {
  const { t } = useTranslation('chat');
  const currentIndex = phaseIndex(currentPhase);

  const labelFor = (phase: ProcessPhaseId) => {
    switch (phase) {
      case 'understand':
        return t('process.phase.understand', { defaultValue: '理解需求' });
      case 'gather':
        return t('process.phase.gather', { defaultValue: '搜集资料' });
      case 'analyze':
        return t('process.phase.analyze', { defaultValue: '分析整理' });
      case 'produce':
        return t('process.phase.produce', { defaultValue: '生成成果' });
      case 'deliver':
        return t('process.phase.deliver', { defaultValue: '自检成果' });
      default: {
        const _exhaustive: never = phase;
        return _exhaustive;
      }
    }
  };

  return (
    <div
      role="list"
      aria-label={t('process.phase.railLabel', { defaultValue: '任务阶段' })}
      className={`mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-muted-foreground ${className}`.trim()}
      data-testid="process-phase-rail"
    >
      {PHASE_ORDER.map((phase, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div
            key={phase}
            role="listitem"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-[color,background-color,border-color] duration-200 ${
              isCurrent
                ? 'border-border/60 bg-muted/30 text-muted-foreground'
                : isDone
                  ? 'border-border/50 bg-muted/25 text-muted-foreground'
                  : 'border-transparent text-muted-foreground/50'
            }`}
            data-phase={phase}
            data-state={isCurrent ? 'current' : isDone ? 'done' : 'pending'}
          >
            {isDone ? (
              <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={2.2} />
            ) : isCurrent ? (
              <span className="relative inline-flex h-3 w-3 shrink-0 items-center justify-center">
                <span className="relative h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              </span>
            ) : (
              <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-muted-foreground/30" />
            )}
            <span>{labelFor(phase)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default ProcessPhaseRail;
