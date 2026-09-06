// PD-SAAS-FORK: session-level sticky deliverable summary — collapsed default, expanded uses Dock rows.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableDockRow } from '../../../shared/buildDeliverableDockRows';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { normalizeConversationSummaryProgress } from '../../../shared/normalizeConversationSummaryProgress';
import { deliverableStatusLabel } from '../../../shared/deliverableStatusUi';
import type { DeliverableQualityStatusUi } from '../../../shared/turnAcceptanceMeta';
import { sessionDeliverableSummaryBarPropsEqual } from '../../../shared/sessionDeliverableSummaryBarPropsEqual';
import { SURFACE_GLASS } from '../../chat-v2/conversationSurfaceTokens';
import { cn } from '../../../lib/utils';
import DeliverableSummaryTable from './DeliverableSummaryTable';
import DeliverableSummaryBarBadge from './DeliverableCompletionPulse';
import { shouldPulseDeliverableCompletion } from '../../../shared/deliverableCompletionPulse';

type SessionDeliverableSummaryBarProps = {
  rows: DeliverableDockRow[];
  folderItems?: DeliverableItem[];
  contractHash?: string | null;
  validationSettled?: boolean;
  isRepairActive?: boolean;
  /** Sidebar「任务完成」— freeze bar as terminal snapshot. */
  taskMarkedComplete?: boolean;
  selectedProject?: Project | null;
  projectRoot?: string;
  turnArtifactDir?: string | null;
  scopeDir?: string | null;
  qualityStatus?: DeliverableQualityStatusUi | null;
  onFileOpen?: (filePath: string, second?: unknown) => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
  isMobile?: boolean;
  onOpenMobileSheet?: () => void;
  className?: string;
};

function findInProgressLabel(rows: DeliverableDockRow[]): string | null {
  const active = rows.find((row) =>
    row.status === 'checking'
    || row.status === 'missing'
    || row.status === 'needContinue'
    || row.status === 'broken');
  return active?.label ?? null;
}

