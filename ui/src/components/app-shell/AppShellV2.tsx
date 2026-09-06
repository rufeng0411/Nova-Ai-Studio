import { useCallback, useEffect, useRef, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useMobileShell } from '../../hooks/useMobileShell';
import { isMobileRoutePath, resolveAppPath, stripMobileRoutePrefix } from '../../mobile/mobileRoute';
// PD-SAAS-FORK: strip /app-1.1-beta so matchPath('/p/...') works inside Beta (no-op on /app)
import { stripWorkbenchBetaPrefix } from '../../saas/workbench-beta/betaRoute';
import { useSessionProtection } from '../../hooks/useSessionProtection';
import { useProjectsState } from '../../hooks/useProjectsState';
import Settings from '../settings/view/Settings';
import ProjectCreationWizard from '../project-creation-wizard';
import { isSameSessionId } from '../../shared/sessionId';
import {
  type SessionSidebarAttention,
  isInterruptedPauseReason,
  patchSessionAttentionSet,
} from '../../shared/sessionSidebarAttention';
import SaasCreateProjectDialog from '../../saas/projects/SaasCreateProjectDialog';
import { normalizeProjectForSettings, type SettingsProject } from '../../lib/projectSettings';
import {
 sessionDisplayTitle,
 setSessionCustomTitle,
} from '../../lib/customNames';
import {
 clearSessionSidebarState,
 isSessionSidebarLocked,
} from '../../lib/sessionSidebarState';
import {
 getSessionRequestParams,
 isBackgroundTaskSession,
 type AppTab,
 type Project,
 type ProjectSession,
 type SessionProvider,
} from '../../types/app';
import { api } from '../../utils/api';
import { IS_SAAS_MODE } from '../../constants/config';
import SidebarV2 from './SidebarV2';
import MainAreaV2 from './MainAreaV2';
// PD-SAAS-FORK: mobile keyboard avoidance (visualViewport -> --vvh)
import { useMobileViewport } from '../../mobile/useMobileViewport';
import LaunchSheetHost from '../launch/LaunchSheetHost.js';
import WorkbenchMdDropHost from '../md-browser/WorkbenchMdDropHost.js';
import N2BotOverlayHost from '../../saas/n2-bot/N2BotOverlayHost';
import SidebarDeleteDialog from './SidebarDeleteDialog';
// PD-SAAS-FORK: optional marketing homepage atmosphere on workbench (instant localStorage rollback)
import WorkbenchSiteAtmosphere from './WorkbenchSiteAtmosphere';
import {
  installWorkbenchSiteAtmosphereDevHelpers,
  isWorkbenchSiteAtmosphereEnabled,
  subscribeWorkbenchSiteAtmosphere,
} from '../../shared/workbenchSiteAtmosphere';

type TypedSettingsProps = {
 isOpen: boolean;
 onClose: () => void;
 projects: SettingsProject[];
 initialTab: string;
};

const SettingsComponent = Settings as unknown as (props: TypedSettingsProps) => JSX.Element;

const UNREAD_IGNORED_MESSAGE_TYPES = new Set([
 'websocket-reconnected',
 'pending-permissions-response',
 'session-status',
]);

const UNREAD_IGNORED_MESSAGE_KINDS = new Set([
 'session_created',
 'status',
 'stream_end',
]);

const getSessionIdFromMessage = (message: unknown): string | null => {
 if (!message || typeof message !== 'object') return null;
 const candidate = message as {
 sessionId?: unknown;
 session_id?: unknown;
 newSessionId?: unknown;
 actualSessionId?: unknown;
 };
 const value =
 candidate.sessionId ??
 candidate.session_id ??
 candidate.actualSessionId ??
 candidate.newSessionId;
 return typeof value === 'string' && value.trim() ? value : null;
};

const isUnreadWorthyMessage = (message: unknown): boolean => {
 if (!message || typeof message !== 'object') return false;
 const candidate = message as { kind?: unknown; type?: unknown };

 if (typeof candidate.kind === 'string') {
 return !UNREAD_IGNORED_MESSAGE_KINDS.has(candidate.kind);
 }

 if (typeof candidate.type === 'string') {
 return !UNREAD_IGNORED_MESSAGE_TYPES.has(candidate.type);
 }

 return false;
};

