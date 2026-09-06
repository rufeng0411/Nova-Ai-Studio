// PD-SAAS-FORK: far-right slide-out drawer — task folder only (Preflight → Super Preview split)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { useRightWorkspaceRail } from '../../../shared/RightWorkspaceRailContext';
import TaskFolderRailPanel from './TaskFolderRailPanel';
import WorkspaceRailFolderHeader from './WorkspaceRailPanelTabs';
import { classifyDeliverablePath, getArtifactFileName } from '../../../shared/artifactPaths';
import { supportsUnifiedFilePreview } from '../../../shared/projectPreviewCapabilities';
import type { CodeEditorFile } from '../../code-editor/types/types';
import { resolveRailDeliverablesDockState } from '../../../shared/sessionSwitchDeliverablesSync';
import { resolveEffectiveTaskFolderNavigationTarget } from '../../../shared/resolveTaskFolderNavigation';
import { cn } from '../../../lib/utils';

type RightWorkspaceRailProps = {
  selectedProject: Project | null;
  selectedSessionId?: string | null;
  isMobile: boolean;
  railWidth: number;
  onRailWidthChange?: (width: number) => void;
  onFileOpen?: (filePath: string, options?: unknown) => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
};

export const WORKSPACE_DRAWER_MIN_WIDTH = 200;
export const WORKSPACE_DRAWER_DEFAULT_WIDTH = 240;
const MIN_LEFT_CONTENT_WIDTH = 380;
const EDGE_HIT_WIDTH_PX = 14;

