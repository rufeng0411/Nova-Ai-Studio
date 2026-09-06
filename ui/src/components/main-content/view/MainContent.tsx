import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChatInterfaceV2 from '../../chat-v2/ChatInterfaceV2';
import FilesSplitMiddlePanel from './FilesSplitMiddlePanel';
import { cn } from '../../../lib/utils.js';
import type { MainContentProps } from '../types/types';
import { useTaskMaster } from '../../../contexts/TaskMasterContext';
import { useTasksSettings } from '../../../contexts/TasksSettingsContext';
import { useUiPreferences } from '../../../hooks/useUiPreferences';
import { useEditorSidebar } from '../../code-editor/hooks/useEditorSidebar';
import EditorSidebar from '../../code-editor/view/EditorSidebar';
import PreflightPreviewPanel from './PreflightPreviewPanel';
import RightWorkspaceRail, { WORKSPACE_DRAWER_DEFAULT_WIDTH } from './RightWorkspaceRail';
import { RightWorkspaceRailProvider, useRightWorkspaceRail } from '../../../shared/RightWorkspaceRailContext';
import { subscribePreflightStudio, dispatchPreflightComposerSubmit } from '../../../shared/preflightStudioBridge';
import { isPreflightStudioEnabled } from '../../../shared/preflightStudioGate';
import { useRuntimeFeatureFlags } from '../../../shared/useRuntimeFeatureFlags';
import type { CodeEditorDiffInfo, CodeEditorFile } from '../../code-editor/types/types';
import { buildBentoFileOpenOptions } from '../../../shared/bentoStudioDock';
import type { FileOpenOptions } from '../../code-editor/utils/fileOpen';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { getArtifactDirectory } from '../../../shared/artifactPaths';
import { resolveTaskFolderLocation } from '../../../shared/pickPrimaryDeliverable';
import { resolveDeliverablePath } from '../../../shared/resolveDeliverablePath';
import type { FilesNavigationTarget } from '../../main-content-v2/FilesV2';
import type {
 AlwaysOnSessionTarget,
 Project,
 ProjectSession,
} from '../../../types/app';
import { api } from '../../../utils/api';
import {
 clearAlwaysOnPresence,
 sendAlwaysOnPresence,
} from '../../../utils/alwaysOnPresence';
import MainContentStateView from './subcomponents/MainContentStateView';
import ErrorBoundary from './ErrorBoundary';
import TemplatesHubPanel from '../../templates-hub/TemplatesHubPanel';
import {
 LazyAlwaysOnV2,
 LazyDashboardV2,
 LazyGitV2,
 LazyMemoryPanel,
 LazyPluginTabContent,
 LazyShellV2,
 LazyTasksV2,
 MainTabSuspense,
 prefetchSecondaryMainTabs,
} from './mainContentLazyTabs';
import { requestCapabilityLaunch, requestCapabilityTry } from '../../../shared/capabilityTryBridge';
import type { CapabilityBindingContext } from '../../../shared/capabilityBinding';
import { openDesignCanvasInSidebar } from '../../../shared/designCanvasDock';
import { openHtmlStudioInSidebar } from '../../../shared/htmlStudioDock';
import { openHfStudioInSidebar } from '../../../shared/hfStudioDock';
import { resolveEditAdapter } from '../../../shared/resolveEditAdapter';
import type { ArtifactContract } from '../../../shared/artifactContract';
import { primeProcessTemplatesCache } from '../../../shared/templatesHubCache';

type TaskMasterContextValue = {
 currentProject?: Project | null;
 setCurrentProject?: ((project: Project) => void) | null;
};

type TasksSettingsContextValue = {
 tasksEnabled: boolean;
 isTaskMasterInstalled: boolean | null;
 isTaskMasterReady: boolean | null;
};

type MainContentToast = { kind: 'error' | 'info'; text: string } | null;

const FILES_CHAT_DEFAULT_WIDTH = 460;
const FILES_CHAT_MIN_WIDTH = 320;
const FILES_TREE_MIN_WIDTH = 280;
const FILES_TREE_ONLY_WIDTH = 300;

async function readJsonPayload<T>(response: Response): Promise<T | null> {
 try {
 return await response.json() as T;
 } catch {
 return null;
 }
}