function SessionDeliverableSummaryBar({
  rows,
  folderItems = [],
  contractHash = null,
  validationSettled = true,
  isRepairActive = false,
  taskMarkedComplete = false,
  selectedProject = null,
  projectRoot = '',
  turnArtifactDir = null,
  scopeDir = null,
  qualityStatus = null,
  onFileOpen,
  onOpenTaskFolder,
  isMobile = false,
  onOpenMobileSheet,
  className,
}: SessionDeliverableSummaryBarProps) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const prevDoneCountRef = useRef<number | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useMemo(() => normalizeConversationSummaryProgress(rows), [rows]);
  const inProgressLabel = useMemo(() => findInProgressLabel(rows), [rows]);
  const visibleRows = useMemo(
    () => rows.filter((row) => row.status !== 'hidden'),
    [rows],
  );

  useEffect(() => {
    const prevDone = prevDoneCountRef.current;
    if (shouldPulseDeliverableCompletion(prevDone, progress.done, progress.total)) {
      const badge = badgeRef.current;
      if (badge) {
        badge.setAttribute('data-pulse-active', 'true');
        badge.classList.remove('deliverable-badge-pulse');
        void badge.offsetWidth;
        badge.classList.add('deliverable-badge-pulse');
      }
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = t('deliverables.completionPulseAria', {
          defaultValue: '又完成一项成果',
        });
      }
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => {
        badgeRef.current?.setAttribute('data-pulse-active', 'false');
        badgeRef.current?.classList.remove('deliverable-badge-pulse');
      }, 550);
    }
    prevDoneCountRef.current = progress.done;
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [progress.done, progress.total, t]);

  const toggleExpanded = useCallback(() => {
    if (isMobile && onOpenMobileSheet) {
      onOpenMobileSheet();
      return;
    }
    setExpanded((prev) => !prev);
  }, [isMobile, onOpenMobileSheet]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  }, [toggleExpanded]);

  const showEmptyAligning = visibleRows.length === 0 && progress.total === 0;
  const displayAccepted = Math.min(progress.accepted, progress.total);
  const displayGenerated = Math.min(Math.max(progress.generated, displayAccepted), progress.total);
  const displayDone = displayAccepted;
  const allComplete = !showEmptyAligning && progress.total > 0 && displayAccepted >= progress.total;
  const hasDeliverableProgress = !showEmptyAligning && progress.total > 0 && displayAccepted > 0;
  const progressAria = t('deliverables.sessionSummaryProgressAria', {
    defaultValue: '已生成 {{generated}} · 已验收 {{accepted}} · 共 {{total}}',
    generated: displayGenerated,
    accepted: displayAccepted,
    total: progress.total,
  });

  const inProgressSuffix = taskMarkedComplete
    ? t('deliverables.sessionSummaryTaskEnded', { defaultValue: ' · 任务已结束' })
    : inProgressLabel
      ? t('deliverables.sessionSummaryInProgress', {
        defaultValue: ' · {{label}}',
        label: inProgressLabel,
      })
      : '';

  return (
    <div
      className={cn(
        'session-deliverable-summary-bar mx-auto w-full max-w-[936px] [contain:layout_style]',
        className,
      )}
      data-testid="session-deliverable-summary-bar"
      data-contract-hash={contractHash ?? undefined}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <div ref={liveRegionRef} className="sr-only" aria-live="polite" aria-atomic="true" />
      <button
        type="button"
        className={cn(
          'mobile-touch-target flex w-full min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left',
          SURFACE_GLASS,
          'text-[12px] hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 active:bg-muted/40',
          showEmptyAligning
            ? 'border-border/30 bg-muted/20'
            : allComplete
              ? 'border-success/30 bg-success/[0.07]'
              : hasDeliverableProgress
                ? 'border-success/22 bg-success/[0.05]'
                : 'border-border/30 bg-muted/25',
        )}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        aria-expanded={isMobile ? false : expanded}
        data-testid="session-deliverable-summary-bar-toggle"
      >
        <DeliverableSummaryBarBadge
          ref={badgeRef}
          done={displayDone}
          total={progress.total}
          aligning={showEmptyAligning}
        />
        <span
          className="min-w-0 flex-1 truncate font-normal tracking-tight text-foreground/90"
          title={showEmptyAligning ? undefined : progressAria}
          aria-label={showEmptyAligning ? undefined : progressAria}
        >
          {showEmptyAligning ? (
            t('deliverables.sessionSummaryAligning', { defaultValue: '成果清单对齐中…' })
          ) : (
            <>
              {t('deliverables.sessionSummaryLabel', { defaultValue: '成果' })}
              {' '}
              {allComplete ? (
                <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-success">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  {progress.total}/{progress.total}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 align-middle tabular-nums font-medium text-foreground/85"
                  data-testid="session-summary-dual-progress"
                >
                  <span
                    className="inline-flex items-center gap-0.5 text-muted-foreground"
                    data-testid="session-summary-generated"
                  >
                    <FileText className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                    {displayGenerated}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5',
                      hasDeliverableProgress ? 'font-semibold text-success' : 'text-muted-foreground',
                    )}
                    data-testid="session-summary-accepted"
                  >
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden />
                    {displayAccepted}
                  </span>
                  <span className="text-muted-foreground/70" data-testid="session-summary-total">/{progress.total}</span>
                </span>
              )}
              {inProgressSuffix}
            </>
          )}
        </span>
        {!validationSettled && !taskMarkedComplete && progress.done < progress.total ? (
          <span className="shrink-0 text-[10px] text-muted-foreground/70">
            {deliverableStatusLabel('checking', t, isRepairActive)}
          </span>
        ) : null}
        {!isMobile ? (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
            : <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" strokeWidth={1.75} aria-hidden />
        )}
      </button>
      {!isMobile && expanded ? (
        <div className="mt-1.5 rounded-xl border border-border/30 bg-[hsl(var(--nav-glass-bg))] p-2 backdrop-blur-[var(--nav-glass-blur)] backdrop-saturate-[var(--nav-glass-saturate,1.4)]" data-testid="session-deliverable-summary-expanded">
          <DeliverableSummaryTable
            items={[]}
            folderItems={folderItems}
            selectedProject={selectedProject}
            projectRoot={projectRoot}
            turnArtifactDir={turnArtifactDir ?? undefined}
            unifiedRowsOverride={rows}
            unifiedRowsAuthoritative
            contractHash={contractHash}
            scopeDir={scopeDir}
            validationSettled={validationSettled}
            isDeliverableRepairActive={isRepairActive}
            qualityStatus={qualityStatus}
            forceShow
            preferManifestLabels
            onFileOpen={onFileOpen}
            onOpenTaskFolder={onOpenTaskFolder}
            className="mt-0"
          />
        </div>
      ) : null}
    </div>
  );
}

export default memo(SessionDeliverableSummaryBar, sessionDeliverableSummaryBarPropsEqual);
