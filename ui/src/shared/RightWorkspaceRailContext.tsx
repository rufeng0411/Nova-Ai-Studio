/**
 * PD-SAAS-FORK: right workspace rail state — shared between chat composer and MainContent rail.
 */

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CodeEditorFile } from '../components/code-editor/types/types';
import type { DeliverableItem } from './collectDeliverables';
import type { DeliverablesDockState } from './deriveDeliverablesDockState';
import type { Project } from '../types/app';
import { resolveTaskFolderNavigationWithDockFallback, buildOptimisticTaskFolderTarget, type TaskFolderNavigationTarget } from './resolveTaskFolderNavigation';
import { areDeliverablesDockStatesEqual } from './deriveDeliverablesDockState';
import { createSessionSwitchDockPlaceholder, resolveRailDeliverablesDockState } from './sessionSwitchDeliverablesSync';
import type { PreflightOpenRequest } from './preflightStudioBridge';

export type RightWorkspaceRailPanel = 'deliverables' | 'files';

/** PD-SAAS-FORK: mobile bottom sheet content — deliverables table vs task folder tree */
export type MobileDeliverableSheetMode = 'deliverables' | 'folder';

export type RightWorkspaceRailValue = {
  railOpen: boolean;
  railPanel: RightWorkspaceRailPanel;
  dockState: DeliverablesDockState | null;
  previewFile: CodeEditorFile | null;
  selectedRowId: string | null;
  sheetOpen: boolean;
  sheetMode: MobileDeliverableSheetMode;
  filesNavTarget: TaskFolderNavigationTarget | null;
  /** Bumped when composer re-opens the deliverables list (forces list view even if already open). */
  deliverablesOpenSeq: number;
  /** PD-SAAS-FORK Preflight Studio active request (right-rail visual picker). */
  preflightRequest: PreflightOpenRequest | null;
  setRailOpen: (open: boolean) => void;
  setDockState: (state: DeliverablesDockState | null) => void;
  setPreviewFile: (file: CodeEditorFile | null) => void;
  setSelectedRowId: (id: string | null) => void;
  setSheetOpen: (open: boolean) => void;
  setRailPanel: (panel: RightWorkspaceRailPanel) => void;
  openMobileDeliverablesSheet: () => void;
  openMobileFolderSheet: () => void;
  openDeliverablesTab: () => void;
  openPreviewFile: (file: CodeEditorFile) => void;
  openPreflightStudio: (request: PreflightOpenRequest) => void;
  closePreflightStudio: () => void;
  openTaskFolder: ((items: DeliverableItem[]) => void) | undefined;
  showRailList: () => void;
  /** @deprecated use showRailList */
  showDeliverablesList: () => void;
};

const RightWorkspaceRailContext = createContext<RightWorkspaceRailValue | null>(null);

