// PD-SAAS-FORK: unified T0 left-rail process timeline (live + completed)
import { ChevronDown, ChevronRight, CheckCircle2, ListTree, Loader2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProcessTraceStep } from './ProcessTrace';
import { INFORMAL_PROCESS } from './processVisualTokens';
import { isThinkingStep } from './mergeProcessSteps';
import { formatProcessDuration } from './processTraceUtils';
import { ProcessActivitySummary } from './ProcessActivitySummary';
import type { ProcessActivityCounts } from '../../shared/processTimelineBuilder';
import { ProcessTimelineLiveViewport } from './ProcessTimelineLiveViewport';

export type TurnRunMeta = {
  durationMs: number;
  stepCount: number;
};

export type ProcessTimelineMode = 'live' | 'completed';

export type ProcessTimelineProps = {
  mode: ProcessTimelineMode;
  steps: ProcessTraceStep[];
  maxVisibleSteps?: number;
  isRunning?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  durationMs?: number | null;
  activityCounts?: ProcessActivityCounts | null;
  processDetailLevel?: 'minimal' | 'standard' | 'detailed';
  headerOverride?: string;
  showActivitySummary?: boolean;
  /** When false, completed mode renders a non-interactive header (minimal lock). */
  headerCollapsible?: boolean;
  /** Live dock: hide duplicate「思考与制作中」header; parent shows elapsed status. */
  suppressLiveHeader?: boolean;
  /** Live expanded inline: top/bottom「收起过程」controls */
  showLiveCollapseTop?: boolean;
  showLiveCollapseBottom?: boolean;
  /** Disable nested live scrolling when the timeline is rendered in message flow. */
  useLiveScrollViewport?: boolean;
  children?: ReactNode;
  className?: string;
};

function isToolLikeStep(step: ProcessTraceStep): boolean {
  const kind = String(step.kind || '');
  const phase = String(step.phase || '');
  if (kind === 'thinking' || kind === 'recovery') return false;
  if (phase === 'permission' || phase === 'recovery') return false;
  return Boolean(
    phase === 'tool'
    || phase === 'rag'
    || phase === 'compact'
    || step.toolName
    || [
      'activity',
      'tool',
      'read',
      'search',
      'fetch',
      'edit',
      'command',
      'subagent',
      'compact',
      'local_search',
      'milestone',
    ].includes(kind),
  );
}

function formatStepTitle(
  step: ProcessTraceStep,
  t: ReturnType<typeof useTranslation<'chat'>>['t'],
): string {
  const title = step.title || t('process.step', { defaultValue: '步骤' });
  if (!isToolLikeStep(step)) return title;
  if (title.startsWith('使用工具：') || title.startsWith('Using tool:')) return title;
  return t('process.toolPrefix', {
    title,
    defaultValue: `使用工具：${title}`,
  });
}

function shouldHideStepDetail(step: ProcessTraceStep, displayTitle: string): boolean {
  const detail = String(step.detail || '').trim();
  if (!detail) return true;
  if (detail === step.title || detail === displayTitle) return true;
  return /^(?:session_prepare|plugin_refresh|mcp_ready|memory_retrieve|router_judge|stage_hint|recovery_pause|recovery_handling|infra_interrupt|deliverable_repair|acceptance_started|acceptance_completed|acceptance_failed)$/i.test(detail);
}

