// PD-SAAS-FORK: files-tab middle column — task folder file tree

import { useMemo } from 'react';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import type { FilesNavigationTarget } from '../../main-content-v2/FilesV2';
import FilesV2 from '../../main-content-v2/FilesV2';
import WorkspaceRailFolderHeader from './WorkspaceRailPanelTabs';
import TaskFolderRailPanel from './TaskFolderRailPanel';
import { useRightWorkspaceRail } from '../../../shared/RightWorkspaceRailContext';
import { resolveRailDeliverablesDockState } from '../../../shared/sessionSwitchDeliverablesSync';
import { resolveEffectiveTaskFolderNavigationTarget } from '../../../shared/resolveTaskFolderNavigation';

type FilesSplitMiddlePanelProps = {
  selectedProject: Project | null;
  selectedSessionId?: string | null;
  onFileOpen?: (filePath: string) => void;
  navigationTarget?: FilesNavigationTarget | null;
  onClose?: () => void;
  onOpenTaskFolder?: (items: DeliverableItem[]) => void;
};

export default function FilesSplitMiddlePanel({
  selectedProject,
  selectedSessionId = null,
  onFileOpen,
  navigationTarget,
  onClose,
}: FilesSplitMiddlePanelProps) {
  const rail = useRightWorkspaceRail();

  const dockState = useMemo(
    () => resolveRailDeliverablesDockState({
      dockState: rail?.dockState ?? null,
      selectedSessionId,
    }),
    [rail?.dockState, selectedSessionId],
  );

  const effectiveNavigationTarget = useMemo(
    () => resolveEffectiveTaskFolderNavigationTarget({
      explicitTarget: navigationTarget ?? rail?.filesNavTarget ?? null,
      dockState,
      selectedSessionId,
      navId: navigationTarget?.id ?? rail?.filesNavTarget?.id,
    }),
    [dockState, navigationTarget, rail?.filesNavTarget, selectedSessionId],
  );

  if (!selectedProject) return null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="files-split-middle-panel">
      <div className="shrink-0 border-b border-border px-2 py-1.5">
        <WorkspaceRailFolderHeader />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {navigationTarget ? (
          <FilesV2
            key={`${selectedProject.name}:${selectedSessionId ?? 'no-session'}`}
            selectedProject={selectedProject}
            onFileOpen={onFileOpen}
            navigationTarget={effectiveNavigationTarget}
            onClose={onClose}
          />
        ) : (
          <TaskFolderRailPanel
            key={selectedSessionId ?? 'no-session'}
            selectedProject={selectedProject}
            navigationTarget={effectiveNavigationTarget}
            onFileOpen={onFileOpen}
            processFilePaths={dockState?.processFilePaths}
            dockRows={dockState?.rows ?? []}
          />
        )}
      </div>
    </div>
  );
}