export function RightWorkspaceRailProvider({
  children,
  selectedProject,
  selectedSessionId = null,
}: {
  children: React.ReactNode;
  selectedProject?: Project | null;
  selectedSessionId?: string | null;
}) {
  const [railOpen, setRailOpen] = useState(false);
  const [railPanel, setRailPanel] = useState<RightWorkspaceRailPanel>('files');
  const [dockState, setDockStateRaw] = useState<DeliverablesDockState | null>(null);
  const setDockState = useCallback((state: DeliverablesDockState | null) => {
    setDockStateRaw((prev) => (areDeliverablesDockStatesEqual(prev, state) ? prev : state));
  }, []);
  const [previewFile, setPreviewFile] = useState<CodeEditorFile | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<MobileDeliverableSheetMode>('folder');
  const [filesNavTarget, setFilesNavTarget] = useState<TaskFolderNavigationTarget | null>(null);
  const [deliverablesOpenSeq, setDeliverablesOpenSeq] = useState(0);
  const [preflightRequest, setPreflightRequest] = useState<PreflightOpenRequest | null>(null);
  const filesNavSeqRef = useRef(0);
  const prevSelectedSessionIdRef = useRef<string | null>(selectedSessionId ?? null);

  useLayoutEffect(() => {
    const nextSessionId = selectedSessionId ?? null;
    if (prevSelectedSessionIdRef.current === nextSessionId) return;
    prevSelectedSessionIdRef.current = nextSessionId;
    setDockStateRaw(createSessionSwitchDockPlaceholder(nextSessionId));
    setFilesNavTarget(null);
    setSelectedRowId(null);
    setPreviewFile(null);
    filesNavSeqRef.current += 1;
    setPreflightRequest(null);
  }, [selectedSessionId]);

  // Folder scope for the active session is derived at render time via
  // resolveEffectiveTaskFolderNavigationTarget (dock folderPath / turnArtifactDir).
  // Do NOT write filesNavTarget from dockState here — that loops with ChatInterfaceV2 setDockState.

  const showRailList = useCallback(() => {
    setPreviewFile(null);
  }, []);

  const openMobileDeliverablesSheet = useCallback(() => {
    setSheetMode('deliverables');
    setDeliverablesOpenSeq((seq) => seq + 1);
    setSheetOpen(true);
  }, []);

  const openMobileFolderSheet = useCallback(() => {
    setSheetMode('folder');
    setSheetOpen(true);
  }, []);

  const openDeliverablesTab = useCallback(() => {
    if (!selectedProject?.name) return;

    setPreviewFile(null);
    setRailPanel('files');
    setRailOpen(true);

    filesNavSeqRef.current += 1;
    const navId = filesNavSeqRef.current;
    const safeDock = resolveRailDeliverablesDockState({
      dockState,
      selectedSessionId,
    });
    const items = safeDock.folderItems ?? [];

    const enriched = items.map((item) => ({
      ...item,
      turnArtifactDir: item.turnArtifactDir ?? safeDock.turnArtifactDir,
    }));

    const optimistic = buildOptimisticTaskFolderTarget(enriched, safeDock, navId);
    if (optimistic) {
      setFilesNavTarget(optimistic);
    }

    void (async () => {
      const target = await resolveTaskFolderNavigationWithDockFallback(
        enriched,
        safeDock,
        selectedProject,
        navId,
      );
      if (target && navId === filesNavSeqRef.current) {
        setFilesNavTarget(target);
      }
    })();
  }, [dockState, selectedProject, selectedSessionId]);

  const openPreviewFile = useCallback((file: CodeEditorFile) => {
    setPreviewFile(file);
    setRailOpen(true);
  }, []);

  const openTaskFolder = useCallback((items: DeliverableItem[]) => {
    if (!selectedProject?.name) return;

    setPreviewFile(null);
    setRailPanel('files');
    setRailOpen(true);

    filesNavSeqRef.current += 1;
    const navId = filesNavSeqRef.current;
    const safeDock = resolveRailDeliverablesDockState({
      dockState,
      selectedSessionId,
    });

    const enriched = items.map((item) => ({
      ...item,
      turnArtifactDir: item.turnArtifactDir ?? safeDock.turnArtifactDir,
    }));

    const optimistic = buildOptimisticTaskFolderTarget(enriched, safeDock, navId);
    if (optimistic) {
      setFilesNavTarget(optimistic);
    }

    void (async () => {
      const target = await resolveTaskFolderNavigationWithDockFallback(
        enriched,
        safeDock,
        selectedProject,
        navId,
      );
      if (target && navId === filesNavSeqRef.current) {
        setFilesNavTarget(target);
      }
    })();
  }, [dockState, selectedProject, selectedSessionId]);

  const openPreflightStudio = useCallback((request: PreflightOpenRequest) => {
    setPreviewFile(null);
    setPreflightRequest(request);
  }, []);

  const closePreflightStudio = useCallback(() => {
    setPreflightRequest(null);
  }, []);

  const setRailPanelStable = useCallback((panel: RightWorkspaceRailPanel) => {
    setRailPanel(panel);
    setRailOpen(true);
  }, []);

  const value = useMemo((): RightWorkspaceRailValue => ({
    railOpen,
    railPanel,
    dockState,
    previewFile,
    selectedRowId,
    sheetOpen,
    sheetMode,
    filesNavTarget,
    deliverablesOpenSeq,
    preflightRequest,
    setRailOpen,
    setDockState,
    setPreviewFile,
    setSelectedRowId,
    setSheetOpen,
    setRailPanel: setRailPanelStable,
    openMobileDeliverablesSheet,
    openMobileFolderSheet,
    openDeliverablesTab,
    openPreviewFile,
    openPreflightStudio,
    closePreflightStudio,
    openTaskFolder,
    showRailList,
    showDeliverablesList: showRailList,
  }), [
    deliverablesOpenSeq,
    dockState,
    filesNavTarget,
    openDeliverablesTab,
    openMobileDeliverablesSheet,
    openMobileFolderSheet,
    openPreviewFile,
    openPreflightStudio,
    closePreflightStudio,
    openTaskFolder,
    preflightRequest,
    railOpen,
    railPanel,
    selectedRowId,
    sheetMode,
    sheetOpen,
    showRailList,
    setRailPanelStable,
  ]);

  return (
    <RightWorkspaceRailContext.Provider value={value}>
      {children}
    </RightWorkspaceRailContext.Provider>
  );
}

export function useRightWorkspaceRail(): RightWorkspaceRailValue | null {
  return useContext(RightWorkspaceRailContext);
}

export function useRightWorkspaceRailRequired(): RightWorkspaceRailValue {
  const ctx = useContext(RightWorkspaceRailContext);
  if (!ctx) {
    throw new Error('useRightWorkspaceRailRequired must be used within RightWorkspaceRailProvider');
  }
  return ctx;
}

