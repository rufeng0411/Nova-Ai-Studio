// PD-SAAS-FORK: session deliverables list with SDM stage pill for right rail / mobile sheet
import { useTranslation } from 'react-i18next';
import { FolderOpen, Loader2 } from 'lucide-react';
import type { Project } from '../../../types/app';
import type { DeliverableDockRow } from '../../../shared/buildDeliverableDockRows';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { deliverableStatusLabel } from '../../../shared/deliverableStatusUi';
import { SESSION_SWITCH_DOCK_SUBTITLE_KEY } from '../../../shared/sessionSwitchDeliverablesSync';
import { formatDeliverableFileTypeLabel } from '../../../shared/deliverableFileTypeLabel';
import { classifyDeliverablePath, getArtifactFileName } from '../../../shared/artifactPaths';
import { DeliverableFileTypeIcon } from '../../../shared/deliverableFileIcon';
import { cn } from '../../../lib/utils';
import DeliverableQualityStatus from './DeliverableQualityStatus';
import type {
  AssetProvenanceSummaryUi,
  DeliverableQualityStatusUi,
} from '../../../shared/turnAcceptanceMeta';

type DeliverableSessionDockProps = {
  rows: DeliverableDockRow[];
  folderPath?: string | null;
  folderItems?: DeliverableItem[];
  selectedProject?: Project | null;
  projectRoot?: string;
  turnArtifactDir?: string;
  selectedRowId?: string | null;
  isRepairActive?: boolean;
  currentStageId?: string;
  stageProgress?: { done: number; total: number; currentLabel?: string };
  onSelectRow?: (row: DeliverableDockRow) => void;
  onFileOpen?: (filePath: string) => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
  /** When true, hide duplicate「前往任务文件夹」— use rail tabs instead. */
  embeddedInTabs?: boolean;
  className?: string;
  /** PD-SAAS-FORK P0-8: certificate-backed final quality badge. */
  qualityStatus?: DeliverableQualityStatusUi | null;
  /** PD-SAAS-FORK VAP P1-B: optional provenance for quality badge hover. */
  assetProvenanceSummary?: AssetProvenanceSummaryUi | null;
  /** PD-SAAS-FORK (P1-B5): older transcript pages not loaded — list may be incomplete. */
  hasMoreMessages?: boolean;
  /** PD-SAAS-FORK P0-D: unified status subtitle from USN. */
  statusSubtitleKey?: string | null;
  statusSubtitleValues?: Record<string, string | number>;
};

function stageLabelForRow(
  row: DeliverableDockRow,
  t: ReturnType<typeof useTranslation<'chat'>>['t'],
): string | null {
  if (!row.stageId) return null;
  return t(`process.templateStage.${row.stageId}`, {
    defaultValue: row.label,
  });
}