export function ProcessTimeline({
  mode,
  steps,
  maxVisibleSteps,
  isRunning = false,
  expanded,
  onExpandedChange,
  durationMs,
  activityCounts,
  processDetailLevel = 'standard',
  headerOverride,
  showActivitySummary = true,
  headerCollapsible = true,
  suppressLiveHeader = false,
  showLiveCollapseTop = false,
  showLiveCollapseBottom = false,
  useLiveScrollViewport: useLiveScrollViewportProp = true,
  children,
  className = '',
}: ProcessTimelineProps) {
  const { t } = useTranslation('chat');

  const durationLabel = durationMs != null ? formatProcessDuration(durationMs) : null;
  const thinkingCount = steps.filter(isThinkingStep).length;
  const showFullList = expanded || !maxVisibleSteps;
  const useLiveScrollViewport = useLiveScrollViewportProp && mode === 'live' && !showFullList && Boolean(maxVisibleSteps);

  const visibleSteps = useMemo(() => {
    if (useLiveScrollViewport || showFullList || steps.length <= (maxVisibleSteps ?? steps.length)) {
      return steps;
    }
    return steps.slice(-(maxVisibleSteps ?? INFORMAL_PROCESS.liveViewportMaxRows));
  }, [maxVisibleSteps, showFullList, steps, useLiveScrollViewport]);

  const liveViewportRows = maxVisibleSteps ?? INFORMAL_PROCESS.liveViewportMaxRows;
  const scrollAnchorKey = steps.length > 0
    ? `${steps[steps.length - 1]?.id ?? ''}:${steps[steps.length - 1]?.title ?? ''}:${steps[steps.length - 1]?.state ?? ''}`
    : '';

  const collapsedLabel = headerOverride ?? (isRunning
    ? t('process.informal.running', { defaultValue: '思考与制作中…' })
    : t('process.informal.collapsed', {
        duration: durationLabel || '',
        defaultValue: durationLabel
          ? '已完成 · {{duration}}'
          : '已完成',
      }));

  const showRail = mode === 'live' || expanded;
  const showLiveHeader = mode === 'live' && !suppressLiveHeader;
  const showCompletedHeader = mode === 'completed'
    && (steps.length > 0 || Boolean(children) || durationMs != null);
  const canToggleHeader = headerCollapsible
    && mode === 'completed'
    && (steps.length > 0 || Boolean(children) || durationMs != null);

  if (steps.length === 0 && !durationMs && !children) {
    return null;
  }

  const showExpandAll = Boolean(
    maxVisibleSteps && steps.length > maxVisibleSteps && !expanded && mode === 'live',
  );
  const collapseLabel = t('process.timeline.showLess', { defaultValue: '收起过程' });
  /** Live timeline: collapse only after the turn finishes — hide while thinking. */
  const showLiveCollapseControls = !(mode === 'live' && isRunning);
  const showCollapseTop = showLiveCollapseTop && showLiveCollapseControls;
  const showCollapseBottom = showLiveCollapseBottom && showLiveCollapseControls;

  const collapseButton = (className: string) => (
    <button
      type="button"
      className={className}
      onClick={() => onExpandedChange(false)}
    >
      {collapseLabel}
    </button>
  );

  const stepList = (
    <ol className={`list-none space-y-1 ${INFORMAL_PROCESS.stackGap}`} data-process-step-list>
      {visibleSteps.map((step, index) => {
        const thinking = isThinkingStep(step);
        const isCurrent = isRunning && index === visibleSteps.length - 1;
        const isCompleted = step.state === 'completed' && !isCurrent;
        const displayTitle = formatStepTitle(step, t);
        const rowKey = step.id ? `${step.id}-${index}` : `step-${index}`;
        return (
          <li
            key={rowKey}
            className={`flex gap-2 ${thinking ? 'italic opacity-90' : ''}`}
            data-step-state={step.state || 'unknown'}
          >
            <span className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-foreground/80">
                {isCurrent ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground/70" strokeWidth={2} />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-success" strokeWidth={2} />
                ) : null}
                <span>{displayTitle}</span>
              </span>
              {step.detail && !shouldHideStepDetail(step, displayTitle) ? (
                <span className="mt-0.5 block line-clamp-2 opacity-80" title={step.detail}>
                  {step.detail}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div
      className={`${INFORMAL_PROCESS.fontSize} ${INFORMAL_PROCESS.textMuted} ${className}`.trim()}
      data-testid="process-timeline"
      data-mode={mode}
    >
      {showLiveHeader || canToggleHeader || showCompletedHeader ? (
        canToggleHeader ? (
          <button
            type="button"
            aria-expanded={expanded}
            className={`flex w-full items-center ${INFORMAL_PROCESS.triggerGap} text-left ${INFORMAL_PROCESS.textMutedStrong}`}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            )}
            <ListTree className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            <span className="min-w-0 truncate">{collapsedLabel}</span>
          </button>
        ) : (
          <div
            className={`flex items-center ${INFORMAL_PROCESS.triggerGap} ${INFORMAL_PROCESS.textMutedStrong}`}
            aria-label={collapsedLabel}
          >
            <ListTree className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            <span className="min-w-0 truncate">{collapsedLabel}</span>
            {isRunning ? (
              <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground/60" strokeWidth={1.8} />
            ) : null}
          </div>
        )
      ) : null}

      {showRail && steps.length > 0 ? (
        <div className={`${suppressLiveHeader ? 'mt-0' : 'mt-1.5'} ${INFORMAL_PROCESS.rail} ${INFORMAL_PROCESS.railPadding}`}>
          {showCollapseTop ? (
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">
                {t('process.timeline.expandedTitle', { defaultValue: '全部过程' })}
              </span>
              {collapseButton('shrink-0 text-[11px] text-muted-foreground/80 underline-offset-2 hover:underline')}
            </div>
          ) : null}
          {showLiveCollapseTop && !showCollapseTop ? (
            <div className="mb-2 text-[12px] text-muted-foreground">
              {t('process.timeline.expandedTitle', { defaultValue: '全部过程' })}
            </div>
          ) : null}
          {showExpandAll ? (
            <button
              type="button"
              className="mb-1 text-[11px] text-muted-foreground/80 underline-offset-2 hover:underline"
              onClick={() => onExpandedChange(true)}
            >
              {t('process.timeline.showAll', {
                defaultValue: '查看全部过程',
              })}
            </button>
          ) : null}
          {useLiveScrollViewport ? (
            <ProcessTimelineLiveViewport
              stepCount={steps.length}
              scrollAnchorKey={scrollAnchorKey}
              maxVisibleRows={liveViewportRows}
            >
              {stepList}
            </ProcessTimelineLiveViewport>
          ) : (
            stepList
          )}
          {showCollapseBottom ? (
            <div className="mt-2 flex justify-end">
              {collapseButton('text-[11px] text-muted-foreground/80 underline-offset-2 hover:underline')}
            </div>
          ) : null}
          {showActivitySummary && activityCounts ? (
            <ProcessActivitySummary
              counts={activityCounts}
              processDetailLevel={processDetailLevel}
              className="mt-2"
            />
          ) : null}
          {children}
          {thinkingCount > 0 && mode === 'completed' ? (
            <p className="mt-1.5 text-[11px] opacity-75">
              {t('process.replay.thinkingHint', {
                defaultValue: '展开可回看推理摘要',
              })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ProcessTimeline;
