// PD-SAAS-FORK: mobile bottom sheet — deliverables list or task folder tree
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableDockRow } from '../../../shared/buildDeliverableDockRows';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import type { DeliverableQualityStatusUi } from '../../../shared/turnAcceptanceMeta';
import type { MobileDeliverableSheetMode } from '../../../shared/RightWorkspaceRailContext';
import TaskFolderRailPanel from '../../main-content/view/TaskFolderRailPanel';
import WorkspaceRailFolderHeader from '../../main-content/view/WorkspaceRailPanelTabs';
import DeliverableSummaryTable from './DeliverableSummaryTable';
import { useRightWorkspaceRail } from '../../../shared/RightWorkspaceRailContext';
import { resolveEffectiveTaskFolderNavigationTarget } from '../../../shared/resolveTaskFolderNavigation';
import { cn } from '../../../lib/utils';

type DeliverableSessionSheetProps = {
  open: boolean;
  mode: MobileDeliverableSheetMode;
  onClose: () => void;
  selectedSessionId?: string | null;
  rows: DeliverableDockRow[];
  folderPath?: string | null;
  folderItems?: DeliverableItem[];
  selectedProject?: Project | null;
  projectRoot?: string;
  turnArtifactDir?: string;
  scopeDir?: string | null;
  contractHash?: string | null;
  validationSettled?: boolean;
  selectedRowId?: string | null;
  isRepairActive?: boolean;
  currentStageId?: string;
  stageProgress?: { done: number; total: number; currentLabel?: string };
  qualityStatus?: DeliverableQualityStatusUi | null;
  onSelectRow?: (row: DeliverableDockRow) => void;
  onFileOpen?: (filePath: string) => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
};

export default function DeliverableSessionSheet({
  open,
  mode,
  onClose,
  selectedSessionId = null,
  rows,
  folderPath = null,
  folderItems = [],
  selectedProject,
  projectRoot = '',
  turnArtifactDir,
  scopeDir = null,
  contractHash = null,
  validationSettled = true,
  isRepairActive = false,
  qualityStatus = null,
  onFileOpen,
  onOpenTaskFolder,
}: DeliverableSessionSheetProps) {
  const { t } = useTranslation('chat');
  const rail = useRightWorkspaceRail();
  const scrollLockYRef = useRef(0);

  const folderNavigationTarget = resolveEffectiveTaskFolderNavigationTarget({
    explicitTarget: rail?.filesNavTarget ?? null,
    dockState: {
      sessionId: selectedSessionId,
      folderPath,
      turnArtifactDir,
      folderItems,
    },
    selectedSessionId,
    navId: rail?.filesNavTarget?.id,
  });

  useEffect(() => {
    if (!open) return undefined;
    scrollLockYRef.current = window.scrollY;
    const { style } = document.body;
    const previous = {
      position: style.position,
      top: style.top,
      width: style.width,
      overflow: style.overflow,
    };
    style.position = 'fixed';
    style.top = `-${scrollLockYRef.current}px`;
    style.width = '100%';
    style.overflow = 'hidden';
    return () => {
      style.position = previous.position;
      style.top = previous.top;
      style.width = previous.width;
      style.overflow = previous.overflow;
      window.scrollTo(0, scrollLockYRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleBackdropPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      onClose();
    },
    [onClose],
  );

  if (!open) return null;

  const isDeliverablesMode = mode === 'deliverables';
  const title = isDeliverablesMode
    ? t('deliverables.summaryTitle', { defaultValue: '成果清单' })
    : t('workspaceRail.tabFolder', { defaultValue: '文件夹' });

  return createPortal(
    <div
      className="mobile-bottom-sheet fixed inset-0 z-[120] flex flex-col justify-end"
      data-testid="deliverable-session-sheet"
      data-sheet-mode={mode}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label={t('deliverables.dockClose', { defaultValue: '关闭' })}
        className="mobile-sheet-backdrop absolute inset-0 bg-black/45"
        onPointerDown={handleBackdropPointerDown}
      />
      <div
        className={cn(
          'mobile-sheet-panel relative flex max-h-[min(82dvh,720px)] flex-col rounded-t-2xl border border-border bg-card shadow-xl',
          'pb-[env(safe-area-inset-bottom,0px)]',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          {isDeliverablesMode ? (
            <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
              {title}
            </div>
          ) : (
            <WorkspaceRailFolderHeader className="min-w-0 flex-1 px-0" />
          )}
          <button
            type="button"
            onClick={onClose}
            title={t('deliverables.dockClose', { defaultValue: '关闭' }) as string}
            aria-label={t('deliverables.dockClose', { defaultValue: '关闭' })}
            className="mobile-touch-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition active:bg-muted"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="mobile-sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isDeliverablesMode ? (
            <div className="px-3 py-2" data-testid="deliverable-session-sheet-list">
              <DeliverableSummaryTable
                items={[]}
                folderItems={folderItems}
                selectedProject={selectedProject}
                projectRoot={projectRoot}
                turnArtifactDir={turnArtifactDir}
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
                mobileSheetLayout
              />
            </div>
          ) : selectedProject ? (
            <TaskFolderRailPanel
              key={selectedSessionId ?? 'no-session'}
              selectedProject={selectedProject}
              navigationTarget={folderNavigationTarget}
              onFileOpen={onFileOpen}
              processFilePaths={rail?.dockState?.processFilePaths}
              dockRows={rows}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