export default function DeliverableSessionDock({
  rows,
  folderPath,
  folderItems = [],
  selectedRowId,
  isRepairActive = false,
  currentStageId,
  stageProgress,
  onSelectRow,
  onOpenTaskFolder,
  embeddedInTabs = false,
  className,
  qualityStatus,
  assetProvenanceSummary,
  hasMoreMessages = false,
  statusSubtitleKey,
  statusSubtitleValues,
}: DeliverableSessionDockProps) {
  const { t } = useTranslation('chat');
  const taskFolderItems = folderItems.length > 0 ? folderItems : [];

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)} data-testid="deliverable-session-dock">
      {hasMoreMessages ? (
        <p
          className="shrink-0 border-b border-border px-3 py-2 text-[11px] text-muted-foreground"
          data-testid="deliverable-dock-has-more-hint"
        >
          {t('deliverables.loadEarlierForFullList', {
            defaultValue: '加载更早对话以查看完整成果清单',
          })}
        </p>
      ) : null}
      {stageProgress && stageProgress.total > 0 ? (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <div
            data-testid="template-stage-pill"
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
          >
            <span className="text-muted-foreground">
              {t('process.templateStage.progress', {
                defaultValue: '阶段 {{done}}/{{total}}',
                done: stageProgress.done,
                total: stageProgress.total,
              })}
            </span>
            {stageProgress.currentLabel ? (
              <span className="truncate">· {stageProgress.currentLabel}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {statusSubtitleKey ? (
        <div
          className="shrink-0 border-b border-border px-3 py-2 text-[11px] text-muted-foreground"
          data-testid="deliverable-dock-status-subtitle"
        >
          {t(statusSubtitleKey, {
            defaultValue: statusSubtitleKey === SESSION_SWITCH_DOCK_SUBTITLE_KEY
              ? '正在加载当前对话成果…'
              : statusSubtitleKey === 'working.deliverableAligning'
              ? '正在核对成果清单…'
              : statusSubtitleKey === 'sidebar.sessions.queued'
                ? '排队中…'
                : '制作中…',
            ...statusSubtitleValues,
          })}
        </div>
      ) : null}
      {qualityStatus ? (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <DeliverableQualityStatus
            status={qualityStatus}
            provenance={assetProvenanceSummary
              ? {
                  officialEntries: assetProvenanceSummary.officialEntries,
                  placeholderCount: assetProvenanceSummary.placeholderCount,
                }
              : null}
          />
        </div>
      ) : null}
      {folderPath && !embeddedInTabs && onOpenTaskFolder ? (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={() => onOpenTaskFolder(taskFolderItems)}
            className="inline-flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-foreground transition hover:bg-muted"
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate">{t('deliverables.openTaskFolder')}</span>
          </button>
        </div>
      ) : null}
      {/* Tabbed rail: folder navigation via header tabs, not a separate panel. */}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {rows.length === 0 ? (
          statusSubtitleKey === SESSION_SWITCH_DOCK_SUBTITLE_KEY ? (
            <div
              className="flex flex-col items-center justify-center gap-2 px-2 py-6 text-[12px] text-muted-foreground"
              data-testid="deliverable-dock-session-loading"
            >
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              <span>
                {t('deliverables.sessionSwitchLoading', {
                  defaultValue: '正在加载当前对话成果，请稍候…',
                })}
              </span>
            </div>
          ) : (
            <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">
              {t('deliverables.dockEmpty', { defaultValue: '暂无成果' })}
            </div>
          )
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((row) => {
              const stage = stageLabelForRow(row, t);
              const isActiveStage = Boolean(row.stageId && row.stageId === currentStageId);
              // PD-SAAS-FORK VAP: prefer prepared/localized path when Dock row carries it.
              const filePath = row.resolvedPath || row.path;
              const fileName = getArtifactFileName(filePath);
              const isPreparedAsset = /\/assets\/prepared\//i.test(
                String(filePath || '').replace(/\\/g, '/'),
              );
              const fileKind = classifyDeliverablePath(filePath || fileName);
              const isSelected = selectedRowId === row.id;

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRow?.(row)}
                    className={cn(
                      'flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition',
                      isSelected
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-transparent hover:border-border hover:bg-muted/60',
                    )}
                    title={isPreparedAsset
                      ? t('deliverables.preparedAsset', { defaultValue: '已处理配图' })
                      : undefined}
                    data-prepared-asset={isPreparedAsset ? '1' : undefined}
                  >
                    <div className="flex items-start gap-2">
                      <DeliverableFileTypeIcon
                        fileName={fileName}
                        kind={fileKind}
                        className="mt-0.5 h-3.5 w-3.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13px] font-medium text-foreground">{row.label}</span>
                          {stage ? (
                            <span
                              className={cn(
                                'inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                isActiveStage
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {stage}
                            </span>
                          ) : null}
                          {isPreparedAsset ? (
                            <span className="inline-flex shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {t('deliverables.preparedShort', { defaultValue: '已处理' })}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>{formatDeliverableFileTypeLabel(fileName)}</span>
                          <span>{deliverableStatusLabel(row.status, t, isRepairActive)}</span>
                        </div>
                        {fileName ? (
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{fileName}</div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