function MainContent({
 projects,
 selectedProject,
 selectedSession,
 activeTab,
 setActiveTab,
 alwaysOnSubTab = 'dashboard',
 onAlwaysOnSubTabChange,
 ws,
 sendMessage,
 latestMessage,
 isMobile,
 onMenuClick,
 isLoading,
 onInputFocusChange,
 onSessionActive,
 onSessionInactive,
 onSessionProcessing,
 onSessionNotProcessing,
 onExecutionStatusChange,
 onSessionAttentionChange,
 onSessionActivityBump,
 processingSessions,
 onReplaceTemporarySession,
 onNavigateToSession,
 onStartNewSession,
 onSelectSession,
 onShowSettings,
 onSelectProjectByName,
 externalMessageUpdate,
}: MainContentProps) {
 const { i18n, t } = useTranslation();
 const { preferences } = useUiPreferences();
 const {
 autoExpandTools,
 showRawParameters,
 showThinking,
 processDetailLevel,
 autoScrollToBottom,
 sendByCtrlEnter,
 } = preferences;

 const { currentProject, setCurrentProject } = useTaskMaster() as TaskMasterContextValue;
 const { tasksEnabled, isTaskMasterInstalled } = useTasksSettings() as TasksSettingsContextValue;
 const lastUserMsgAtRef = useRef<string | null>(null);
 const [toast, setToast] = useState<MainContentToast>(null);
 const [workspaceRailWidth, setWorkspaceRailWidth] = useState(WORKSPACE_DRAWER_DEFAULT_WIDTH);

 const shouldShowTasksTab = Boolean(tasksEnabled && isTaskMasterInstalled);

 const {
 editingFile,
 editorWidth,
 splitChatWidth,
 editorExpanded,
 hasManualWidth,
 resizeHandleRef,
 handleFileOpen,
 handleCloseEditor,
 handleToggleEditorExpand,
 handleResizeStart,
 } = useEditorSidebar({
 selectedProject,
 isMobile,
 });

 const handleDesignCanvasEditDock = useCallback(() => {
   if (!editingFile) return;
   const contractStub = {
     carrierScope: 'report_html',
     pages: [],
   } as ArtifactContract;
   const surface = resolveEditAdapter({
     contract: contractStub,
     fileName: editingFile.name,
     apiPath: editingFile.path,
   });
   if (surface === 'hyperframesStudio') {
     openHfStudioInSidebar(handleFileOpen, editingFile.path, editingFile.name, undefined, {
       hintDir: editingFile.hintDir,
       hfStudioMode: 'edit',
     });
     return;
   }
   if (surface === 'htmlStudio') {
     openHtmlStudioInSidebar(handleFileOpen, editingFile.path, editingFile.name, 0, {
       hintDir: editingFile.hintDir,
       htmlStudioMode: 'edit',
     });
     return;
   }
   openDesignCanvasInSidebar(handleFileOpen, editingFile.path, editingFile.name, {
     hintDir: editingFile.hintDir,
     designCanvasMode: 'edit',
   });
 }, [editingFile, handleFileOpen]);

 const filesNavSeqRef = useRef(0);
 const [filesNavTarget, setFilesNavTarget] = useState<FilesNavigationTarget | null>(null);

 const handleOpenTaskFolder = useCallback((items: DeliverableItem[]) => {
 const location = resolveTaskFolderLocation(items);
 if (!selectedProject?.name) return;
 if (!location?.filePath && items.length === 0) {
   setActiveTab('files');
   return;
 }
 if (!location?.filePath) return;

 void (async () => {
 let resolvedPath = location.filePath.replace(/\\/g, '/').trim();
 const turnArtifactDir = items.find((item) => item.turnArtifactDir)?.turnArtifactDir;

 try {
 const resolved = await resolveDeliverablePath({
 projectName: selectedProject.name,
 path: location.filePath,
 turnArtifactDir,
 projectRoot: selectedProject.fullPath || selectedProject.path,
 });
 if (resolved?.relativePath && !resolved.ambiguous) {
 resolvedPath = resolved.relativePath.replace(/\\/g, '/').trim();
 }
 } catch {
 // PD-SAAS-FORK: If the resolve API is temporarily unavailable, still move the user to the
 // best-known task folder instead of surfacing a raw "fetch failed".
 }

 setActiveTab('files');
 handleCloseEditor();
 filesNavSeqRef.current += 1;
 setFilesNavTarget({
 filePath: resolvedPath,
 folderPath: getArtifactDirectory(resolvedPath),
 id: filesNavSeqRef.current,
 hintDir: turnArtifactDir,
 });
 })();
 }, [handleCloseEditor, selectedProject, setActiveTab]);

 useEffect(() => {
 const selectedProjectName = selectedProject?.name;
 const currentProjectName = currentProject?.name;

 if (selectedProject && selectedProjectName !== currentProjectName) {
 setCurrentProject?.(selectedProject);
 }
 }, [selectedProject, currentProject?.name, setCurrentProject]);

 useEffect(() => {
 if (!shouldShowTasksTab && activeTab === 'tasks') {
 setActiveTab('chat');
 }
 }, [shouldShowTasksTab, activeTab, setActiveTab]);

 useEffect(() => {
 setFilesNavTarget(null);
 filesNavSeqRef.current += 1;
 }, [selectedSession?.id]);

 const refreshProjectsSilently = useCallback(() => {
 if (window.refreshProjects) {
 void window.refreshProjects();
 }
 }, []);

 const trackedSendMessage = useCallback((message: unknown) => {
 if (
 message &&
 typeof message === 'object' &&
 'type' in message &&
 ['claude-command', 'cursor-command', 'codex-command', 'gemini-command','pilotdeck-command'].includes(
 String((message as { type?: unknown }).type),
 )
 ) {
 lastUserMsgAtRef.current = new Date().toISOString();
 }
 sendMessage(message);
 }, [sendMessage]);

 const publishPresence = useCallback(() => {
 const alwaysOnProjects = projects.filter(project =>
 project.alwaysOn?.discovery?.triggerEnabled === true
 );
 if (!selectedProject && alwaysOnProjects.length === 0) {
 return;
 }
 sendAlwaysOnPresence(sendMessage, {
 selectedProject,
 alwaysOnProjects,
 processingSessionIds: Array.from(processingSessions),
 lastUserMsgAt: lastUserMsgAtRef.current,
 });
 }, [processingSessions, projects, selectedProject, sendMessage]);

 useEffect(() => {
 const hasAlwaysOnProject = projects.some(project =>
 project.alwaysOn?.discovery?.triggerEnabled === true
 );
 if (!ws || (!selectedProject && !hasAlwaysOnProject)) {
 return undefined;
 }

 publishPresence();
 const timer = window.setInterval(publishPresence, 30000);
 return () => {
 window.clearInterval(timer);
 clearAlwaysOnPresence(sendMessage);
 };
 }, [projects, publishPresence, selectedProject, sendMessage, ws]);

 const applyAndLaunchCycle = useCallback(async (
 projectName: string,
 cycleId: string,
 ) => {
 const response = await api.applyWorkCycle(projectName, cycleId);
 const payload = await readJsonPayload<{ cycle?: { id: string }; sessionKey?: string; executionToken?: string; error?: { code: string; message: string } | string }>(response);
 if (!response.ok || !payload) {
 const errMsg = typeof payload?.error === 'string' ? payload.error : payload?.error?.message;
 throw new Error(errMsg || 'Failed to queue discovery plan apply');
 }
 if (payload.error) {
 const errMsg = typeof payload.error === 'string' ? payload.error : payload.error.message;
 throw new Error(errMsg);
 }

 refreshProjectsSilently();
 }, [refreshProjectsSilently]);

 const flashToast = useCallback((toastValue: MainContentToast, ms = 2400) => {
 setToast(toastValue);
 if (toastValue) {
 window.setTimeout(() => setToast(null), ms);
 }
 }, []);

 const getProjectSessions = useCallback((project: Project): ProjectSession[] =>
 project.sessions ?? [],
 []);

 const findSessionInProject = useCallback((project: Project, sessionId: string) => (
 getProjectSessions(project).find((session) => session.id === sessionId)
 ), [getProjectSessions]);

 const loadPilotDeckSession = useCallback(async (projectName: string, sessionId: string) => {
 const response = await api.sessions(projectName, Number.MAX_SAFE_INTEGER, 0);
 if (!response.ok) {
 return null;
 }
 const payload = await readJsonPayload<{ sessions?: ProjectSession[] }>(response);
 return payload?.sessions?.find((session) => session.id === sessionId) ?? null;
 }, []);

 const handleOpenAlwaysOnSession = useCallback(async (target: AlwaysOnSessionTarget) => {
 if (!selectedProject) {
 return;
 }

 const missingMessage = i18n.t('alwaysOn:sessionMissing', {
 defaultValue: 'This chat record no longer exists.',
 });

 if (target.kind === 'origin') {
 const lookupProjectName = target.projectName || selectedProject.name;
 const targetProject =
 target.projectName && target.projectName !== selectedProject.name
 ? projects.find((p) => p.name === target.projectName) ?? selectedProject
 : selectedProject;

 const existingSession =
 findSessionInProject(targetProject, target.sessionId) ??
 await loadPilotDeckSession(lookupProjectName, target.sessionId);

 if (!existingSession) {
 flashToast({ kind: 'error', text: missingMessage });
 return;
 }

 const fallbackSession: ProjectSession = {
 ...existingSession,
 __projectName: lookupProjectName,
 };

 setActiveTab('chat');
 if (onSelectSession) {
 onSelectSession(targetProject, target.sessionId, fallbackSession);
 return;
 }
 onNavigateToSession(target.sessionId);
 return;
 }

 const existingSession =
 findSessionInProject(selectedProject, target.sessionId) ??
 await loadPilotDeckSession(selectedProject.name, target.sessionId);

 if (!existingSession) {
 flashToast({ kind: 'error', text: missingMessage });
 return;
 }

 const fallbackSession: ProjectSession = {
 ...existingSession,
 id: target.sessionId,
 title: target.title || existingSession.title || existingSession.summary || target.summary,
 summary: target.summary || existingSession.summary || existingSession.title || target.title,
 lastActivity: target.lastActivity || existingSession.lastActivity,
 sessionKind: 'background_task',
 parentSessionId: target.parentSessionId,
 relativeTranscriptPath: target.relativeTranscriptPath,
 transcriptKey: target.transcriptKey || existingSession.transcriptKey,
 taskId: target.taskId || existingSession.taskId,
 taskStatus: target.taskStatus || existingSession.taskStatus,
 outputFile: target.outputFile || existingSession.outputFile,
 isReadOnly: true,
 __projectName: selectedProject.name,
 };

 setActiveTab('chat');
 if (onSelectSession) {
 onSelectSession(selectedProject, target.sessionId, fallbackSession);
 return;
 }
 onNavigateToSession(target.sessionId);
 }, [
 findSessionInProject,
 flashToast,
 i18n,
 loadPilotDeckSession,
 onNavigateToSession,
 onSelectSession,
 projects,
 selectedProject,
 setActiveTab,
 ]);

 const handleOpenExecutionSession = useCallback(
 (projectKey: string, runId: string, projectName?: string) => {
 const rawId = `always-on/execute:project=${projectKey}:run=${runId}`;
 const sessionId = rawId.replace(/[\\/]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
 void handleOpenAlwaysOnSession({ kind: 'origin', sessionId, projectName });
 },
 [handleOpenAlwaysOnSession],
 );

 if (isLoading) {
 return (
 <MainContentStateView
 mode="loading"
 isMobile={isMobile}
 onMenuClick={onMenuClick}
 />
 );
 }

 // >>> pilotdeck-fork: capability-hub
 if (!selectedProject && activeTab !== 'dashboard' && activeTab !== 'discover') {
 // <<< pilotdeck-fork: capability-hub
 return (
 <MainContentStateView
 mode="empty"
 isMobile={isMobile}
 onMenuClick={onMenuClick}
 />
 );
 }

 return (
 <RightWorkspaceRailProvider
   selectedProject={selectedProject}
   selectedSessionId={selectedSession?.id ?? null}
 >
 <MainContentBody
 projects={projects}
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 activeTab={activeTab}
 setActiveTab={setActiveTab}
 alwaysOnSubTab={alwaysOnSubTab}
 onAlwaysOnSubTabChange={onAlwaysOnSubTabChange}
 ws={ws}
 sendMessage={trackedSendMessage}
 latestMessage={latestMessage}
 isMobile={isMobile}
 onMenuClick={onMenuClick}
 isLoading={isLoading}
 onInputFocusChange={onInputFocusChange}
 onSessionActive={onSessionActive}
 onSessionInactive={onSessionInactive}
 onSessionProcessing={onSessionProcessing}
 onSessionNotProcessing={onSessionNotProcessing}
 onExecutionStatusChange={onExecutionStatusChange}
 onSessionAttentionChange={onSessionAttentionChange}
 onSessionActivityBump={onSessionActivityBump}
 processingSessions={processingSessions}
 onReplaceTemporarySession={onReplaceTemporarySession}
 onNavigateToSession={onNavigateToSession}
 onShowSettings={onShowSettings}
 onSelectProjectByName={onSelectProjectByName}
 externalMessageUpdate={externalMessageUpdate}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 processDetailLevel={processDetailLevel}
 autoScrollToBottom={autoScrollToBottom}
 sendByCtrlEnter={sendByCtrlEnter}
 shouldShowTasksTab={shouldShowTasksTab}
 tasksEnabled={tasksEnabled}
 applyAndLaunchCycle={applyAndLaunchCycle}
 handleOpenExecutionSession={handleOpenExecutionSession}
 onStartNewSession={onStartNewSession}
 filesNavTarget={filesNavTarget}
 handleOpenTaskFolder={handleOpenTaskFolder}
 editingFile={editingFile}
 editorWidth={editorWidth}
 splitChatWidth={splitChatWidth}
 workspaceRailWidth={workspaceRailWidth}
 onWorkspaceRailWidthChange={setWorkspaceRailWidth}
 editorExpanded={editorExpanded}
 hasManualWidth={hasManualWidth}
 resizeHandleRef={resizeHandleRef}
 handleFileOpen={handleFileOpen}
 handleCloseEditor={handleCloseEditor}
 handleToggleEditorExpand={handleToggleEditorExpand}
 handleResizeStart={handleResizeStart}
 handleDesignCanvasEditDock={handleDesignCanvasEditDock}
 toast={toast}
 />
 </RightWorkspaceRailProvider>
 );
}

type MainContentBodyProps = MainContentProps & {
 shouldShowTasksTab: boolean;
 tasksEnabled: boolean;
 applyAndLaunchCycle: (projectName: string, cycleId: string) => Promise<void>;
 handleOpenExecutionSession: (projectKey: string, runId: string, projectName?: string) => void;
 filesNavTarget: FilesNavigationTarget | null;
 handleOpenTaskFolder: (items: DeliverableItem[]) => void;
 editingFile: CodeEditorFile | null;
 editorWidth: number;
 splitChatWidth: number | null;
 workspaceRailWidth: number;
 onWorkspaceRailWidthChange: (width: number) => void;
 editorExpanded: boolean;
 hasManualWidth: boolean;
 resizeHandleRef: React.MutableRefObject<HTMLDivElement | null>;
 handleFileOpen: (filePath: string, diffInfo?: CodeEditorDiffInfo | FileOpenOptions | null) => void;
 handleCloseEditor: () => void;
 handleToggleEditorExpand: () => void;
 handleResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
 handleDesignCanvasEditDock: () => void;
 toast: MainContentToast;
};

function MainContentBody({
 projects,
 selectedProject,
 selectedSession,
 activeTab,
 setActiveTab,
 alwaysOnSubTab = 'dashboard',
 onAlwaysOnSubTabChange,
 ws,
 sendMessage,
 latestMessage,
 isMobile,
 onInputFocusChange,
 onSessionActive,
 onSessionInactive,
 onSessionProcessing,
 onSessionNotProcessing,
 onExecutionStatusChange,
 onSessionAttentionChange,
 onSessionActivityBump,
 processingSessions,
 onReplaceTemporarySession,
 onNavigateToSession,
 onShowSettings,
 onSelectProjectByName,
 externalMessageUpdate,
 autoExpandTools,
 showRawParameters,
 showThinking,
 processDetailLevel,
 autoScrollToBottom,
 sendByCtrlEnter,
 shouldShowTasksTab,
 tasksEnabled,
 applyAndLaunchCycle,
 handleOpenExecutionSession,
 onStartNewSession,
 filesNavTarget,
 handleOpenTaskFolder,
 editingFile,
 editorWidth,
 splitChatWidth,
 workspaceRailWidth,
 onWorkspaceRailWidthChange,
 editorExpanded,
 hasManualWidth,
 resizeHandleRef,
 handleFileOpen,
 handleCloseEditor,
 handleToggleEditorExpand,
 handleResizeStart,
 handleDesignCanvasEditDock,
 toast,
}: MainContentBodyProps) {
 const rightRail = useRightWorkspaceRail();
 const filesTabDrawerInitRef = useRef(false);
 const preflightRequest = rightRail?.preflightRequest ?? null;
 const runtimeFlags = useRuntimeFeatureFlags();

 useEffect(() => {
   if (!isPreflightStudioEnabled() || !rightRail) return undefined;
   return subscribePreflightStudio((request) => {
     rightRail.openPreflightStudio(request);
   });
 }, [rightRail, runtimeFlags]);

 useEffect(() => {
   if (preflightRequest) {
     handleCloseEditor();
   }
 }, [preflightRequest, handleCloseEditor]);

 useEffect(() => {
   if (activeTab !== 'files') {
     filesTabDrawerInitRef.current = false;
     return;
   }
   if (isMobile || !selectedProject || !rightRail || filesTabDrawerInitRef.current) return;
   filesTabDrawerInitRef.current = true;
   rightRail.setRailPanel('files');
   rightRail.setRailOpen(true);
   rightRail.openTaskFolder?.([]);
 }, [activeTab, isMobile, rightRail, selectedProject]);

 const handleOpenTaskFolderInDrawer = useCallback((items: DeliverableItem[]) => {
   if (rightRail?.openTaskFolder) {
     rightRail.openTaskFolder(items);
     return;
   }
   handleOpenTaskFolder(items);
 }, [handleOpenTaskFolder, rightRail]);

 const handleChatFileOpen = useCallback((
   filePath: string,
   diffInfo?: CodeEditorDiffInfo | FileOpenOptions | null,
 ) => {
   rightRail?.closePreflightStudio();
   if (!selectedProject) {
     handleFileOpen(filePath, diffInfo);
     return;
   }
   const hintDir = diffInfo && typeof diffInfo === 'object' && 'hintDir' in diffInfo
     ? (diffInfo as FileOpenOptions).hintDir
     : undefined;
   const fileName = filePath.split('/').pop() || filePath;
   const bentoOptions = buildBentoFileOpenOptions(fileName, filePath, {
     hintDir,
     bentoStudioMode: 'edit',
   });
   handleFileOpen(filePath, {
     ...((diffInfo && typeof diffInfo === 'object') ? diffInfo : {}),
     ...(bentoOptions ?? { initialPreview: true }),
     hintDir,
   } as FileOpenOptions);
 }, [handleFileOpen, rightRail, selectedProject]);

 const chatOnFileOpen = activeTab === 'chat' ? handleChatFileOpen : handleFileOpen;
 const drawerReservedWidth = !isMobile && rightRail?.railOpen ? workspaceRailWidth : 0;
 const desktopSplitPreview = Boolean(editingFile || preflightRequest) && !isMobile && (activeTab === 'chat' || activeTab === 'files');

 return (
 <div className="relative flex h-full flex-col bg-background text-foreground">
 <div className="relative flex min-h-0 flex-1 overflow-hidden">
 <div
 className="flex min-h-0 min-w-0 flex-1 overflow-hidden transition-[padding] duration-300 ease-out"
 style={drawerReservedWidth > 0 ? { paddingRight: drawerReservedWidth } : undefined}
 data-testid="main-split-workspace"
 >
 <SplitBody
 projects={projects}
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 activeTab={activeTab}
 shouldShowTasksTab={shouldShowTasksTab}
 tasksEnabled={tasksEnabled}
 setActiveTab={setActiveTab}
 alwaysOnSubTab={alwaysOnSubTab}
 onAlwaysOnSubTabChange={onAlwaysOnSubTabChange}
 ws={ws}
 sendMessage={sendMessage}
 latestMessage={latestMessage}
 handleFileOpen={chatOnFileOpen}
 onOpenTaskFolder={rightRail?.openTaskFolder ?? handleOpenTaskFolderInDrawer}
 filesNavTarget={filesNavTarget}
 onInputFocusChange={onInputFocusChange}
 onSessionActive={onSessionActive}
 onSessionInactive={onSessionInactive}
 onSessionProcessing={onSessionProcessing}
 onSessionNotProcessing={onSessionNotProcessing}
 onExecutionStatusChange={onExecutionStatusChange}
 onSessionAttentionChange={onSessionAttentionChange}
 onSessionActivityBump={onSessionActivityBump}
 processingSessions={processingSessions}
 onReplaceTemporarySession={onReplaceTemporarySession}
 onNavigateToSession={onNavigateToSession}
 onShowSettings={onShowSettings}
 externalMessageUpdate={externalMessageUpdate}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 processDetailLevel={processDetailLevel}
 autoScrollToBottom={autoScrollToBottom}
 sendByCtrlEnter={sendByCtrlEnter}
 applyAndLaunchCycle={applyAndLaunchCycle}
 handleOpenExecutionSession={handleOpenExecutionSession}
 editorExpanded={editorExpanded}
 hasEditor={editingFile !== null || preflightRequest !== null}
 splitChatWidth={splitChatWidth}
 onSelectProjectByName={onSelectProjectByName}
 onStartNewSession={onStartNewSession}
 isMobile={isMobile}
 />

 {selectedProject && preflightRequest && (activeTab === 'chat' || activeTab === 'files') ? (
 <PreflightPreviewPanel
   request={preflightRequest}
   panelWidth={editorWidth}
   hasManualWidth={hasManualWidth}
   resizeHandleRef={resizeHandleRef}
   onResizeStart={handleResizeStart}
   onClose={() => rightRail?.closePreflightStudio()}
   onConfirmed={({ prompt, mode }) => {
     requestCapabilityTry(prompt);
     rightRail?.closePreflightStudio();
     if (mode === 'custom') return;
     const autoSubmit = preflightRequest.autoSubmitAfterConfirm;
     if (autoSubmit) {
       dispatchPreflightComposerSubmit();
     }
   }}
   fillSpace={desktopSplitPreview && !editorExpanded}
 />
 ) : selectedProject && editingFile && (activeTab === 'chat' || activeTab === 'files') ? (
 <EditorSidebar
 editingFile={editingFile}
 isMobile={isMobile}
 editorExpanded={editorExpanded}
 editorWidth={editorWidth}
 hasManualWidth={hasManualWidth}
 resizeHandleRef={resizeHandleRef}
 onResizeStart={handleResizeStart}
 onCloseEditor={handleCloseEditor}
 onToggleEditorExpand={handleToggleEditorExpand}
 onEditDockRequest={handleDesignCanvasEditDock}
 projectPath={selectedProject.fullPath || selectedProject.path}
 fillSpace={desktopSplitPreview && !editorExpanded}
 reservedRightWidth={0}
 workspaceDrawerOpen={Boolean(rightRail?.railOpen)}
 />
 ) : null}
 </div>
 {selectedProject && (activeTab === 'chat' || activeTab === 'files') ? (
 <RightWorkspaceRail
 selectedProject={selectedProject}
 selectedSessionId={selectedSession?.id ?? null}
 isMobile={isMobile}
 railWidth={workspaceRailWidth}
 onRailWidthChange={onWorkspaceRailWidthChange}
 onFileOpen={activeTab === 'chat' ? chatOnFileOpen : handleFileOpen}
 onOpenTaskFolder={rightRail?.openTaskFolder ?? handleOpenTaskFolderInDrawer}
 />
 ) : null}
 </div>
 {toast ? (
 <div
 className={cn(
 'pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-3 py-1.5 text-[12px] shadow-lg',
 toast.kind === 'error' && 'bg-red-600 text-primary-foreground',
 toast.kind === 'info' && 'bg-neutral-800 text-primary-foreground',
 )}
 >
 {toast.text}
 </div>
 ) : null}
 </div>
 );
}

// V2 split body: the Agent surface owns both the new-session welcome state
// and existing transcripts. Files can pair with Agent in split view; focused
// tools such as Always-On, Dashboard, Tasks, and Memory render full-screen.
type SplitBodyProps = {
 projects: Project[];
 selectedProject: Project | null;
 selectedSession: any;
 activeTab: string;
 shouldShowTasksTab: boolean;
 tasksEnabled: boolean;
 setActiveTab: (tab: any) => void;
 alwaysOnSubTab: MainContentProps['alwaysOnSubTab'];
 onAlwaysOnSubTabChange: MainContentProps['onAlwaysOnSubTabChange'];
 ws: any;
 sendMessage: any;
 latestMessage: any;
 handleFileOpen: (filePath: string, diffInfo?: CodeEditorDiffInfo | FileOpenOptions | null) => void;
 onOpenTaskFolder?: (items: DeliverableItem[]) => void;
 filesNavTarget?: FilesNavigationTarget | null;
 onInputFocusChange: any;
 onSessionActive: any;
 onSessionInactive: any;
 onSessionProcessing: any;
 onSessionNotProcessing: any;
 onExecutionStatusChange?: MainContentProps['onExecutionStatusChange'];
 onSessionAttentionChange?: MainContentProps['onSessionAttentionChange'];
 onSessionActivityBump?: (
 projectName: string,
 sessionId: string,
 optimisticTitle?: string,
 ) => void;
 processingSessions: any;
 onReplaceTemporarySession: any;
 onNavigateToSession: (sessionId: string) => void;
 onShowSettings: any;
 externalMessageUpdate: any;
 autoExpandTools: any;
 showRawParameters: any;
 showThinking: any;
 processDetailLevel: any;
 autoScrollToBottom: any;
 sendByCtrlEnter: any;
 applyAndLaunchCycle: (projectName: string, cycleId: string) => Promise<void>;
 handleOpenExecutionSession: (projectKey: string, runId: string, projectName?: string) => void;
 editorExpanded: boolean;
 hasEditor: boolean;
 splitChatWidth?: number | null;
 onSelectProjectByName?: (projectName: string) => void;
 onStartNewSession: (project: Project) => void;
 /** PD-SAAS-FORK: mobile renders Files tab as a single full-width pane. */
 isMobile?: boolean;
};

function SplitBody(props: SplitBodyProps) {
 const { t, i18n } = useTranslation();
 const {
 projects,
 selectedProject,
 selectedSession,
 activeTab,
 shouldShowTasksTab,
 tasksEnabled,
 setActiveTab,
 alwaysOnSubTab = 'dashboard',
 onAlwaysOnSubTabChange,
 ws,
 sendMessage,
 latestMessage,
 handleFileOpen,
 onOpenTaskFolder,
 filesNavTarget,
 onInputFocusChange,
 onSessionActive,
 onSessionInactive,
 onSessionProcessing,
 onSessionNotProcessing,
 onExecutionStatusChange,
 onSessionAttentionChange,
 onSessionActivityBump,
 processingSessions,
 onReplaceTemporarySession,
 onNavigateToSession,
 onShowSettings,
 externalMessageUpdate,
 autoExpandTools,
 showRawParameters,
 showThinking,
 processDetailLevel,
 autoScrollToBottom,
 sendByCtrlEnter,
 applyAndLaunchCycle,
 handleOpenExecutionSession,
 editorExpanded,
 hasEditor,
 splitChatWidth = null,
 onSelectProjectByName,
 onStartNewSession,
 isMobile = false,
 } = props;

 // Render-mode taxonomy:
 // - 'chat': Agent surface. No session shows the welcome composer;
 // existing sessions show the transcript.
 // - 'split': Files tab only. Chat on the left, file tree/editor on right.
 // - 'tool': Always-On / Dashboard / Memory / Tasks / Shell / Git /
 // plugin tabs. Tool fills the whole main area, no chat
 // alongside — matches the legacy single-pane layout users
 // expect when they tab into a focused tool.
 //
 // Note: Shell + Git aren't surfaced in the V2 top tab bar (see TABS in
 // MainAreaV2.tsx) but plugins / programmatic activeTab values still hit
 // those code paths, so we keep them here as full-screen tool views.
 const isPlugin = typeof activeTab === 'string' && activeTab.startsWith('plugin:');
 const fullScreenToolTabs = new Set([
 'shell',
 'git',
 'always-on',
 'dashboard',
 'memory',
 // >>> pilotdeck-fork: capability-hub
 'discover',
 // <<< pilotdeck-fork: capability-hub
 'tasks',
 ]);
 const isFullScreenTool = fullScreenToolTabs.has(activeTab) || isPlugin;
 // Tasks tab is conditional — fall back to chat if the project hasn't
 // enabled it yet so we don't render a black hole.
 const renderTasksAsTool = activeTab === 'tasks' && shouldShowTasksTab;
 const isFiles = activeTab === 'files';
 const filesSplitContainerRef = useRef<HTMLDivElement | null>(null);
 const [filesChatWidth, setFilesChatWidth] = useState(FILES_CHAT_DEFAULT_WIDTH);
 const [isFilesSplitResizing, setIsFilesSplitResizing] = useState(false);

 const clampFilesChatWidth = useCallback((width: number, containerWidth: number) => {
 const maxWidth = Math.max(FILES_CHAT_MIN_WIDTH, containerWidth - FILES_TREE_MIN_WIDTH);
 return Math.min(Math.max(width, FILES_CHAT_MIN_WIDTH), maxWidth);
 }, []);

 useEffect(() => {
 if (!isFiles || !isMobile) return;
 const container = filesSplitContainerRef.current;
 if (!container) return;
 const containerWidth = container.getBoundingClientRect().width;
 if (hasEditor) {
 setFilesChatWidth(FILES_CHAT_DEFAULT_WIDTH);
 } else {
 setFilesChatWidth(Math.max(FILES_CHAT_MIN_WIDTH, containerWidth - FILES_TREE_ONLY_WIDTH));
 }
 }, [hasEditor, isFiles]);

 const handleFilesSplitResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
 if (!isFiles || !isMobile) {
 return;
 }

 setIsFilesSplitResizing(true);
 event.preventDefault();
 }, [isFiles]);

 useEffect(() => {
 if (!isFilesSplitResizing) {
 return undefined;
 }

 const handleMouseMove = (event: globalThis.MouseEvent) => {
 const container = filesSplitContainerRef.current;
 if (!container) {
 return;
 }

 const rect = container.getBoundingClientRect();
 setFilesChatWidth(clampFilesChatWidth(event.clientX - rect.left, rect.width));
 };

 const handleMouseUp = () => {
 setIsFilesSplitResizing(false);
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
 }, [clampFilesChatWidth, isFilesSplitResizing]);

 const isDiscover = activeTab === 'discover';
 const [discoverMounted, setDiscoverMounted] = useState(false);

 useEffect(() => {
 if (isDiscover) {
 setDiscoverMounted(true);
 }
 }, [isDiscover]);

 useEffect(() => {
 if (!discoverMounted) return;
 primeProcessTemplatesCache(i18n.language);
 }, [discoverMounted, i18n.language]);

 // PD-SAAS-FORK: warm secondary tab chunks after chat shell paints (files/discover stay eager).
 useEffect(() => {
 prefetchSecondaryMainTabs();
 }, []);

 const handleDiscoverTryPrompt = useCallback(
 (prompt: string, capability?: CapabilityBindingContext) => {
 if (!selectedProject) return;
 const handlers = {
 onNeedNewSession: () => onStartNewSession?.(selectedProject),
 onSwitchToChat: () => setActiveTab('chat'),
 };
 if (capability?.slug) {
 requestCapabilityLaunch({
 slug: capability.slug,
 displayName: capability.displayName,
 launchMode: capability.launchMode,
 prompt,
 capability,
 handlers,
 });
 } else {
 requestCapabilityTry(prompt, capability, handlers);
 }
 },
 [onStartNewSession, selectedProject, setActiveTab],
 );

 const renderTool = () => {
 if (activeTab === 'shell') {
 return (
 <MainTabSuspense>
 <LazyShellV2
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 isActive
 />
 </MainTabSuspense>
 );
 }
 if (activeTab === 'git') {
 return (
 <MainTabSuspense>
 <LazyGitV2 selectedProject={selectedProject} onFileOpen={handleFileOpen} />
 </MainTabSuspense>
 );
 }
 if (activeTab === 'always-on') {
 return (
 <MainTabSuspense>
 <LazyAlwaysOnV2
 selectedProject={selectedProject}
 subTab={alwaysOnSubTab}
 onSubTabChange={onAlwaysOnSubTabChange ?? (() => undefined)}
 onApplyWorkCycle={applyAndLaunchCycle}
 onOpenExecutionSession={handleOpenExecutionSession}
 />
 </MainTabSuspense>
 );
 }
 if (activeTab === 'dashboard') {
 return (
 <MainTabSuspense>
 <LazyDashboardV2
 projectFilter={selectedProject?.name}
 projectFullPath={selectedProject?.fullPath}
 onSelectProject={onSelectProjectByName}
 />
 </MainTabSuspense>
 );
 }
 if (activeTab === 'memory') {
 return (
 <MainTabSuspense>
 <LazyMemoryPanel selectedProject={selectedProject} />
 </MainTabSuspense>
 );
 }
 // >>> pilotdeck-fork: capability-hub
 // discover 由下方 keep-alive 容器渲染，避免切 Tab 后状态丢失
 // <<< pilotdeck-fork: capability-hub
 if (renderTasksAsTool) {
 return (
 <MainTabSuspense>
 <LazyTasksV2 isVisible />
 </MainTabSuspense>
 );
 }
 if (isPlugin) {
 return (
 <MainTabSuspense>
 <LazyPluginTabContent
 pluginName={activeTab.replace('plugin:', '')}
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 />
 </MainTabSuspense>
 );
 }
 return null;
 };

 const showFullScreenTool = isFullScreenTool && (activeTab !== 'tasks' || shouldShowTasksTab);
 const showChat = !showFullScreenTool;
 const useMobileFilesSplit = isFiles && showChat && isMobile;
 // PD-SAAS-FORK: on phones the Files tab is a single full-width read-only
 // browser — the chat pane stays mounted but hidden, and there is no
 // drag-to-resize split.
 const chatPaneVisible = showChat && !(isFiles && isMobile);
 const isDesktopSplitPreview = hasEditor && !isMobile && (activeTab === 'chat' || activeTab === 'files');

 return (
 <div
 ref={useMobileFilesSplit ? filesSplitContainerRef : undefined}
 className={cn(
 'flex min-h-0 min-w-0 overflow-hidden',
 editorExpanded && 'hidden',
 isDesktopSplitPreview
   ? splitChatWidth != null
     ? 'min-w-[320px] flex-shrink-0'
     : 'w-[min(720px,40%)] max-w-[720px] min-w-[320px] flex-shrink-0'
   : 'flex-1',
 )}
 style={
   isDesktopSplitPreview && splitChatWidth != null
     ? { width: `${splitChatWidth}px` }
     : undefined
 }
 >
 {/* Full-screen tool surface (Memory, Dashboard, Always-On, etc.) */}
 {showFullScreenTool && !isDiscover && (
 <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
 {renderTool()}
 </div>
 )}

 {/* >>> pilotdeck-fork: capability-hub
 能力中心 + 流程模板（与输入框「模板」弹层一致）keep-alive */}
 {discoverMounted ? (
 <div
 className={cn(
 'flex min-w-0 flex-col overflow-hidden',
 isDiscover
 ? 'h-full w-full flex-1'
 : 'invisible absolute h-0 w-0 overflow-hidden',
 )}
 aria-hidden={!isDiscover}
 >
 <TemplatesHubPanel
 variant="page"
 selectedProject={selectedProject}
 onTryPrompt={handleDiscoverTryPrompt}
 />
 </div>
 ) : null}
 {/* <<< pilotdeck-fork: capability-hub */}

 {/* Agent surface — kept mounted even when a full-screen tool is active
 so that the session store, WebSocket subscriptions, and streaming
 state survive tab switches. Hidden via CSS to avoid layout cost. */}
 <div
 className={cn(
 'flex min-h-0 min-w-0 flex-col',
 chatPaneVisible
 ? (useMobileFilesSplit ? 'flex-shrink-0' : 'flex-1 min-w-0')
 : 'invisible absolute h-0 w-0 overflow-hidden',
 )}
 style={useMobileFilesSplit
 ? {
 minWidth: `${FILES_CHAT_MIN_WIDTH}px`,
 width: `min(${filesChatWidth}px, calc(100% - ${FILES_TREE_MIN_WIDTH}px))`,
 }
 : undefined}
 aria-hidden={!chatPaneVisible}
 >
 <ErrorBoundary showDetails>
 <ChatInterfaceV2
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 ws={ws}
 sendMessage={sendMessage}
 latestMessage={latestMessage}
 onFileOpen={handleFileOpen}
 onOpenTaskFolder={onOpenTaskFolder}
 onInputFocusChange={onInputFocusChange}
 onSessionActive={onSessionActive}
 onSessionInactive={onSessionInactive}
 onSessionProcessing={onSessionProcessing}
 onSessionNotProcessing={onSessionNotProcessing}
 onExecutionStatusChange={onExecutionStatusChange}
 onSessionAttentionChange={onSessionAttentionChange}
 onSessionActivityBump={onSessionActivityBump}
 processingSessions={processingSessions}
 onReplaceTemporarySession={onReplaceTemporarySession}
 onNavigateToSession={onNavigateToSession}
 onShowSettings={onShowSettings}
 autoExpandTools={autoExpandTools}
 showRawParameters={showRawParameters}
 showThinking={showThinking}
 processDetailLevel={processDetailLevel}
 autoScrollToBottom={autoScrollToBottom}
 sendByCtrlEnter={sendByCtrlEnter}
 externalMessageUpdate={externalMessageUpdate}
 onShowAllTasks={tasksEnabled ? () => setActiveTab('tasks') : null}
 forceWelcome={false}
 onExitWelcome={() => setActiveTab('chat')}
 onOpenDiscoverTab={() => setActiveTab('discover')}
 onStartNewSession={onStartNewSession}
 />
 </ErrorBoundary>
 </div>

 {/* Right half — only mounted when the user is on Files (chat-paired
 file tree + editor). */}
 {isFiles && showChat && isMobile ? (
 <>
 {!isMobile ? (
 <div
 onMouseDown={handleFilesSplitResizeStart}
 className="group relative z-10 w-px flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-neutral-400 dark:hover:bg-neutral-600"
 title={t('resize.dragToResizePanel')}
 >
 <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
 <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-neutral-600" />
 </div>
 ) : null}
 <div
 className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
 style={isMobile ? undefined : { minWidth: `${FILES_TREE_MIN_WIDTH}px` }}
 >
 <FilesSplitMiddlePanel
 key={`${selectedProject?.name ?? ''}:${selectedSession?.id ?? 'no-session'}`}
 selectedProject={selectedProject}
 selectedSessionId={selectedSession?.id ?? null}
 onFileOpen={handleFileOpen}
 navigationTarget={filesNavTarget}
 onClose={() => setActiveTab('chat')}
 onOpenTaskFolder={onOpenTaskFolder}
 />
 </div>
 </>
 ) : null}
 </div>
 );
}

export default React.memo(MainContent);