export default function RightWorkspaceRail({
  selectedProject,
  selectedSessionId = null,
  isMobile,
  railWidth,
  onRailWidthChange,
  onFileOpen,
  onOpenTaskFolder,
}: RightWorkspaceRailProps) {
  const { t } = useTranslation('chat');
  const rail = useRightWorkspaceRail();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [effectiveWidth, setEffectiveWidth] = useState(
    Math.max(WORKSPACE_DRAWER_MIN_WIDTH, railWidth),
  );
  const [edgeHover, setEdgeHover] = useState(false);

  const dockState = useMemo(
    () => resolveRailDeliverablesDockState({
      dockState: rail?.dockState ?? null,
      selectedSessionId,
    }),
    [rail?.dockState, selectedSessionId],
  );
  const folderNavigationTarget = useMemo(
    () => resolveEffectiveTaskFolderNavigationTarget({
      explicitTarget: rail?.filesNavTarget ?? null,
      dockState,
      selectedSessionId,
      navId: rail?.filesNavTarget?.id,
    }),
    [dockState, rail?.filesNavTarget, selectedSessionId],
  );
  const railOpen = rail?.railOpen ?? false;

  useEffect(() => {
    setEffectiveWidth(Math.max(WORKSPACE_DRAWER_MIN_WIDTH, railWidth));
  }, [railWidth]);

  useEffect(() => {
    if (!railOpen || isMobile) return undefined;
    const updateWidth = () => {
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const maxWidth = Math.max(WORKSPACE_DRAWER_MIN_WIDTH, parent.clientWidth - MIN_LEFT_CONTENT_WIDTH);
      setEffectiveWidth((current) => Math.min(Math.max(current, WORKSPACE_DRAWER_MIN_WIDTH), maxWidth));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    const observer = new ResizeObserver(updateWidth);
    const parentEl = containerRef.current?.parentElement;
    if (parentEl) observer.observe(parentEl);
    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, [isMobile, railOpen]);

  const openDrawerFolder = useCallback(() => {
    if (!rail) return;
    const openTaskFolder = onOpenTaskFolder ?? rail.openTaskFolder;
    openTaskFolder?.(dockState?.folderItems ?? []);
  }, [dockState?.folderItems, onOpenTaskFolder, rail]);

  const handleResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (isMobile || !railOpen) return;
    setIsResizing(true);
    event.preventDefault();
  }, [isMobile, railOpen]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const railEl = containerRef.current;
      if (!railEl) return;
      const right = railEl.getBoundingClientRect().right;
      const next = right - event.clientX;
      const parent = railEl.parentElement;
      const maxWidth = parent
        ? Math.max(WORKSPACE_DRAWER_MIN_WIDTH, parent.clientWidth - MIN_LEFT_CONTENT_WIDTH)
        : railWidth * 2;
      const clamped = Math.min(Math.max(next, WORKSPACE_DRAWER_MIN_WIDTH), maxWidth);
      setEffectiveWidth(clamped);
      onRailWidthChange?.(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onRailWidthChange, railWidth]);

  const handleClose = useCallback(() => {
    rail?.setRailOpen(false);
    rail?.setSheetOpen(false);
  }, [rail]);

  if (!selectedProject || isMobile) {
    return null;
  }

  return (
    <>
      {!railOpen ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center"
        >
          <div
            className="pointer-events-auto flex h-full items-center justify-center"
            style={{ width: EDGE_HIT_WIDTH_PX }}
            onMouseEnter={() => setEdgeHover(true)}
            onMouseLeave={() => setEdgeHover(false)}
            data-testid="workspace-drawer-edge-zone"
          >
            <button
              type="button"
              onClick={openDrawerFolder}
              className={cn(
                'inline-flex h-16 w-5 items-center justify-center rounded-l-md border border-r-0 border-border/70 bg-card/75 text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200',
                edgeHover ? 'translate-x-0 opacity-90' : 'translate-x-1 opacity-0',
              )}
              title={t('workspaceRail.slideOut', { defaultValue: '展开侧栏' })}
              data-testid="workspace-drawer-edge-open"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          'absolute inset-y-0 right-0 z-20 flex h-full min-w-0 overflow-hidden border-l border-border bg-card transition-[width] duration-300 ease-out',
          railOpen ? 'shadow-lg' : 'border-transparent shadow-none pointer-events-none',
        )}
        style={{ width: railOpen ? `${effectiveWidth}px` : '0px' }}
        data-testid="right-workspace-rail"
        data-rail-panel="files"
        data-rail-open={railOpen ? 'true' : 'false'}
      >
        <div
          className={cn(
          'pointer-events-auto flex h-full min-w-0 flex-col transition-transform duration-300 ease-out',
          railOpen ? 'translate-x-0' : 'translate-x-full',
        )}
          style={{ width: `${effectiveWidth}px` }}
        >
          <div
            onMouseDown={handleResizeStart}
            className="group absolute inset-y-0 left-0 z-10 w-1 -translate-x-1/2 cursor-col-resize"
            title={t('resize.dragToResizePanel', { defaultValue: '拖动调整宽度' })}
            data-testid="workspace-rail-resize-handle"
          >
            <div className="absolute inset-y-0 -left-1 w-3 bg-transparent" />
          </div>

          <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-1.5 py-1">
            <WorkspaceRailFolderHeader />
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              title={t('workspaceRail.slideIn', { defaultValue: '收起侧栏' })}
              data-testid="workspace-drawer-close"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <TaskFolderRailPanel
              key={selectedSessionId ?? 'no-session'}
              selectedProject={selectedProject}
              navigationTarget={folderNavigationTarget}
              onFileOpen={onFileOpen}
              processFilePaths={dockState?.processFilePaths}
              dockRows={dockState?.rows ?? []}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// PD-SAAS-FORK: helper — open preview tab when path supports unified preview
export function shouldOpenRailPreview(fileName: string): boolean {
  return supportsUnifiedFilePreview(fileName) || classifyDeliverablePath(fileName) !== 'other';
}

export function buildRailPreviewFile(
  filePath: string,
  project: Project,
  hintDir?: string,
): CodeEditorFile {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = getArtifactFileName(normalized);
  const previewable = supportsUnifiedFilePreview(fileName);
  return {
    name: fileName,
    path: normalized,
    projectName: project.name,
    initialPreview: previewable,
    hintDir,
  };
}