// V2 shell. Reuses the same data hooks as legacy AppContent so chat, discovery,
// auth, and project plumbing keep working unchanged — V2 just reorganizes the
// outer chrome (sidebar + breadcrumb header per prototype/shadcn.html).
export default function AppShellV2() {
 const navigate = useAppNavigate();
 const location = useLocation();
 // Match the four V2 URL shapes and hoist params up. `/m` then `/app-1.1-beta`
 // are stripped so the same patterns work for desktop, mobile, and Beta namespaces.
 const canonicalPath = stripWorkbenchBetaPrefix(stripMobileRoutePrefix(location.pathname));
 const matchProjectChat = matchPath('/p/:projectName/c/:sessionId', canonicalPath);
 const matchProject = matchPath('/p/:projectName', canonicalPath);
 const matchLegacySession = matchPath('/session/:sessionId', canonicalPath);
 const projectNameParam =
 matchProjectChat?.params.projectName ?? matchProject?.params.projectName ?? undefined;
 const sessionId =
 matchProjectChat?.params.sessionId ?? matchLegacySession?.params.sessionId ?? undefined;
 const { t } = useTranslation();

 const isMobile = useMobileShell();
 // PD-SAAS-FORK: keep --vvh in sync so the shell shrinks above the soft keyboard.
 useMobileViewport(isMobile);
 // PD-SAAS-FORK: homepage atmosphere preview — localStorage / ?siteAtmosphere=0 秒级回退
 const [siteAtmosphereOn, setSiteAtmosphereOn] = useState(() => isWorkbenchSiteAtmosphereEnabled());
 useEffect(() => {
  installWorkbenchSiteAtmosphereDevHelpers();
  setSiteAtmosphereOn(isWorkbenchSiteAtmosphereEnabled());
  return subscribeWorkbenchSiteAtmosphere(() => {
   setSiteAtmosphereOn(isWorkbenchSiteAtmosphereEnabled());
  });
 }, []);
 const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
 const { ws, sendMessage, latestMessage, isConnected, subscribe } = useWebSocket();
 const wasConnectedRef = useRef(false);
 const [unreadSessionIds, setUnreadSessionIds] = useState<Set<string>>(() => new Set());
 const [needsUserInputSessionIds, setNeedsUserInputSessionIds] = useState<Set<string>>(() => new Set());
 const [interruptedSessionIds, setInterruptedSessionIds] = useState<Set<string>>(() => new Set());

 const {
 activeSessions,
 processingSessions,
 markSessionAsActive,
 markSessionAsInactive,
 markSessionAsProcessing,
 markSessionAsNotProcessing,
 clearProcessingSessions,
 replaceTemporarySession,
 } = useSessionProtection();

 const {
 selectedProject,
 selectedSession,
 activeTab,
 sidebarOpen,
 isLoadingProjects,
 externalMessageUpdate,
 setActiveTab,
 setSelectedSession,
 setSidebarOpen,
 setIsInputFocused,
 setShowSettings,
 openSettings,
 refreshProjectsSilently,
 upsertCreatedProject,
 sidebarSharedProps,
 handleProjectSelect,
 handleSessionSelect,
 selectProjectAndSession,
 handleNewSession,
 handleDeselectProject,
 handleResetProjectSessionPreview,
 setSelectedProject,
 loadMoreSessions,
 loadOlderSessions,
 loadingMoreProjectIds,
 bumpSessionActivity,
 replaceOptimisticInProjects,
 dropOptimisticInProjects,
 patchSessionExecutionStatus,
 } = useProjectsState({
 sessionId,
 navigate,
 latestMessage,
 isMobile,
 activeSessions,
 });

 // Sync URL projectName -> selectedProject for deep links like /p/:projectName.
 // When the URL also carries a session id (/p/.../c/:sessionId or
 // /session/:sessionId) we let useProjectsState own the resolution because
 // it sets BOTH the project and the session in one effect, avoiding a race
 // where this hook would clear the session via handleProjectSelect.
 useEffect(() => {
 if (!projectNameParam) return;
 if (sessionId) return;
 if (selectedProject?.name === projectNameParam) return;
 const target = sidebarSharedProps.projects.find((p) => p.name === projectNameParam);
 if (target) {
 handleProjectSelect(target);
 // handleProjectSelect unconditionally navigates to '/' — put the URL back.
 navigate(`/p/${encodeURIComponent(projectNameParam)}`, { replace: true });
 }
 }, [
 projectNameParam,
 sessionId,
 selectedProject?.name,
 sidebarSharedProps.projects,
 handleProjectSelect,
 navigate,
 ]);

 // Default selection: prefer a project named "general" so the project-centric
 // sidebar always has something useful surfaced. Falls back to the first
 // project when "general" is missing. Runs only when there's no URL hint and
 // no current selection — never overrides user navigation.
 const didDefaultProjectRef = useRef(false);
 useEffect(() => {
 if (didDefaultProjectRef.current) return;
 if (isLoadingProjects) return;
 if (selectedProject) {
 didDefaultProjectRef.current = true;
 return;
 }
 if (projectNameParam || sessionId) {
 didDefaultProjectRef.current = true;
 return;
 }
 if (sidebarSharedProps.projects.length === 0) return;
 const general = sidebarSharedProps.projects.find(
 (p) => p.name === 'general' || p.displayName === 'general',
 );
 const target = general ?? sidebarSharedProps.projects[0];
 handleProjectSelect(target);
 navigate(`/p/${encodeURIComponent(target.name)}`, { replace: true });
 didDefaultProjectRef.current = true;
 }, [
 isLoadingProjects,
 selectedProject,
 projectNameParam,
 sessionId,
 sidebarSharedProps.projects,
 handleProjectSelect,
 navigate,
 ]);

 useEffect(() => {
 window.refreshProjects = refreshProjectsSilently;
 return () => {
 if (window.refreshProjects === refreshProjectsSilently) {
 delete window.refreshProjects;
 }
 };
 }, [refreshProjectsSilently]);

 useEffect(() => {
 window.openSettings = openSettings;
 return () => {
 if (window.openSettings === openSettings) {
 delete window.openSettings;
 }
 };
 }, [openSettings]);

 // Resolve a project by name (exact match first, then case-insensitive on
 // both the directory name and the user-facing displayName, then a relaxed
 // case-insensitive substring) and select it via the same handler the
 // sidebar uses, so the chat slash command `/switch-project xxx` can hop
 // between projects without a manual click.
 const switchProject = useCallback(
 (projectName: string): boolean => {
 const trimmed = (projectName ?? '').trim();
 if (!trimmed) return false;

 const list = sidebarSharedProps.projects;
 const exact = list.find((p) => p.name === trimmed);
 const ciExact =
 exact ??
 list.find(
 (p) =>
 p.name.toLowerCase() === trimmed.toLowerCase() ||
 (p.displayName ?? '').toLowerCase() === trimmed.toLowerCase(),
 );
 const fuzzy =
 ciExact ??
 list.find(
 (p) =>
 p.name.toLowerCase().includes(trimmed.toLowerCase()) ||
 (p.displayName ?? '').toLowerCase().includes(trimmed.toLowerCase()),
 );
 const target = fuzzy;
 if (!target) return false;

 handleProjectSelect(target);
 navigate(`/p/${encodeURIComponent(target.name)}`);
 return true;
 },
 [handleProjectSelect, navigate, sidebarSharedProps.projects],
 );

 useEffect(() => {
 window.switchProject = switchProject;
 return () => {
 if (window.switchProject === switchProject) {
 delete window.switchProject;
 }
 };
 }, [switchProject]);

 useEffect(() => {
 const selectedSessionId = selectedSession?.id;
 if (!selectedSessionId) return;

 setUnreadSessionIds((previous) => {
 if (!previous.has(selectedSessionId)) return previous;
 const next = new Set(previous);
 next.delete(selectedSessionId);
 return next;
 });
 }, [selectedSession?.id]);

 useEffect(() => {
 return subscribe((message) => {
 if (!isUnreadWorthyMessage(message)) return;

 const messageSessionId = getSessionIdFromMessage(message);
 if (!messageSessionId || messageSessionId === selectedSession?.id) return;

 setUnreadSessionIds((previous) => {
 if (previous.has(messageSessionId)) return previous;
 const next = new Set(previous);
 next.add(messageSessionId);
 return next;
 });
 });
 }, [selectedSession?.id, subscribe]);

 useEffect(() => {
 if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
 return undefined;
 }

 const handleServiceWorkerMessage = (event: MessageEvent) => {
 const message = event.data;
 if (!message || message.type !== 'notification:navigate') return;

 // Provider hint from notifications is no longer stored; all sessions
 // go through the unified pilotdeck gateway.

 setActiveTab('chat');
 setSidebarOpen(false);
 void refreshProjectsSilently();

 if (typeof message.sessionId === 'string' && message.sessionId) {
 navigate(`/session/${message.sessionId}`);
 return;
 }
 navigate('/');
 };

 navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
 return () => {
 navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
 };
 }, [navigate, refreshProjectsSilently, setActiveTab, setSidebarOpen]);

 useEffect(() => {
 const isReconnect = isConnected && !wasConnectedRef.current;
 if (isReconnect) {
 wasConnectedRef.current = true;
 // PD-SAAS-FORK: recover sidebar history if the first /api/projects raced gateway startup.
 clearProcessingSessions();
 void refreshProjectsSilently();
 sendMessage({ type: 'repair-turn-queue' });
 } else if (!isConnected) {
 wasConnectedRef.current = false;
 }

 if (isConnected && selectedSession?.id) {
 sendMessage({
 type: 'get-pending-permissions',
 sessionId: selectedSession.id,
 });
 }
 }, [isConnected, clearProcessingSessions, refreshProjectsSilently, selectedSession?.id, sendMessage]);

 // PD-SAAS-FORK: periodic turn-queue repair — not only on WS reconnect.
 useEffect(() => {
  if (!isConnected) return undefined;
  sendMessage({ type: 'repair-turn-queue' });
  const intervalMs = 5 * 60 * 1000;
  const timer = window.setInterval(() => {
   sendMessage({ type: 'repair-turn-queue' });
  }, intervalMs);
  return () => window.clearInterval(timer);
 }, [isConnected, sendMessage]);

 const onShowSettings = useCallback(() => setShowSettings(true), [setShowSettings]);
 const onCloseSettings = useCallback(() => setShowSettings(false), [setShowSettings]);
 const onMenuClick = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);
 const onCollapseSidebar = useCallback(() => {
 if (isMobile) {
 setSidebarOpen(false);
 } else {
 setDesktopSidebarOpen(false);
 }
 }, [isMobile, setSidebarOpen]);
 const onOpenDesktopSidebar = useCallback(() => setDesktopSidebarOpen(true), []);

 // Project creation wizard (local existing / new local / github clone). The
 // sidebar's Projects-section "+" opens this; row-level "+" is for new sessions.
 const [showNewProject, setShowNewProject] = useState(false);
 const handleOpenNewProject = useCallback(() => setShowNewProject(true), []);
 const handleCloseNewProject = useCallback(() => setShowNewProject(false), []);
 const handleProjectCreated = useCallback((project?: Record<string, unknown>) => {
 setShowNewProject(false);
 const created = upsertCreatedProject(project);
 if (created) {
 handleNewSession(created);
 navigate(`/p/${encodeURIComponent(created.name)}`);
 setActiveTab('chat');
 }
 void refreshProjectsSilently();
 }, [handleNewSession, navigate, refreshProjectsSilently, setActiveTab, upsertCreatedProject]);

 // Project deletion (V2): hover-revealed trash button on each row -> confirm dialog
 // -> DELETE /api/projects/:name (force=true). Reuses the shared cleanup callback
 // from useProjectsState to clear selection + redirect when the deleted project
 // was active.
 const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
 const [isDeletingProject, setIsDeletingProject] = useState(false);
 const [deleteError, setDeleteError] = useState<string | null>(null);
 const [deleteSessionTarget, setDeleteSessionTarget] = useState<{
  project: Project;
  session: ProjectSession;
 } | null>(null);
 const [deleteSessionsTarget, setDeleteSessionsTarget] = useState<Array<{
  project: Project;
  session: ProjectSession;
 }> | null>(null);
 const [isDeletingSession, setIsDeletingSession] = useState(false);
 const [deleteSessionError, setDeleteSessionError] = useState<string | null>(null);
 const handleRequestDeleteProject = useCallback((project: Project) => {
 setDeleteError(null);
 setDeleteTarget(project);
 }, []);
 const handleCancelDelete = useCallback(() => {
 if (isDeletingProject) return;
 setDeleteTarget(null);
 setDeleteError(null);
 }, [isDeletingProject]);
	 const handleConfirmDelete = useCallback(async () => {
	 if (!deleteTarget) return;
	 const target = deleteTarget;
 setIsDeletingProject(true);
 setDeleteError(null);
 try {
 const response = await api.deleteProject(target.name, true);
 if (!response.ok) {
 const body = (await response.json().catch(() => ({}))) as { error?: string };
 throw new Error(body.error || `Failed (HTTP ${response.status})`);
 }
 sidebarSharedProps.onProjectDelete?.(target.name);
 await refreshProjectsSilently();
 setDeleteTarget(null);
 } catch (err) {
 setDeleteError(
 err instanceof Error
 ? err.message
 : t('sidebar:messages.deleteProjectError', { defaultValue: '删除项目时出错，请重试。' }),
 );
 } finally {
 setIsDeletingProject(false);
	 }
	 }, [deleteTarget, refreshProjectsSilently, sidebarSharedProps, t]);

	 const handleDeleteSession = useCallback(
	 async (project: Project, session: ProjectSession): Promise<{ ok: boolean; error?: string }> => {
	 try {
	 const response = isBackgroundTaskSession(session)
	 ? await api.deleteSession(project.name, session.id, getSessionRequestParams(session))
	 : await api.deleteSession(project.name, session.id);

	 const body = (await response.json().catch(() => ({}))) as {
	 deleted?: boolean;
	 success?: boolean;
	 error?: string;
	 };

	 if (!response.ok) {
	 return {
	 ok: false,
	 error: t('sidebar:messages.deleteSessionFailed', { defaultValue: '删除会话失败，请重试。' }),
	 };
	 }

	 if (body.deleted !== true && body.success !== true) {
	 return {
	 ok: false,
	 error: t('sidebar:messages.deleteSessionFailed', { defaultValue: '删除会话失败，请重试。' }),
	 };
	 }

	 sidebarSharedProps.onSessionDelete?.(session.id);
	 setUnreadSessionIds((previous) => {
	 if (!previous.has(session.id)) return previous;
	 const next = new Set(previous);
	 next.delete(session.id);
	 return next;
	 });
	 setSessionCustomTitle(session.id, null);
	 clearSessionSidebarState(session.id);
	 await refreshProjectsSilently();
	 return { ok: true };
	 } catch {
	 return {
	 ok: false,
	 error: t('sidebar:messages.deleteSessionFailed', { defaultValue: '删除会话失败，请重试。' }),
	 };
	 }
	 },
	 [refreshProjectsSilently, sidebarSharedProps, t],
	 );

 const handleRequestDeleteSession = useCallback((project: Project, session: ProjectSession) => {
  if (isSessionSidebarLocked(session.id)) return;
  setDeleteSessionError(null);
  setDeleteSessionTarget({ project, session });
 }, []);

 const handleRequestDeleteSessions = useCallback((items: Array<{ project: Project; session: ProjectSession }>) => {
  const deletable = items.filter(({ session }) => !isSessionSidebarLocked(session.id));
  if (deletable.length === 0) return;
  setDeleteSessionError(null);
  setDeleteSessionsTarget(deletable);
 }, []);

 const handleCancelDeleteSession = useCallback(() => {
  if (isDeletingSession) return;
  setDeleteSessionTarget(null);
  setDeleteSessionsTarget(null);
  setDeleteSessionError(null);
 }, [isDeletingSession]);

 const handleConfirmDeleteSession = useCallback(async () => {
  if (!deleteSessionTarget) return;
  const { project, session } = deleteSessionTarget;
  setIsDeletingSession(true);
  setDeleteSessionError(null);
  const result = await handleDeleteSession(project, session);
  if (result.ok) {
   setDeleteSessionTarget(null);
  } else {
   setDeleteSessionError(
    result.error
     ?? t('sidebar:messages.deleteSessionFailed', { defaultValue: '删除会话失败，请重试。' }),
   );
  }
  setIsDeletingSession(false);
 }, [deleteSessionTarget, handleDeleteSession, t]);

 const handleConfirmDeleteSessions = useCallback(async () => {
  if (!deleteSessionsTarget?.length) return;
  setIsDeletingSession(true);
  setDeleteSessionError(null);
  let failed = 0;
  for (const { project, session } of deleteSessionsTarget) {
   const result = await handleDeleteSession(project, session);
   if (!result.ok) failed += 1;
  }
  if (failed === 0) {
   setDeleteSessionsTarget(null);
  } else {
   setDeleteSessionError(
    t('sidebar:multiSelect.deletePartialFailed', {
     count: failed,
     defaultValue: '{{count}} 条对话删除失败，请重试。',
    }),
   );
  }
  setIsDeletingSession(false);
 }, [deleteSessionsTarget, handleDeleteSession, t]);

	 const handleSelectProject = useCallback(
 (project: Project) => {
 handleProjectSelect(project);
 navigate(`/p/${encodeURIComponent(project.name)}`);
 },
 [handleProjectSelect, navigate],
 );

 const handleSelectSession = useCallback(
 (project: Project, sessId: string, fallbackSession?: ProjectSession) => {
 setUnreadSessionIds((previous) => {
  let changed = false;
  const next = new Set(previous);
  for (const id of [...next]) {
   if (isSameSessionId(id, sessId)) {
    next.delete(id);
    changed = true;
   }
  }
  return changed ? next : previous;
 });
 if (project.name !== selectedProject?.name) {
  const target = (project.sessions ?? []).find((s) => isSameSessionId(s.id, sessId));
  const session = target ?? fallbackSession ?? {
   id: sessId,
   title: sessId,
   __projectName: project.name,
   created_at: new Date().toISOString(),
   updated_at: new Date().toISOString(),
  };
  selectProjectAndSession(project, session);
 } else {
  const target = (project.sessions ?? []).find((s) => isSameSessionId(s.id, sessId));
  if (target) {
   handleSessionSelect(target);
  } else if (fallbackSession) {
   handleSessionSelect(fallbackSession);
  } else {
   navigate(`/session/${sessId}`);
  }
 }
 setActiveTab('chat');
 },
 [handleProjectSelect, handleSessionSelect, navigate, selectProjectAndSession, selectedProject?.name, setActiveTab],
 );

 const handleSelectTab = useCallback(
 (tab: AppTab) => {
 // `home` is retained only for old persisted state / links. The Agent
 // surface now owns both the welcome/new-session state and transcripts.
 if (tab === 'home') {
 setSelectedSession(null);
 const target = selectedProject
 ? `/p/${encodeURIComponent(selectedProject.name)}`
 : '/';
 const resolvedTarget = resolveAppPath(target, isMobileRoutePath(location.pathname));
 if (location.pathname !== resolvedTarget) {
 navigate(target);
 }
 setActiveTab('chat');
 return;
 }
 setActiveTab(tab);
 },
 [location.pathname, navigate, selectedProject, setActiveTab, setSelectedSession],
 );

 const handleStartNewSession = useCallback(
 (project: Project | null) => {
 if (project) {
 handleNewSession(project);
 navigate(`/p/${encodeURIComponent(project.name)}`);
 setActiveTab('chat');
 } else if (selectedProject) {
 handleNewSession(selectedProject);
 setActiveTab('chat');
 } else {
 // No project context yet — land on /, MainContent's empty state
 // will prompt the user to create or pick a project.
 navigate('/');
 }
 },
 [handleNewSession, navigate, selectedProject, setActiveTab],
 );

 // Wrap the two session-lifecycle callbacks coming out of useSessionProtection
 // so they also reconcile the optimistic placeholder rows in the sidebar:
 // · `session_created` → swap `new-session-*` in projects.sessions for the
 // real id in-place (no flicker).
 // · `complete` / `error` → drop any leftover `new-session-*` placeholder
 // that was never replaced (agent never emitted session_created).
 const handleReplaceTemporarySession = useCallback(
 (realSessionId?: string | null) => {
 replaceTemporarySession(realSessionId);
 if (realSessionId) replaceOptimisticInProjects(realSessionId);
 },
 [replaceTemporarySession, replaceOptimisticInProjects],
 );

 const handleSessionInactive = useCallback(
 (sessionId?: string | null) => {
 markSessionAsInactive(sessionId);
 if (sessionId && sessionId.startsWith('new-session-')) {
 dropOptimisticInProjects(sessionId);
 }
 },
 [markSessionAsInactive, dropOptimisticInProjects],
 );

 const handleExecutionStatusChange = useCallback(
  (payload: {
    sessionId: string;
    executionStatus: ProjectSession['executionStatus'];
    pausedReason?: string | null;
    queuePosition?: number | null;
  }) => {
    patchSessionExecutionStatus(
      payload.sessionId,
      payload.executionStatus,
      payload.pausedReason,
      payload.queuePosition,
    );
    if (payload.executionStatus === 'running' || payload.executionStatus === 'queued') {
      setInterruptedSessionIds((previous) => patchSessionAttentionSet(previous, payload.sessionId, false));
    } else if (
      payload.executionStatus === 'paused'
      && isInterruptedPauseReason(payload.pausedReason)
    ) {
      setInterruptedSessionIds((previous) => patchSessionAttentionSet(previous, payload.sessionId, true));
      setNeedsUserInputSessionIds((previous) => patchSessionAttentionSet(previous, payload.sessionId, false));
    } else if (payload.executionStatus === 'paused') {
      setInterruptedSessionIds((previous) => patchSessionAttentionSet(previous, payload.sessionId, false));
    }
  },
  [patchSessionExecutionStatus],
 );

 const handleSessionAttentionChange = useCallback(
  (sessionId: string, attention: SessionSidebarAttention) => {
    setNeedsUserInputSessionIds((previous) => patchSessionAttentionSet(
      previous,
      sessionId,
      attention.needsUserInput,
    ));
    setInterruptedSessionIds((previous) => patchSessionAttentionSet(
      previous,
      sessionId,
      attention.interrupted,
    ));
  },
  [],
 );

 const sidebar = (
 <SidebarV2
 projects={sidebarSharedProps.projects}
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 activeTab={activeTab}
 isLoading={isLoadingProjects}
 processingSessions={processingSessions}
 unreadSessionIds={unreadSessionIds}
 needsUserInputSessionIds={needsUserInputSessionIds}
 interruptedSessionIds={interruptedSessionIds}
 onSelectProject={handleSelectProject}
 onSelectSession={handleSelectSession}
	 onStartNewSession={handleStartNewSession}
	 onCreateProject={handleOpenNewProject}
	 onRequestDeleteProject={handleRequestDeleteProject}
	 onRequestDeleteSession={handleRequestDeleteSession}
	 onRequestDeleteSessions={handleRequestDeleteSessions}
	 onShowSettings={onShowSettings}
	 onDeselectProject={handleDeselectProject}
	 onResetProjectSessionPreview={handleResetProjectSessionPreview}
	 onCollapse={onCollapseSidebar}
	 onLoadMoreSessions={loadMoreSessions}
	 onLoadOlderSessions={loadOlderSessions}
 loadingMoreProjectIds={loadingMoreProjectIds}
 isMobileShell={isMobile}
 onSessionNotProcessing={markSessionAsNotProcessing}
 onPatchSessionExecutionStatus={patchSessionExecutionStatus}
 />
 );

 return (
 <div
 className={`ui-v2 fixed inset-0 flex bg-background font-sans text-foreground ${
 isMobile ? 'mobile-vvh-shell' : ''
 } ${siteAtmosphereOn ? 'workbench-site-atmosphere-on' : ''}`}
 >
 {siteAtmosphereOn ? <WorkbenchSiteAtmosphere /> : null}
 <WorkbenchMdDropHost />
 {/* PD-SAAS-FORK: N2 Bot overlay on official /app and Beta (single host). */}
 <N2BotOverlayHost />
 {!isMobile ? (
 desktopSidebarOpen ? sidebar : null
 ) : (
 <div
 className={`fixed inset-0 z-50 flex transition-opacity duration-150 ease-out ${
 sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'
 }`}
 >
 <button
 type="button"
 className="fixed inset-0 bg-black/40 backdrop-blur-sm"
 onClick={() => setSidebarOpen(false)}
 aria-label={t('sidebar:tooltips.hideSidebar')}
 />
 <div
 className={`relative h-full w-[85vw] max-w-sm transform transition-transform duration-150 ${
 sidebarOpen ? 'translate-x-0' : '-translate-x-full'
 }`}
 onClick={(e) => e.stopPropagation()}
 >
 {sidebar}
 </div>
 </div>
 )}

 <main className="flex min-w-0 flex-1 flex-col">
 <MainAreaV2
 projects={sidebarSharedProps.projects}
 selectedProject={selectedProject}
 selectedSession={selectedSession}
 activeTab={activeTab}
 setActiveTab={handleSelectTab}
 ws={ws}
 sendMessage={sendMessage}
 latestMessage={latestMessage}
 isMobile={isMobile}
 onMenuClick={onMenuClick}
 isLoading={isLoadingProjects}
 onInputFocusChange={setIsInputFocused}
 onSessionActive={markSessionAsActive}
 onSessionInactive={handleSessionInactive}
 onSessionProcessing={markSessionAsProcessing}
 onSessionNotProcessing={markSessionAsNotProcessing}
 onExecutionStatusChange={handleExecutionStatusChange}
 onSessionAttentionChange={handleSessionAttentionChange}
 onSessionActivityBump={bumpSessionActivity}
 processingSessions={processingSessions}
 onReplaceTemporarySession={handleReplaceTemporarySession}
 onNavigateToSession={(sid: string) => {
 setSelectedSession((prev) => prev?.id === sid ? prev : { id: sid } as ProjectSession);
 navigate(`/session/${sid}`);
 }}
 onStartNewSession={handleStartNewSession}
 onSelectSession={handleSelectSession}
 onShowSettings={onShowSettings}
 onSelectProjectByName={(name: string) => {
 const target = sidebarSharedProps.projects.find((p) => p.name === name);
 if (target) {
 setSelectedProject(target);
 setSelectedSession(null);
 setActiveTab('dashboard');
 navigate(`/p/${encodeURIComponent(target.name)}`);
 }
 }}
 isSidebarCollapsed={!isMobile && !desktopSidebarOpen}
 onOpenSidebar={onOpenDesktopSidebar}
 externalMessageUpdate={externalMessageUpdate}
 />
 </main>

 {sidebarSharedProps.showSettings
 ? ReactDOM.createPortal(
 <SettingsComponent
 isOpen={sidebarSharedProps.showSettings}
 onClose={onCloseSettings}
 projects={sidebarSharedProps.projects.map(normalizeProjectForSettings)}
 initialTab={sidebarSharedProps.settingsInitialTab || 'appearance'}
 />,
 document.body,
 )
 : null}

 {showNewProject
 ? ReactDOM.createPortal(
 IS_SAAS_MODE ? (
 <SaasCreateProjectDialog
 onClose={handleCloseNewProject}
 onProjectCreated={handleProjectCreated}
 />
 ) : (
 <ProjectCreationWizard
 onClose={handleCloseNewProject}
 onProjectCreated={handleProjectCreated}
 />
 ),
 document.body,
 )
 : null}

 <LaunchSheetHost />

	 {deleteTarget
	 ? ReactDOM.createPortal(
	 <SidebarDeleteDialog
 title={t('sidebar:deleteDialog.deleteProjectTitle', { defaultValue: '删除项目？' })}
 subtitle={deleteTarget.displayName || deleteTarget.name}
 body={[
  t('sidebar:deleteDialog.deleteProjectBody', {
   defaultValue: '将从 Nova Ai-Studio 中永久删除此项目下的全部对话、文件与云端内容，且无法撤销。',
  }),
  (deleteTarget.sessions?.length ?? 0) > 0
   ? t('sidebar:deleteDialog.sessionCount', {
    count: deleteTarget.sessions?.length ?? 0,
    defaultValue: '其中包含 {{count}} 个对话。',
   })
   : '',
 ]
  .filter(Boolean)
  .join(' ')}
 isDeleting={isDeletingProject}
 error={deleteError}
 onCancel={handleCancelDelete}
 onConfirm={handleConfirmDelete}
 />,
	 document.body,
	 )
	 : null}

	 {deleteSessionTarget
	 ? ReactDOM.createPortal(
	 <SidebarDeleteDialog
 title={
  isBackgroundTaskSession(deleteSessionTarget.session)
   ? t('sidebar:deleteDialog.deleteBackgroundTaskTitle', { defaultValue: '删除计划任务？' })
   : t('sidebar:deleteDialog.deleteSessionTitle', { defaultValue: '删除对话？' })
 }
 subtitle={sessionDisplayTitle(deleteSessionTarget.session)}
 body={
  isBackgroundTaskSession(deleteSessionTarget.session)
   ? t('sidebar:deleteDialog.deleteBackgroundTaskBody', {
    defaultValue: '将立即停止后台执行，并永久删除该任务的记录与对话，无法撤销。',
   })
   : t('sidebar:deleteDialog.deleteSessionBody', {
    defaultValue: '将从记录中删除此对话，且无法撤销。',
   })
 }
 isDeleting={isDeletingSession}
 error={deleteSessionError}
 onCancel={handleCancelDeleteSession}
 onConfirm={handleConfirmDeleteSession}
 />,
	 document.body,
	 )
	 : null}

	 {deleteSessionsTarget && deleteSessionsTarget.length > 0
	 ? ReactDOM.createPortal(
	 <SidebarDeleteDialog
 title={t('sidebar:deleteDialog.deleteSessionsTitle', {
  count: deleteSessionsTarget.length,
  defaultValue: '删除 {{count}} 条对话？',
 })}
 subtitle={t('sidebar:deleteDialog.deleteSessionsSubtitle', {
  count: deleteSessionsTarget.length,
  defaultValue: '已选择 {{count}} 条对话',
 })}
 body={t('sidebar:deleteDialog.deleteSessionsBody', {
  defaultValue: '将从记录中删除所选对话，且无法撤销。',
 })}
 isDeleting={isDeletingSession}
 error={deleteSessionError}
 onCancel={handleCancelDeleteSession}
 onConfirm={handleConfirmDeleteSessions}
 />,
	 document.body,
	 )
	 : null}
	 </div>
	 );
	}
