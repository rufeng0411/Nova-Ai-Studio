// PD-SAAS-FORK: collapsed activity aggregate row under process timeline
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../chat/types/types';
import type { ProcessActivityCounts } from '../../shared/processTimelineBuilder';
import { INFORMAL_PROCESS } from './processVisualTokens';

type ProcessActivitySummaryProps = {
  counts: ProcessActivityCounts;
  processDetailLevel?: 'minimal' | 'standard' | 'detailed';
  /** Optional raw messages for detailed drill-down labels */
  messages?: ChatMessage[];
  className?: string;
};

export function ProcessActivitySummary({
  counts,
  processDetailLevel = 'standard',
  className = '',
}: ProcessActivitySummaryProps) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);

  const parts: string[] = [];
  if (counts.readCount > 0) {
    parts.push(
      t('process.activity.read', {
        count: counts.readCount,
        defaultValue: '已探索 {{count}} 个文件',
      }),
    );
  }
  if (counts.commandCount > 0) {
    parts.push(
      t('process.activity.command', {
        count: counts.commandCount,
        defaultValue: '已运行 {{count}} 条命令',
      }),
    );
  }
  if (counts.editCount > 0) {
    parts.push(
      t('process.activity.edit', {
        count: counts.editCount,
        defaultValue: '已编辑 {{count}} 个文件',
      }),
    );
  }
  if (counts.searchCount > 0) {
    parts.push(
      t('process.activity.search', {
        count: counts.searchCount,
        defaultValue: '已搜索 {{count}} 次',
      }),
    );
  }

  if (parts.length === 0) return null;

  const summary = parts.join(' · ');

  return (
    <div
      className={`${INFORMAL_PROCESS.fontSize} ${className}`.trim()}
      data-testid="process-activity-summary"
    >
      <button
        type="button"
        aria-expanded={expanded}
        className="inline-flex items-center gap-1 text-muted-foreground/80 hover:text-muted-foreground"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2} />
        )}
        <span>{summary}</span>
      </button>
      {expanded && processDetailLevel === 'detailed' ? (
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {t('process.activity.detailedHint', {
            defaultValue: '详细工具参数可在完成后展开过程步骤中查看。',
          })}
        </p>
      ) : null}
    </div>
  );
}

export default ProcessActivitySummary;
