import {
 useCallback,
 useEffect,
 useMemo,
 useRef,
 useState,
 type KeyboardEvent,
 type MouseEvent,
} from 'react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useTranslation } from 'react-i18next';
import {
 ChevronRight,
 ChevronsDownUp,
 ChevronsUpDown,
 Check,
 CheckSquare,
 Clock,
 Copy,
 FileDown,
 Folder,
 Lock,
 LockOpen,
 MessageSquarePlus,
 MessageCircleQuestion,
 PanelLeftClose,
 Pause,
 Play,
 Pencil,
 LogOut,
 Plus,
 Settings as SettingsIcon,
 Square,
 Trash2,
 Unplug,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { type AppTab, type Project, type ProjectSession } from '../../types/app';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { cn } from '../../lib/utils.js';
import { getSessionProjectPath } from '../chat/utils/sessionLauncher';
import { prefetchSessionTailMessages, cancelSessionTailPrefetches, isSessionTailPrefetchInflight } from '../../stores/sessionMessageTailPrefetch';
import { getActivePrimarySessionId } from '../../stores/sessionMessagePrefetchGate';
import { isImeEnterEvent } from '../../utils/ime';
import {
 projectDisplayName,
 sessionDisplayTitle,
 setProjectCustomName,
 setSessionCustomTitle,
 useCustomNamesVersion,
} from '../../lib/customNames';
import {
 isSessionSidebarCompleted,
 isSessionSidebarLocked,
 setSessionSidebarCompleted,
 setSessionSidebarLocked,
 toggleSessionSidebarCompleted,
 toggleSessionSidebarLocked,
 useSessionSidebarStateVersion,
 SESSION_SIDEBAR_UNMARK_FOCUS_EVENT,
} from '../../lib/sessionSidebarState';
import { exportSessionToHtmlFile } from '../../shared/exportSessionHtml';
import { isExportUserAuditModesEnabled } from '../../shared/perfFeatureFlags';
import { subscribeRuntimeFeatureFlags } from '../../shared/runtimeFeatureFlags';
import type { ExportSnapshotMode } from '../../shared/exportSnapshotEnvelope';
import novaLogoMark from '../../saas/brand/novaLogoMark';
import { IS_SAAS_MODE } from '../../constants/config';
// PD-SAAS-FORK: account strip when SaaS mode
import SaasSidebarAccount from '../../saas/account/SaasSidebarAccount';
import SaasLogoutConfirm from '../../saas/account/SaasLogoutConfirm';
import N2BotSidebarChip from '../../saas/n2-bot/N2BotSidebarChip';
import ProductInfoDialog from '../../saas/brand/ProductInfoDialog';
import { useAuth } from '../auth/context/AuthContext';
import { isSameSessionId, normalizeSessionId } from '../../shared/sessionId';
import {
  sessionLastActivityMs,
  sortProjectsByRecency,
  sortSessionsByRecency,
} from '../../shared/sidebarRecencySort';
import { filterSessionsForSidebarWindow } from '../../shared/sidebarDefaultWindow';
import { SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT } from '../../shared/sidebarSessionPreviewLimit';
import {
  resolveSidebarSessionExecutionStatus,
  resolveSessionRowVisualStatus,
  type SessionRowVisualStatus,
  shouldShowContextPauseSession,
  shouldShowContextResumeSession,
  shouldShowSidebarLoadMore,
  shouldShowSidebarLoadOlder,
} from '../../shared/sidebarSessionExecutionStatus';
import {
  buildSidebarMultiSelectKey,
  collectSidebarSessionRefs,
  filterBatchCompleteSessions,
  filterBatchLockSessions,
  filterBatchPauseSessions,
  filterBatchResumeSessions,
  filterBatchUncompleteSessions,
  filterBatchUnlockSessions,
  isOptimisticSidebarSessionId,
  partitionBatchDeletableSessions,
} from '../../shared/sidebarSessionMultiSelect';
import SidebarMultiSelectBar from './SidebarMultiSelectBar';

function ProjectFolderIcon({
 project,
 isSelected,
}: {
 project: Project;
 isSelected: boolean;
}) {
 return (
 <span className="relative inline-flex shrink-0">
 <Folder
 className={cn(
 'h-3.5 w-3.5',
 isSelected ? 'text-foreground' : 'text-muted-foreground',
 )}
 strokeWidth={1.75}
 />
 </span>
 );
}

type FlatSession = {
 session: ProjectSession;
 sessionId: string;
 lastActivity: number;
};

const collectSessionsForProject = (project: Project): FlatSession[] => {
 const includeOlderLoaded = Boolean(project.sessionMeta?.includeOlderLoaded);
 const sessions = filterSessionsForSidebarWindow(
   Array.isArray(project.sessions) ? project.sessions : [],
   includeOlderLoaded,
 );
 return sessions.map((session) => ({
   session,
   sessionId: session.id,
   lastActivity: sessionLastActivityMs(session),
 }));
};

const formatRelative = (ts: number, t: TFunction): string => {
 if (!ts) return '';
 const diff = Date.now() - ts;
 if (diff < 60_000) return t('sidebar:time.justNow', { defaultValue: 'just now' });
 if (diff < 3_600_000) {
 const minutes = Math.floor(diff / 60_000);
 if (minutes === 1) return t('sidebar:time.oneMinuteAgo', { defaultValue: '1 min ago' });
 return t('sidebar:time.minutesAgo', { count: minutes, defaultValue: `${minutes} mins ago` });
 }
 if (diff < 86_400_000) {
 const hours = Math.floor(diff / 3_600_000);
 if (hours === 1) return t('sidebar:time.oneHourAgo', { defaultValue: '1 hour ago' });
 return t('sidebar:time.hoursAgo', { count: hours, defaultValue: `${hours} hours ago` });
 }
 const days = Math.floor(diff / 86_400_000);
 if (days === 1) return t('sidebar:time.oneDayAgo', { defaultValue: '1 day ago' });
 return t('sidebar:time.daysAgo', { count: days, defaultValue: `${days} days ago` });
};

const SPINNER_DOTS = Array.from({ length: 8 }, (_, index) => index);

type SessionRowStatusLabels = {
  main: string;
  locked?: string;
};

function SessionStatusGlyph({
  status,
  label,
}: {
  status: SessionRowVisualStatus;
  label: string;
}) {
  if (status === 'completed') {
    return (
      <Check
        className="h-3 w-3 text-emerald-600/85 dark:text-emerald-400/85"
        strokeWidth={2.25}
        aria-label={label}
      />
    );
  }

  if (status === 'processing') {
    return (
      <span
        aria-label={label}
        title={label}
        className="relative block h-3 w-3 animate-spin"
      >
        {SPINNER_DOTS.map((dot) => (
          <span
            key={dot}
            className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-primary/70"
            style={{
              transform: `translate(-50%, -50%) rotate(${dot * 45}deg) translateY(-4px)`,
              opacity: 0.35 + dot * 0.08,
            }}
          />
        ))}
      </span>
    );
  }

  if (status === 'queued') {
    return (
      <Clock
        className="h-3 w-3 text-amber-600/75 dark:text-amber-400/75"
        strokeWidth={2}
        aria-label={label}
      />
    );
  }

  if (status === 'paused') {
    return (
      <Pause
        className="h-3 w-3 text-muted-foreground/85"
        strokeWidth={2}
        aria-label={label}
      />
    );
  }

  if (status === 'needs_user_input') {
    return (
      <MessageCircleQuestion
        className="sidebar-status-needs-input h-3 w-3 text-primary/80"
        strokeWidth={2}
        aria-label={label}
      />
    );
  }

  if (status === 'interrupted') {
    return (
      <Unplug
        className="sidebar-status-interrupted h-3 w-3 text-muted-foreground/80"
        strokeWidth={2}
        aria-label={label}
      />
    );
  }

  if (status === 'unread') {
    return (
      <span
        aria-label={label}
        title={label}
        className="block h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px] shadow-primary/20"
      />
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/35"
    />
  );
}

function SessionRowStatusIcons({
  status,
  locked,
  labels,
}: {
  status: SessionRowVisualStatus;
  locked: boolean;
  labels: SessionRowStatusLabels;
}) {
  const combinedLabel = locked && labels.locked
    ? `${labels.main} · ${labels.locked}`
    : labels.main;

  return (
    <span
      className="relative flex h-[18px] w-3 shrink-0 items-center justify-center pt-[3px]"
      title={combinedLabel}
    >
      <SessionStatusGlyph status={status} label={labels.main} />
      {locked ? (
        <Lock
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 text-muted-foreground/85"
          strokeWidth={2}
          aria-label={labels.locked}
        />
      ) : null}
    </span>
  );
}

export type SidebarV2Props = {
 projects: Project[];
 selectedProject: Project | null;
 selectedSession: ProjectSession | null;
 activeTab: AppTab;
 isLoading: boolean;
 processingSessions?: Set<string>;
 unreadSessionIds?: Set<string>;
 needsUserInputSessionIds?: Set<string>;
 interruptedSessionIds?: Set<string>;
 onSelectProject: (project: Project) => void;
 onSelectSession: (project: Project, sessionId: string) => void;
 onStartNewSession: (project: Project | null) => void;
 onCreateProject: () => void;
 onRequestDeleteProject: (project: Project) => void;
 onRequestDeleteSession: (project: Project, session: ProjectSession) => void;
 onRequestDeleteSessions?: (items: Array<{ project: Project; session: ProjectSession }>) => void;
 onShowSettings: () => void;
 onDeselectProject?: () => void;
 onResetProjectSessionPreview?: (projectName: string) => void;
 onCollapse?: () => void;
 onLoadMoreSessions?: (projectName: string) => void;
 onLoadOlderSessions?: (projectName: string) => void;
 loadingMoreProjectIds?: Set<string>;
 /** PD-SAAS-FORK: mobile drawer — unified chat list without General segment. */
 isMobileShell?: boolean;
 onSessionNotProcessing?: (sessionId?: string | null) => void;
 /** PD-SAAS-FORK: optimistic executionStatus patch after unpause-session. */
 onPatchSessionExecutionStatus?: (
  sessionId: string,
  executionStatus: ProjectSession['executionStatus'],
  pausedReason?: string | null,
 ) => void;
};

type SidebarContextMenu =
 | {
 kind: 'project';
 project: Project;
 x: number;
 y: number;
 }
 | {
 kind: 'session';
 project: Project;
 session: ProjectSession;
 x: number;
 y: number;
 };

const CONTEXT_MENU_WIDTH = 176;
const CONTEXT_MENU_PROJECT_HEIGHT = 88;
const CONTEXT_MENU_SESSION_HEIGHT = 320;
const CONTEXT_MENU_MARGIN = 8;

const contextMenuPosition = (event: MouseEvent, menuHeight: number) => {
 const maxX = window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN;
 const maxY = window.innerHeight - menuHeight - CONTEXT_MENU_MARGIN;
 return {
 x: Math.max(CONTEXT_MENU_MARGIN, Math.min(event.clientX, maxX)),
 y: Math.max(CONTEXT_MENU_MARGIN, Math.min(event.clientY, maxY)),
 };
};

export default function SidebarV2({
 projects,
 selectedProject,
 selectedSession,
 activeTab,
 isLoading,
 processingSessions,
 unreadSessionIds,
 needsUserInputSessionIds,
 interruptedSessionIds,
 onSelectProject,
 onSelectSession,
 onStartNewSession,
 onCreateProject,
 onRequestDeleteProject,
 onRequestDeleteSession,
 onRequestDeleteSessions,
 onShowSettings,
 onDeselectProject,
 onResetProjectSessionPreview,
 onCollapse,
 onLoadMoreSessions,
 onLoadOlderSessions,
 loadingMoreProjectIds,
 isMobileShell = false,
 onSessionNotProcessing,
 onPatchSessionExecutionStatus,
}: SidebarV2Props) {
 const { t } = useTranslation(['sidebar', 'auth', 'common']);
 const navigate = useAppNavigate();
 const { logout } = useAuth();
 const { sendMessage } = useWebSocket();
 const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
 const [showProductInfo, setShowProductInfo] = useState(false);
 useCustomNamesVersion();
 useSessionSidebarStateVersion();

 const [sidebarNotice, setSidebarNotice] = useState<{
  message: string;
  top: number;
  left: number;
  centered?: boolean;
 } | null>(null);
 const sidebarNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const handleConfirmLogout = useCallback(() => {
 setShowLogoutConfirm(false);
 logout();
 navigate('/login');
 }, [logout, navigate]);
 const safeProjects = Array.isArray(projects) ? projects : [];

 const [renamingProject, setRenamingProject] = useState<string | null>(null);
 const [renamingSession, setRenamingSession] = useState<string | null>(null);
 const [renameDraft, setRenameDraft] = useState<string>('');
 const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
 const [contextMenu, setContextMenu] = useState<SidebarContextMenu | null>(null);
 const [multiSelectMode, setMultiSelectMode] = useState(false);
 const [multiSelectedKeys, setMultiSelectedKeys] = useState<Set<string>>(() => new Set());
 const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);
 const [exportUserAuditModes, setExportUserAuditModes] = useState(() => isExportUserAuditModesEnabled());
 const [collapsedSessionProjects, setCollapsedSessionProjects] = useState<Set<string>>(new Set());
 const userExpandedSessionProjectsRef = useRef<Set<string>>(new Set());
 const [draftSessionProjectName, setDraftSessionProjectName] = useState<string | null>(null);
 const renameInputRef = useRef<HTMLInputElement | null>(null);
 const sessionListScrollRef = useRef<HTMLDivElement | null>(null);

 useEffect(() => subscribeRuntimeFeatureFlags(() => {
  setExportUserAuditModes(isExportUserAuditModesEnabled());
 }), []);

 const showSidebarNoticeBesideSession = useCallback((message: string, sessionId: string) => {
  const normalized = normalizeSessionId(sessionId);
  const row = sessionListScrollRef.current?.querySelector<HTMLElement>(
   `[data-sidebar-session-id="${CSS.escape(normalized)}"]`,
  );
  const noticeWidth = 220;
  const margin = 8;
  let top = window.innerHeight / 2;
  let left = margin;
  let centered = true;
  if (row) {
   const rect = row.getBoundingClientRect();
   const preferRight = rect.right + margin + noticeWidth <= window.innerWidth - margin;
   if (preferRight) {
    left = rect.right + margin;
    top = rect.top + rect.height / 2;
    centered = true;
   } else {
    left = Math.max(margin, Math.min(rect.left, window.innerWidth - noticeWidth - margin));
    top = rect.bottom + margin;
    centered = false;
   }
  }
  setSidebarNotice({ message, top, left, centered });
  if (sidebarNoticeTimerRef.current) {
   clearTimeout(sidebarNoticeTimerRef.current);
  }
  sidebarNoticeTimerRef.current = setTimeout(() => {
   setSidebarNotice(null);
   sidebarNoticeTimerRef.current = null;
  }, 3200);
 }, []);

 useEffect(() => () => {
  if (sidebarNoticeTimerRef.current) clearTimeout(sidebarNoticeTimerRef.current);
 }, []);

 const notifySessionLocked = useCallback((sessionId: string) => {
  showSidebarNoticeBesideSession(
   t('sidebar:messages.unlockSessionFirst', {
    defaultValue: '此对话已锁定，请先在菜单中解除锁定。',
   }) as string,
   sessionId,
  );
 }, [showSidebarNoticeBesideSession, t]);

 // Segmented toggle between the Projects list and the General workspace.
 // Persisted across reloads so the user's preferred view sticks. Switching
 // is purely a visibility change — we don't reroute or alter selection so
 // the user can peek without losing their place in the active chat.
 const SIDEBAR_SECTION_STORAGE_KEY = 'sidebar-v2-active-section';
 type SidebarSection = 'projects' | 'general';
 const [activeSection, setActiveSection] = useState<SidebarSection>(() => {
 if (typeof window === 'undefined') return 'projects';
 const stored = window.localStorage.getItem(SIDEBAR_SECTION_STORAGE_KEY);
 return stored === 'general' ? 'general' : 'projects';
 });
 useEffect(() => {
 try {
 window.localStorage.setItem(SIDEBAR_SECTION_STORAGE_KEY, activeSection);
 } catch {
 // localStorage unavailable — fall back to in-memory state silently.
 }
 }, [activeSection]);

 useEffect(() => {
  setCollapsedSessionProjects((prev) => {
   const next = new Set(prev);
   let changed = false;
   for (const project of safeProjects) {
    const count = collectSessionsForProject(project).length;
    if (
     count > SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT
     && !userExpandedSessionProjectsRef.current.has(project.name)
     && !next.has(project.name)
    ) {
     next.add(project.name);
     changed = true;
    }
   }
   return changed ? next : prev;
  });
 }, [safeProjects]);

 useEffect(() => {
  const sessionId = selectedSession?.id;
  if (!sessionId || activeTab !== 'chat' || !selectedProject) return;

  const allSessions = collectSessionsForProject(selectedProject);
  const index = allSessions.findIndex(({ sessionId: id }) => isSameSessionId(id, sessionId));
  if (index >= SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT) {
   userExpandedSessionProjectsRef.current.add(selectedProject.name);
   setCollapsedSessionProjects((prev) => {
    if (!prev.has(selectedProject.name)) return prev;
    const next = new Set(prev);
    next.delete(selectedProject.name);
    return next;
   });
  }
 }, [activeTab, selectedProject, selectedSession?.id]);

 useEffect(() => {
  const sessionId = selectedSession?.id;
  if (!sessionId || activeTab !== 'chat') return;

  const timer = window.setTimeout(() => {
   const root = sessionListScrollRef.current;
   if (!root) return;
   const normalized = normalizeSessionId(sessionId);
   const row = root.querySelector<HTMLElement>(
    `[data-sidebar-session-id="${CSS.escape(normalized)}"]`,
   );
   row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 80);
  return () => window.clearTimeout(timer);
 }, [activeTab, collapsedSessionProjects, selectedSession?.id]);

 // Resizable sidebar width — clamped to a sensible range and persisted across
 // reloads. Drag-handle on the right edge mutates this on the fly.
 const SIDEBAR_MIN_WIDTH = 200;
 const SIDEBAR_MAX_WIDTH = 480;
 const SIDEBAR_DEFAULT_WIDTH = 248;
 const SIDEBAR_WIDTH_STORAGE_KEY = 'sidebar-v2-width';
 const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
 if (typeof window === 'undefined') return SIDEBAR_DEFAULT_WIDTH;
 const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
 const parsed = stored ? Number(stored) : NaN;
 if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
 return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, parsed));
 });
 const [isResizing, setIsResizing] = useState(false);

 const handleResizeStart = useCallback((event: MouseEvent<HTMLDivElement>) => {
 event.preventDefault();
 const startX = event.clientX;
 const startWidth = sidebarWidth;
 setIsResizing(true);

 const onMove = (e: globalThis.MouseEvent) => {
 const next = Math.min(
 SIDEBAR_MAX_WIDTH,
 Math.max(SIDEBAR_MIN_WIDTH, startWidth + (e.clientX - startX)),
 );
 setSidebarWidth(next);
 };

 const onUp = () => {
 setIsResizing(false);
 document.removeEventListener('mousemove', onMove);
 document.removeEventListener('mouseup', onUp);
 // Persist the latest width by reading back from state — wrapped in a
 // microtask so the latest setState has settled before we serialize.
 queueMicrotask(() => {
 try {
 // Read directly off the DOM element rather than chasing closure state
 // to avoid serializing a stale value.
 const aside = document.querySelector<HTMLElement>('aside[data-sidebar-v2-root]');
 const width = aside?.offsetWidth;
 if (width && Number.isFinite(width)) {
 window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(width)));
 }
 } catch {
 // localStorage may be unavailable in some environments — ignore.
 }
 });
 };

 document.addEventListener('mousemove', onMove);
 document.addEventListener('mouseup', onUp);
 }, [sidebarWidth]);

 useEffect(() => {
 if ((renamingProject || renamingSession) && renameInputRef.current) {
 renameInputRef.current.focus();
 renameInputRef.current.select();
 }
 }, [renamingProject, renamingSession]);

 useEffect(() => {
 if (!contextMenu) return undefined;

 const closeContextMenu = () => setContextMenu(null);
 const closeOnEscape = (event: globalThis.KeyboardEvent) => {
 if (event.key === 'Escape') closeContextMenu();
 };

 window.addEventListener('click', closeContextMenu);
 window.addEventListener('resize', closeContextMenu);
 window.addEventListener('scroll', closeContextMenu, true);
 window.addEventListener('keydown', closeOnEscape);

 return () => {
 window.removeEventListener('click', closeContextMenu);
 window.removeEventListener('resize', closeContextMenu);
 window.removeEventListener('scroll', closeContextMenu, true);
 window.removeEventListener('keydown', closeOnEscape);
 };
 }, [contextMenu]);

 useEffect(() => {
 if (!selectedProject?.name) return;
 setExpandedGroups((previous) => {
 if (previous.has(selectedProject.name)) return previous;
 const next = new Set(previous);
 next.add(selectedProject.name);
 return next;
 });
 }, [selectedProject?.name]);

 useEffect(() => {
 if (!draftSessionProjectName) return;
 if (!selectedProject || selectedSession || selectedProject.name !== draftSessionProjectName) {
 setDraftSessionProjectName(null);
 }
 }, [draftSessionProjectName, selectedProject, selectedSession]);

 const generalProject =
 safeProjects.find((project) => project.name === 'general' || project.displayName === 'general') ?? null;

 // Auto-flip the section toggle to match the active project when it changes
 // externally (e.g. /switch-project, deep-linking, default selection on
 // first load). Without this, navigating to a project on one section while
 // the sidebar is parked on the other leaves the new project invisible.
 // We only react to changes — if the user manually clicks the toggle we
 // never fight them mid-session.
 const previousSelectedProjectNameRef = useRef<string | null>(null);
 useEffect(() => {
 const currentName = selectedProject?.name ?? null;
 const previousName = previousSelectedProjectNameRef.current;
 previousSelectedProjectNameRef.current = currentName;
 if (!currentName) return;
 if (currentName === previousName) return;

 const nextSection: SidebarSection =
 generalProject && currentName === generalProject.name ? 'general' : 'projects';
 setActiveSection((current) => (current === nextSection ? current : nextSection));
 }, [selectedProject?.name, generalProject]);

 const otherProjects = useMemo(() => {
 const remaining = safeProjects.filter((project) => project !== generalProject);
 return sortProjectsByRecency(remaining);
 }, [safeProjects, generalProject]);

 const allProjectGroupsExpanded = otherProjects.length > 0 && otherProjects.every((project) =>
 expandedGroups.has(project.name),
 );

 const navToProject = useCallback(
 (name: string) => navigate(`/p/${encodeURIComponent(name)}`),
 [navigate],
 );

 const handleGeneralSectionClick = useCallback(() => {
 setActiveSection('general');
 if (!generalProject) return;

 onResetProjectSessionPreview?.(generalProject.name);
 if (selectedProject?.name !== generalProject.name) {
 onSelectProject(generalProject);
 }
 navToProject(generalProject.name);
 }, [generalProject, navToProject, onResetProjectSessionPreview, onSelectProject, selectedProject?.name]);

 const handleProjectsSectionClick = useCallback(() => {
 if (generalProject) {
 onResetProjectSessionPreview?.(generalProject.name);
 }
 setActiveSection('projects');
 }, [generalProject, onResetProjectSessionPreview]);

 const toggleProjectExpanded = useCallback((project: Project) => {
 setExpandedGroups((previous) => {
 const next = new Set(previous);
 if (next.has(project.name)) {
 next.delete(project.name);
 } else {
 next.add(project.name);
 }
 return next;
 });
 }, []);

 const toggleAllProjectGroups = useCallback(() => {
 setExpandedGroups((previous) => {
 const next = new Set(previous);
 if (allProjectGroupsExpanded) {
 otherProjects.forEach((project) => next.delete(project.name));
 } else {
 otherProjects.forEach((project) => next.add(project.name));
 }
 return next;
 });
 }, [allProjectGroupsExpanded, otherProjects]);

 const ensureExpanded = useCallback((project: Project) => {
 setExpandedGroups((previous) => {
 if (previous.has(project.name)) return previous;
 const next = new Set(previous);
 next.add(project.name);
 return next;
 });
 }, []);

 const handleProjectClick = useCallback(
 (project: Project) => {
 if (renamingProject === project.name) return;
 toggleProjectExpanded(project);
 },
 [renamingProject, toggleProjectExpanded],
 );

 const sessionPrefetchTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

 const handleSessionClick = useCallback(
 (project: Project, sessionId: string) => {
 if (renamingSession === sessionId) return;
 cancelSessionTailPrefetches();
 for (const timer of sessionPrefetchTimerRef.current.values()) {
 clearTimeout(timer);
 }
 sessionPrefetchTimerRef.current.clear();
 setDraftSessionProjectName(null);
 onSelectSession(project, sessionId);
 ensureExpanded(project);
 },
 [ensureExpanded, onSelectSession, renamingSession],
 );

 const triggerSessionPrefetch = useCallback((
 project: Project,
 session: ProjectSession,
 opts?: { immediate?: boolean },
 ) => {
 const sessionId = session.id;
 if (typeof sessionId === 'string' && sessionId.startsWith('new-session-')) return;
 if (isSameSessionId(selectedSession?.id, sessionId)) return;
 if (getActivePrimarySessionId() === sessionId) return;
 const key = `${sessionId}:${project.name}`;
 if (isSessionTailPrefetchInflight(sessionId, project.name)) return;
 const existing = sessionPrefetchTimerRef.current.get(key);
 if (existing) clearTimeout(existing);
 const updatedRaw = session.updated_at ?? session.lastActivity ?? session.created_at ?? session.createdAt;
 const lastModifiedAtMs = updatedRaw ? Date.parse(String(updatedRaw)) : undefined;
 const runPrefetch = () => {
 sessionPrefetchTimerRef.current.delete(key);
 void prefetchSessionTailMessages(sessionId, {
 provider: 'pilotdeck',
 projectName: project.name,
 projectPath: getSessionProjectPath(project),
 ...(Number.isFinite(lastModifiedAtMs) ? { lastModifiedAtMs } : {}),
 });
 };
 if (opts?.immediate) {
 sessionPrefetchTimerRef.current.set(key, setTimeout(runPrefetch, 60));
 return;
 }
 sessionPrefetchTimerRef.current.set(key, setTimeout(runPrefetch, 450));
 }, [selectedSession?.id]);

 const handleNewSession = useCallback(
 (event: MouseEvent, project: Project) => {
 event.stopPropagation();
 setDraftSessionProjectName(project.name);
 ensureExpanded(project);
 onStartNewSession(project);
 navToProject(project.name);
 },
 [ensureExpanded, navToProject, onStartNewSession],
 );

 // PD-SAAS-FORK: Beta Demo「＋ 新对话」is DOM-injected; display:none native
 // buttons don't receive React clicks — bridge via custom event instead.
 useEffect(() => {
 const onBetaNewChat = () => {
 const project =
 activeSection === 'general'
 ? generalProject
 : selectedProject && (!generalProject || selectedProject.name !== generalProject.name)
 ? selectedProject
 : otherProjects[0] || generalProject;
 if (!project) return;
 setDraftSessionProjectName(project.name);
 ensureExpanded(project);
 onStartNewSession(project);
 navToProject(project.name);
 };
 window.addEventListener('pilotdeck:workbench-beta-new-chat', onBetaNewChat);
 return () => window.removeEventListener('pilotdeck:workbench-beta-new-chat', onBetaNewChat);
 }, [
 activeSection,
 ensureExpanded,
 generalProject,
 navToProject,
 onStartNewSession,
 otherProjects,
 selectedProject,
 ]);

 // PD-SAAS-FORK: Beta Demo「＋ 新建项目」— same bridge as new-chat (native + is hidden).
 useEffect(() => {
 const onBetaNewProject = () => {
 onCreateProject();
 };
 window.addEventListener('pilotdeck:workbench-beta-new-project', onBetaNewProject);
 return () => window.removeEventListener('pilotdeck:workbench-beta-new-project', onBetaNewProject);
 }, [onCreateProject]);

 const openProjectContextMenu = useCallback(
 (event: MouseEvent, project: Project, isGeneral: boolean) => {
 if (isGeneral || renamingProject === project.name) return;
 event.preventDefault();
 event.stopPropagation();
 const position = contextMenuPosition(event, CONTEXT_MENU_PROJECT_HEIGHT);
 setContextMenu({
 kind: 'project',
 project,
 x: position.x,
 y: position.y,
 });
 },
 [renamingProject],
 );

 const openSessionContextMenu = useCallback(
 (event: MouseEvent, project: Project, session: ProjectSession) => {
 if (renamingSession === session.id) return;
 event.preventDefault();
 event.stopPropagation();
 const position = contextMenuPosition(event, CONTEXT_MENU_SESSION_HEIGHT);
 setContextMenu({
 kind: 'session',
 project,
 session,
 x: position.x,
 y: position.y,
 });
 },
 [renamingSession],
 );

 const beginRenameProject = useCallback((project: Project) => {
 setContextMenu(null);
 setRenamingSession(null);
 setRenamingProject(project.name);
 setRenameDraft(projectDisplayName(project));
 }, []);

 const beginRenameSession = useCallback((session: ProjectSession) => {
 if (isSessionSidebarLocked(session.id)) {
  notifySessionLocked(session.id);
  return;
 }
 setContextMenu(null);
 setRenamingProject(null);
 setRenamingSession(session.id);
 setRenameDraft(sessionDisplayTitle(session));
 }, [notifySessionLocked]);

 const requestDeleteProject = useCallback(
 (project: Project) => {
 setContextMenu(null);
 onRequestDeleteProject(project);
 },
 [onRequestDeleteProject],
 );

 const requestDeleteSession = useCallback(
 (project: Project, session: ProjectSession) => {
 if (isSessionSidebarLocked(session.id)) {
  setContextMenu(null);
  notifySessionLocked(session.id);
  return;
 }
 setContextMenu(null);
 onRequestDeleteSession(project, session);
 },
 [notifySessionLocked, onRequestDeleteSession],
 );

 const handleContextRename = useCallback(() => {
 if (!contextMenu) return;
 if (contextMenu.kind === 'project') {
 beginRenameProject(contextMenu.project);
 } else if (isSessionSidebarLocked(contextMenu.session.id)) {
  setContextMenu(null);
  notifySessionLocked(contextMenu.session.id);
 } else {
 beginRenameSession(contextMenu.session);
 }
 }, [beginRenameProject, beginRenameSession, contextMenu, notifySessionLocked]);

 const handleContextDelete = useCallback(() => {
 if (!contextMenu) return;
 if (contextMenu.kind === 'project') {
 requestDeleteProject(contextMenu.project);
 } else {
 requestDeleteSession(contextMenu.project, contextMenu.session);
 }
 }, [contextMenu, requestDeleteProject, requestDeleteSession]);

 const handleContextToggleComplete = useCallback(() => {
 if (!contextMenu || contextMenu.kind !== 'session') return;
 const sessionId = contextMenu.session.id;
 const markingComplete = !isSessionSidebarCompleted(sessionId);
 if (isSessionSidebarLocked(sessionId) && markingComplete) {
  setContextMenu(null);
  notifySessionLocked(sessionId);
  return;
 }
 if (markingComplete) {
  sendMessage({ type: 'pause-turn', sessionId, reason: 'user_complete_click' });
  onSessionNotProcessing?.(sessionId);
  onPatchSessionExecutionStatus?.(sessionId, 'paused', 'user_complete_click');
 } else {
  sendMessage({ type: 'unpause-session', sessionId, reason: 'user_unmark_complete' });
  onPatchSessionExecutionStatus?.(sessionId, 'idle', null);
  onSelectSession(contextMenu.project, sessionId);
  window.requestAnimationFrame(() => {
   window.dispatchEvent(new CustomEvent(SESSION_SIDEBAR_UNMARK_FOCUS_EVENT, {
    detail: { sessionId },
   }));
  });
 }
 toggleSessionSidebarCompleted(sessionId);
 setContextMenu(null);
}, [contextMenu, notifySessionLocked, onPatchSessionExecutionStatus, onSelectSession, onSessionNotProcessing, sendMessage]);

 const handleContextPauseSession = useCallback(() => {
 if (!contextMenu || contextMenu.kind !== 'session') return;
 const sessionId = contextMenu.session.id;
 sendMessage({ type: 'pause-turn', sessionId, reason: 'user_pause' });
 onSessionNotProcessing?.(sessionId);
 onPatchSessionExecutionStatus?.(sessionId, 'paused', 'user_pause');
 setContextMenu(null);
 }, [contextMenu, onPatchSessionExecutionStatus, onSessionNotProcessing, sendMessage]);

 // PD-SAAS-FORK: symmetric unpause for user-paused sessions (not「取消任务完成」flow).
 const handleContextResumeSession = useCallback(() => {
 if (!contextMenu || contextMenu.kind !== 'session') return;
 const sessionId = contextMenu.session.id;
 sendMessage({ type: 'unpause-session', sessionId, reason: 'user_resume' });
 onPatchSessionExecutionStatus?.(sessionId, 'idle', null);
 onSelectSession(contextMenu.project, sessionId);
 setContextMenu(null);
 }, [contextMenu, onPatchSessionExecutionStatus, onSelectSession, sendMessage]);

 const handleContextCancelQueue = useCallback(() => {
 if (!contextMenu || contextMenu.kind !== 'session') return;
 sendMessage({ type: 'cancel-queued-turn', sessionId: contextMenu.session.id });
 setContextMenu(null);
 }, [contextMenu, sendMessage]);

 const handleContextToggleLock = useCallback(() => {
 if (!contextMenu || contextMenu.kind !== 'session') return;
 toggleSessionSidebarLocked(contextMenu.session.id);
 setContextMenu(null);
 }, [contextMenu]);

 const exitMultiSelectMode = useCallback(() => {
  setMultiSelectMode(false);
  setMultiSelectedKeys(new Set());
 }, []);

 const enterMultiSelectMode = useCallback((project: Project, session: ProjectSession) => {
  if (isOptimisticSidebarSessionId(session.id)) return;
  setContextMenu(null);
  setMultiSelectMode(true);
  setMultiSelectedKeys(new Set([buildSidebarMultiSelectKey(project.name, session.id)]));
 }, []);

 const toggleMultiSelectKey = useCallback((projectName: string, sessionId: string) => {
  if (isOptimisticSidebarSessionId(sessionId)) return;
  const key = buildSidebarMultiSelectKey(projectName, sessionId);
  setMultiSelectedKeys((previous) => {
   const next = new Set(previous);
   if (next.has(key)) next.delete(key);
   else next.add(key);
   return next;
  });
 }, []);

 const projectsForMultiSelect = useMemo(() => {
  if (isMobileShell) return safeProjects;
  if (activeSection === 'general' && generalProject) return [generalProject];
  return otherProjects;
 }, [activeSection, generalProject, isMobileShell, otherProjects, safeProjects]);

 const selectedSessionRefs = useMemo(
  () => collectSidebarSessionRefs(
   projectsForMultiSelect,
   multiSelectedKeys,
   (project) => collectSessionsForProject(project).map(({ session, sessionId }) => ({ session, sessionId })),
  ),
  [multiSelectedKeys, projectsForMultiSelect],
 );

 const selectAllVisibleForMultiSelect = useCallback(() => {
  const keys = new Set<string>();
  for (const project of projectsForMultiSelect) {
   for (const { sessionId } of collectSessionsForProject(project)) {
    if (isOptimisticSidebarSessionId(sessionId)) continue;
    keys.add(buildSidebarMultiSelectKey(project.name, sessionId));
   }
  }
  setMultiSelectedKeys(keys);
 }, [projectsForMultiSelect]);

 useEffect(() => {
  if (!multiSelectMode) return undefined;
  const onKeyDown = (event: globalThis.KeyboardEvent) => {
   if (event.key === 'Escape') exitMultiSelectMode();
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
 }, [exitMultiSelectMode, multiSelectMode]);

 const handleContextEnterMultiSelect = useCallback(() => {
  if (!contextMenu || contextMenu.kind !== 'session') return;
  enterMultiSelectMode(contextMenu.project, contextMenu.session);
 }, [contextMenu, enterMultiSelectMode]);

 // PD-SAAS-FORK: copy session display name + id for support / RCA paste.
 const handleContextCopySessionId = useCallback(() => {
  if (!contextMenu || contextMenu.kind !== 'session') return;
  const { session } = contextMenu;
  const sessionId = session.id;
  const name = sessionDisplayTitle(session);
  const text = t('sidebar:messages.copySessionIdClipboard', {
   name,
   id: sessionId,
   defaultValue: `名称：${name}\nID：${sessionId}`,
  });
  setContextMenu(null);
  void navigator.clipboard
   .writeText(String(text))
   .then(() => {
    showSidebarNoticeBesideSession(
     t('sidebar:messages.copySessionIdSuccess', { defaultValue: '已复制对话 ID 与名称' }),
     sessionId,
    );
   })
   .catch(() => {
    showSidebarNoticeBesideSession(
     t('sidebar:messages.copySessionIdFailed', { defaultValue: '复制失败，请重试' }),
     sessionId,
    );
   });
 }, [contextMenu, showSidebarNoticeBesideSession, t]);

 const handleBatchPause = useCallback(() => {
  for (const ref of filterBatchPauseSessions(selectedSessionRefs, processingSessions)) {
   sendMessage({ type: 'pause-turn', sessionId: ref.sessionId, reason: 'user_pause' });
   onSessionNotProcessing?.(ref.sessionId);
   onPatchSessionExecutionStatus?.(ref.sessionId, 'paused', 'user_pause');
  }
 }, [onPatchSessionExecutionStatus, onSessionNotProcessing, processingSessions, selectedSessionRefs, sendMessage]);

 const handleBatchResume = useCallback(() => {
  for (const ref of filterBatchResumeSessions(selectedSessionRefs)) {
   sendMessage({ type: 'unpause-session', sessionId: ref.sessionId, reason: 'user_resume' });
   onPatchSessionExecutionStatus?.(ref.sessionId, 'idle', null);
  }
 }, [onPatchSessionExecutionStatus, selectedSessionRefs, sendMessage]);

 const handleBatchComplete = useCallback(() => {
  for (const ref of filterBatchCompleteSessions(selectedSessionRefs)) {
   sendMessage({ type: 'pause-turn', sessionId: ref.sessionId, reason: 'user_complete_click' });
   onSessionNotProcessing?.(ref.sessionId);
   onPatchSessionExecutionStatus?.(ref.sessionId, 'paused', 'user_complete_click');
   setSessionSidebarCompleted(ref.sessionId, true);
  }
 }, [onPatchSessionExecutionStatus, onSessionNotProcessing, selectedSessionRefs, sendMessage]);

 const handleBatchUncomplete = useCallback(() => {
  for (const ref of filterBatchUncompleteSessions(selectedSessionRefs)) {
   sendMessage({ type: 'unpause-session', sessionId: ref.sessionId, reason: 'user_unmark_complete' });
   onPatchSessionExecutionStatus?.(ref.sessionId, 'idle', null);
   setSessionSidebarCompleted(ref.sessionId, false);
  }
 }, [onPatchSessionExecutionStatus, selectedSessionRefs, sendMessage]);

 const handleBatchLock = useCallback(() => {
  for (const ref of filterBatchLockSessions(selectedSessionRefs)) {
   setSessionSidebarLocked(ref.sessionId, true);
  }
 }, [selectedSessionRefs]);

 const handleBatchUnlock = useCallback(() => {
  for (const ref of filterBatchUnlockSessions(selectedSessionRefs)) {
   setSessionSidebarLocked(ref.sessionId, false);
  }
 }, [selectedSessionRefs]);

 const handleBatchDelete = useCallback(() => {
  const { deletable, lockedCount } = partitionBatchDeletableSessions(selectedSessionRefs);
  if (deletable.length === 0) {
   if (lockedCount > 0) {
    showSidebarNoticeBesideSession(
     t('sidebar:multiSelect.allLocked', {
      defaultValue: '所选对话均已锁定，请先解除锁定。',
     }) as string,
     selectedSessionRefs[0]?.sessionId ?? '',
    );
   }
   return;
  }
  if (lockedCount > 0) {
   showSidebarNoticeBesideSession(
    t('sidebar:multiSelect.skippedLocked', {
     count: lockedCount,
     defaultValue: '已跳过 {{count}} 条已锁定对话',
    }) as string,
    deletable[0]?.sessionId ?? '',
   );
  }
  exitMultiSelectMode();
  if (onRequestDeleteSessions) {
   onRequestDeleteSessions(deletable.map(({ project, session }) => ({ project, session })));
   return;
  }
  for (const ref of deletable) {
   onRequestDeleteSession(ref.project, ref.session);
  }
 }, [
  exitMultiSelectMode,
  onRequestDeleteSession,
  onRequestDeleteSessions,
  selectedSessionRefs,
  showSidebarNoticeBesideSession,
  t,
 ]);

 const multiSelectCapabilities = useMemo(() => {
  const deletable = partitionBatchDeletableSessions(selectedSessionRefs).deletable;
  return {
   canPause: filterBatchPauseSessions(selectedSessionRefs, processingSessions).length > 0,
   canResume: filterBatchResumeSessions(selectedSessionRefs).length > 0,
   canComplete: filterBatchCompleteSessions(selectedSessionRefs).length > 0,
   canUncomplete: filterBatchUncompleteSessions(selectedSessionRefs).length > 0,
   canLock: filterBatchLockSessions(selectedSessionRefs).length > 0,
   canUnlock: filterBatchUnlockSessions(selectedSessionRefs).length > 0,
   canDelete: deletable.length > 0,
  };
 }, [processingSessions, selectedSessionRefs]);

 const buildExportHtmlLabels = useCallback(() => ({
  exportedAt: t('sidebar:exportHtml.exportedAt', { defaultValue: '导出时间' }),
  project: t('sidebar:exportHtml.project', { defaultValue: '项目' }),
  sessionId: t('sidebar:exportHtml.sessionId', { defaultValue: '会话 ID' }),
  messageCount: t('sidebar:exportHtml.messageCount', { defaultValue: '消息数' }),
  messageId: t('sidebar:exportHtml.messageId', { defaultValue: '消息 ID' }),
  messageKind: t('sidebar:exportHtml.messageKind', { defaultValue: '消息类型' }),
  messageIndex: t('sidebar:exportHtml.messageIndex', { defaultValue: '序号' }),
  turnId: t('sidebar:exportHtml.turnId', { defaultValue: '轮次 ID' }),
  toolId: t('sidebar:exportHtml.toolId', { defaultValue: '工具 ID' }),
  runId: t('sidebar:exportHtml.runId', { defaultValue: '运行 ID' }),
  sequence: t('sidebar:exportHtml.sequence', { defaultValue: '序列号' }),
  messageIndexTable: t('sidebar:exportHtml.messageIndexTable', { defaultValue: '消息 ID 索引（调试用）' }),
  debugManifest: t('sidebar:exportHtml.debugManifest', { defaultValue: '结构化索引（JSON，便于脚本分析）' }),
  timestamp: t('sidebar:exportHtml.timestamp', { defaultValue: '时间' }),
  user: t('sidebar:exportHtml.user', { defaultValue: '用户' }),
  assistant: t('sidebar:exportHtml.assistant', { defaultValue: '助手' }),
  toolCall: t('sidebar:exportHtml.toolCall', { defaultValue: '工具调用' }),
  toolResult: t('sidebar:exportHtml.toolResult', { defaultValue: '工具结果' }),
  thinking: t('sidebar:exportHtml.thinking', { defaultValue: '思考过程' }),
  error: t('sidebar:exportHtml.error', { defaultValue: '错误' }),
  system: t('sidebar:exportHtml.system', { defaultValue: '系统' }),
  attachments: t('sidebar:exportHtml.attachments', { defaultValue: '附件' }),
  images: t('sidebar:exportHtml.images', { defaultValue: '图片' }),
  activity: t('sidebar:exportHtml.activity', { defaultValue: '活动' }),
  noMessages: t('sidebar:exportHtml.noMessages', { defaultValue: '暂无可导出的消息' }),
 }), [t]);

 // PD-SAAS-FORK: export mode branches share the same GET-only archive pipeline.
 const handleContextExportHtml = useCallback((mode: ExportSnapshotMode = 'user_archive') => {
 if (!contextMenu || contextMenu.kind !== 'session') return;
 const { project, session } = contextMenu;
 const sessionId = session.id;
 setContextMenu(null);
 if (exportingSessionId) return;
 setExportingSessionId(sessionId);
 void exportSessionToHtmlFile({
  project,
  session,
  mode,
  labels: buildExportHtmlLabels(),
 })
  .then(({ filename }) => {
   showSidebarNoticeBesideSession(
    t('sidebar:messages.exportHtmlSuccess', { filename, defaultValue: `已导出 ${filename}` }),
    sessionId,
   );
  })
  .catch((error) => {
   let message = t('sidebar:messages.exportHtmlFailed', { defaultValue: '导出失败，请稍后重试' });
   if (error instanceof Error) {
    if (error.message === 'export_validation_pending') {
     message = t('sidebar:messages.exportHtmlValidationPending', { defaultValue: '成果校验中，请稍后再导出' });
    } else if (error.message === 'HTTP 503' || error.message.includes('503')) {
     message = t('sidebar:messages.exportHtmlBusy', { defaultValue: '对话服务较忙，请稍后再导出' });
    } else if (error.name === 'TimeoutError' || /timeout|timed out/i.test(error.message)) {
     message = t('sidebar:messages.exportHtmlTimeout', { defaultValue: '导出超时，请稍后再试' });
    }
   }
   showSidebarNoticeBesideSession(message, sessionId);
  })
  .finally(() => {
   setExportingSessionId(null);
  });
 }, [buildExportHtmlLabels, contextMenu, exportingSessionId, showSidebarNoticeBesideSession, t]);

 const commitProjectRename = useCallback(() => {
 if (!renamingProject) return;
 setProjectCustomName(renamingProject, renameDraft);
 setRenamingProject(null);
 setRenameDraft('');
 }, [renamingProject, renameDraft]);

 const commitSessionRename = useCallback(() => {
 if (!renamingSession) return;
 if (isSessionSidebarLocked(renamingSession)) {
  setRenamingSession(null);
  setRenameDraft('');
  notifySessionLocked(renamingSession);
  return;
 }
 setSessionCustomTitle(renamingSession, renameDraft);
 setRenamingSession(null);
 setRenameDraft('');
 }, [notifySessionLocked, renamingSession, renameDraft]);

 const cancelRename = useCallback(() => {
 setRenamingProject(null);
 setRenamingSession(null);
 setRenameDraft('');
 }, []);

 const handleRenameKey = useCallback(
 (event: KeyboardEvent<HTMLInputElement>, kind: 'project' | 'session') => {
 if (event.key === 'Enter') {
 if (isImeEnterEvent(event)) {
 return;
 }
 event.preventDefault();
 if (kind === 'project') commitProjectRename();
 else commitSessionRename();
 } else if (event.key === 'Escape') {
 event.preventDefault();
 cancelRename();
 }
 },
 [cancelRename, commitProjectRename, commitSessionRename],
 );

 const renderSessionRows = (
 project: Project,
 options: { flat?: boolean } = {},
 ) => {
 const COLLAPSED_SESSION_LIMIT = SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT;
 const allSessions = collectSessionsForProject(project).slice(0, 500);
 const isCollapsed = collapsedSessionProjects.has(project.name);
 const sessions = isCollapsed ? allSessions.slice(0, COLLAPSED_SESSION_LIMIT) : allSessions;
 const hiddenLoadedCount = isCollapsed ? Math.max(0, allSessions.length - COLLAPSED_SESSION_LIMIT) : 0;
 // If `useProjectsState.bumpSessionActivity` has prepended an optimistic
 // `new-session-*` placeholder for this project, suppress the legacy
 // "+ New Session — not saved yet" draft button so we don't show two
 // stacked rows for the same in-flight session.
 const hasOptimisticSession = allSessions.some(({ session }) =>
 typeof session.id === 'string' && session.id.startsWith('new-session-'),
 );
 const showDraftSession =
 draftSessionProjectName === project.name &&
 selectedProject?.name === project.name &&
 activeTab === 'chat' &&
 !selectedSession &&
 !hasOptimisticSession;
 const totalSessions =
 typeof project.sessionMeta?.total === 'number' ? project.sessionMeta.total : null;
 const loadedSessionCount = Array.isArray(project.sessions) ? project.sessions.length : allSessions.length;
 const hasMoreSessions = shouldShowSidebarLoadMore({
   visibleSessionCount: allSessions.length,
   hasMore: project.sessionMeta?.hasMore,
   total: totalSessions,
   loadedSessionCount,
   previewLimit: COLLAPSED_SESSION_LIMIT,
 });
 const showLoadOlderSessions = shouldShowSidebarLoadOlder({
   hasOlderSessions: project.sessionMeta?.hasOlderSessions,
   showLoadMore: hasMoreSessions && Boolean(onLoadMoreSessions),
 });
 const isLoadingMore = Boolean(loadingMoreProjectIds?.has(project.name));
 const remaining =
 totalSessions !== null ? Math.max(0, totalSessions - allSessions.length) : null;

 // `flat` mode is used by the General tab where sessions are rendered as a
 // top-level list (no folder ancestor), so the usual nested indent would
 // leave a weird empty gutter on the left.
 /** Project-nested sessions: ml-6 (~24px) felt too wide — tighten ~2 字宽. */
 const containerClass = options.flat ? 'space-y-0.5' : 'ml-2 space-y-0.5';

 return (
 <div className={containerClass}>
 {showDraftSession ? (
 <button
 type="button"
 onClick={(event) => handleNewSession(event, project)}
 className="block w-full rounded-md bg-accent pl-1 pr-2 py-1 text-left text-foreground"
 >
 <div className="truncate text-[12.5px]">
 {t('sidebar:sessions.newSession', { defaultValue: 'New Session' })}
 </div>
 <div className="text-[11px] text-muted-foreground">
 {t('sidebar:sessions.unsaved', { defaultValue: 'Not saved yet' })}
 </div>
 </button>
 ) : null}

 {sessions.length > 0 ? (
 sessions.map(({ session, sessionId, lastActivity }) => {
 const isSessionActive =
 selectedProject?.name === project.name &&
 isSameSessionId(selectedSession?.id, sessionId) &&
 activeTab === 'chat';
 const isSessionRenaming = renamingSession === sessionId;
 // Optimistic placeholder rows are not yet backed by a real
 // session id on the server, so clicking / renaming / deleting
 // them is meaningless until the server's `projects_updated`
 // swaps in the real id (typically within ~300ms).
 const isOptimisticRow =
 typeof sessionId === 'string' && sessionId.startsWith('new-session-');
 const executionStatus = resolveSidebarSessionExecutionStatus({
   session,
   sessionId,
   isOptimisticRow,
   processingSessions,
 });
 const isSessionCompleted = isSessionSidebarCompleted(sessionId);
 const isSessionLocked = isSessionSidebarLocked(sessionId);
 const visualStatus = resolveSessionRowVisualStatus({
   session,
   sessionId,
   isCompleted: isSessionCompleted,
   isOptimisticRow,
   processingSessions,
   unreadSessionIds,
   needsUserInputSessionIds,
   interruptedSessionIds,
 });
 const statusLabel =
 visualStatus === 'completed'
 ? t('sidebar:sessions.statusIcon.completed', { defaultValue: 'Task complete' })
 : visualStatus === 'processing'
 ? t('sidebar:sessions.statusIcon.processing', { defaultValue: 'Agent is running' })
 : visualStatus === 'queued'
 ? t('sidebar:sessions.statusIcon.queued', { defaultValue: 'Queued' })
 : visualStatus === 'needs_user_input'
 ? t('sidebar:sessions.statusIcon.needsUserInput', { defaultValue: 'Waiting for your reply' })
 : visualStatus === 'interrupted'
 ? t('sidebar:sessions.statusIcon.interrupted', { defaultValue: 'Interrupted — you can continue' })
 : visualStatus === 'paused'
 ? t('sidebar:sessions.statusIcon.paused', { defaultValue: 'Paused' })
 : visualStatus === 'unread'
 ? t('sidebar:sessions.statusIcon.unread', { defaultValue: 'Unread updates' })
 : t('sidebar:sessions.statusIcon.idle', { defaultValue: 'Up to date' });
 const lockedLabel = t('sidebar:sessions.statusIcon.locked', { defaultValue: 'Locked' });
 const multiSelectKey = buildSidebarMultiSelectKey(project.name, sessionId);
 const isMultiSelected = multiSelectMode && multiSelectedKeys.has(multiSelectKey);

 return (
 <div
 key={sessionId}
 data-sidebar-session-id={normalizeSessionId(sessionId)}
 onMouseEnter={isOptimisticRow ? undefined : () => triggerSessionPrefetch(project, session)}
 onFocus={isOptimisticRow ? undefined : () => triggerSessionPrefetch(project, session)}
 onPointerDown={isOptimisticRow ? undefined : (event) => {
  if (event.button !== 0 || event.pointerType !== 'mouse') return;
  triggerSessionPrefetch(project, session, { immediate: true });
 }}
 onContextMenu={(event) =>
 isOptimisticRow || multiSelectMode ? undefined : openSessionContextMenu(event, project, session)
 }
 className={cn(
 'group/session relative w-full rounded-md border-l-2 transition-colors',
 isSessionActive
 ? 'border-primary bg-accent shadow-sm ring-1 ring-inset ring-primary/30'
 : 'border-transparent hover:bg-muted',
 isMultiSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/25',
 )}
 >
 {isSessionRenaming ? (
 <div className="flex items-center pl-1 pr-2 py-1">
 <input
 ref={renameInputRef}
 value={renameDraft}
 onChange={(event) => setRenameDraft(event.target.value)}
 onBlur={commitSessionRename}
 onKeyDown={(event) => handleRenameKey(event, 'session')}
 onClick={(event) => event.stopPropagation()}
 placeholder={t('sidebar:renamePlaceholder', { defaultValue: 'Rename - empty to reset' }) as string}
 className="w-full rounded-sm border border-border bg-card px-1.5 py-0.5 text-[12.5px] text-foreground outline-none focus:border-ring"
 />
 </div>
 ) : (
 <button
 type="button"
 onClick={() => {
  if (multiSelectMode && !isOptimisticRow) {
   toggleMultiSelectKey(project.name, sessionId);
   return;
  }
  handleSessionClick(project, sessionId);
 }}
 disabled={false}
 aria-current={isSessionActive ? 'page' : undefined}
 aria-pressed={multiSelectMode ? isMultiSelected : undefined}
 className={cn(
 'flex w-full items-start gap-1.5 pl-1 pr-2 py-1 text-left',
 isMobileShell && 'min-h-[48px] items-center py-2.5',
 isOptimisticRow && 'cursor-default',
 isSessionActive && 'font-medium',
 multiSelectMode && !isOptimisticRow && 'cursor-pointer',
 )}
 >
 {multiSelectMode && !isOptimisticRow ? (
  <span className="flex h-[18px] w-3 shrink-0 items-center justify-center pt-[3px]">
   {isMultiSelected ? (
    <CheckSquare className="h-3 w-3 text-primary" strokeWidth={2} aria-hidden />
   ) : (
    <Square className="h-3 w-3 text-muted-foreground/55" strokeWidth={2} aria-hidden />
   )}
  </span>
 ) : null}
 <SessionRowStatusIcons
 status={visualStatus}
 locked={isSessionLocked}
 labels={{ main: statusLabel, locked: lockedLabel }}
 />
 <div className="min-w-0 flex-1">
 <div
 className={cn(
 'flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-foreground',
 isSessionActive && 'font-semibold',
 isOptimisticRow && 'italic text-muted-foreground',
 isSessionCompleted && !isSessionActive && 'text-muted-foreground',
 )}
 >
 <span className="truncate">{sessionDisplayTitle(session)}</span>
 </div>
 <div className="text-[11px] text-muted-foreground">
 {executionStatus === 'queued'
 ? t('sidebar:sessions.queued', { defaultValue: 'Queued' })
 : executionStatus === 'paused'
 ? t('sidebar:sessions.paused', { defaultValue: 'Paused' })
 : isOptimisticRow
 ? t('sidebar:sessions.submitting', { defaultValue: 'Submitting…' })
 : formatRelative(lastActivity, t)}
 </div>
 </div>
 </button>
 )}

 </div>
 );
 })
 ) : (
 <div className="px-2 py-1 text-[11px] text-muted-foreground">
 {t('sidebar:sessions.noSessions', { defaultValue: 'No sessions yet' })}
 </div>
 )}

 {((isCollapsed && hiddenLoadedCount > 0) || (!isCollapsed && hasMoreSessions && onLoadMoreSessions)) ? (
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation();
 if (isLoadingMore) return;
 if (isCollapsed) {
  userExpandedSessionProjectsRef.current.add(project.name);
  setCollapsedSessionProjects((prev) => {
   const next = new Set(prev);
   next.delete(project.name);
   return next;
  });
 } else if (onLoadMoreSessions) {
 onLoadMoreSessions(project.name);
 }
 }}
 disabled={isLoadingMore}
 className={cn(
 'block w-full rounded-md px-2 py-1 text-left text-[11px] transition-colors',
 isLoadingMore
 ? 'text-muted-foreground'
 : 'text-muted-foreground hover:bg-muted hover:text-foreground',
 )}
 >
 {isLoadingMore
 ? t('sidebar:sessions.loadingMore', { defaultValue: 'Loading more…' })
 : (() => {
 const totalMore = hiddenLoadedCount + (remaining !== null && remaining > 0 ? remaining : 0);
 return totalMore > 0
 ? t('sidebar:sessions.showMoreCount', {
 count: totalMore,
 defaultValue: `更多对话记录 (${totalMore})`,
 })
 : t('sidebar:sessions.showMore', { defaultValue: '更多对话记录' });
 })()}
 </button>
 ) : null}

 {!isCollapsed && onLoadOlderSessions && !project.sessionMeta?.includeOlderLoaded
 && showLoadOlderSessions ? (
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation();
 if (isLoadingMore) return;
 onLoadOlderSessions(project.name);
 }}
 disabled={isLoadingMore}
 className="block w-full rounded-md px-2 py-1 text-left text-[11px] transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 {t('sidebar:sessions.loadOlder', { defaultValue: '查看更早对话' })}
 </button>
 ) : null}

 {!isCollapsed && allSessions.length > COLLAPSED_SESSION_LIMIT ? (
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation();
 userExpandedSessionProjectsRef.current.delete(project.name);
 setCollapsedSessionProjects((prev) => {
 const next = new Set(prev);
 next.add(project.name);
 return next;
 });
 }}
 className="block w-full rounded-md px-2 py-1 text-left text-[11px] transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 {t('sidebar:sessions.showLess', { defaultValue: 'Show less' })}
 </button>
 ) : null}
 </div>
 );
 };

 const renderProjectGroup = (project: Project, options: { isGeneral?: boolean } = {}) => {
 const isGeneral = Boolean(options.isGeneral);
 const isSelected = project.name === selectedProject?.name;
 const isExpanded = expandedGroups.has(project.name);
 const isRenaming = renamingProject === project.name;
 const label = isGeneral
 ? t('sidebar:general.name', { defaultValue: 'General' })
 : projectDisplayName(project);

 return (
 <div key={project.name} className="space-y-0.5">
 <div
 onContextMenu={(event) => openProjectContextMenu(event, project, isGeneral)}
 className={cn(
 'group/project flex h-8 w-full items-center rounded-lg pr-1 text-[13px] transition-colors',
 isSelected
 ? 'bg-accent text-foreground'
 : 'text-foreground hover:bg-muted',
 )}
 >
 {isRenaming && !isGeneral ? (
 <div className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 pr-1">
 <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <input
 ref={renameInputRef}
 value={renameDraft}
 onChange={(event) => setRenameDraft(event.target.value)}
 onBlur={commitProjectRename}
 onKeyDown={(event) => handleRenameKey(event, 'project')}
 onClick={(event) => event.stopPropagation()}
 placeholder={t('sidebar:renamePlaceholder', { defaultValue: 'Rename - empty to reset' }) as string}
 className="w-full rounded-sm border border-border bg-card px-1.5 py-0.5 text-[12.5px] text-foreground outline-none focus:border-ring"
 />
 </div>
 ) : (
 <button
 type="button"
 onClick={() => handleProjectClick(project)}
 className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-l-lg pl-1.5 pr-1 text-left"
 >
 <ChevronRight
 className={cn(
 'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
 isExpanded && 'rotate-90',
 )}
 strokeWidth={1.75}
 />
 <ProjectFolderIcon project={project} isSelected={isSelected} />
 <span className="flex-1 truncate">{label}</span>
 </button>
 )}

 {!isRenaming ? (
 <div
 className={cn(
 'ml-1 flex shrink-0 items-center gap-0.5 transition-opacity',
 '[@media(hover:none)]:opacity-100',
 isSelected
 ? 'opacity-100'
 : 'opacity-0 group-hover/project:opacity-100 focus-within:opacity-100',
 )}
 >
 <button
 type="button"
 onClick={(event) => handleNewSession(event, project)}
 aria-label={t('sidebar:tooltips.newChat', { defaultValue: 'New Chat' }) as string}
 title={t('sidebar:tooltips.newChat', { defaultValue: 'New Chat' }) as string}
 className={cn(
 'inline-flex h-6 w-6 items-center justify-center rounded-md',
 'text-muted-foreground hover:bg-accent hover:text-foreground',
 'dark:text-muted-foreground',
 )}
 >
 <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 </div>
 ) : null}
 </div>

 {isExpanded ? renderSessionRows(project) : null}
 </div>
 );
 };

 return (
 <aside
 data-sidebar-v2-root
 style={{ width: `${sidebarWidth}px` }}
 className={cn(
 // On mobile the parent wraps this aside in an overlay constrained
 // to 85vw, so force the inline width style off with !w-full there.
 'relative flex h-full shrink-0 flex-col max-md:!w-full',
 'bg-sidebar text-foreground',
 '',
 'border-r border-border',
 )}
 >
 <div className="flex h-12 items-center justify-between pl-2 pr-4">
 <div className="flex min-w-0 shrink items-center gap-2">
 <button
 type="button"
 onClick={() => setShowProductInfo(true)}
 aria-label={t('common:productInfo.openAbout') as string}
 title={t('common:productInfo.openAbout') as string}
 className="flex min-w-0 shrink items-center gap-2 rounded-md p-1 transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 >
 <img
 src={novaLogoMark}
 alt="Nova Ai-Studio"
 className="h-[1.2rem] w-auto max-w-[1.9rem] select-none object-contain"
 draggable={false}
 />
 </button>
 </div>
 {onCollapse ? (
 <button
 type="button"
 onClick={onCollapse}
 aria-label={t('sidebar:tooltips.hideSidebar', { defaultValue: 'Hide sidebar' }) as string}
 title={t('sidebar:tooltips.hideSidebar', { defaultValue: 'Hide sidebar' }) as string}
 className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
 </button>
 ) : null}
 </div>

 {/* PD-SAAS-FORK: mobile drawer hides Projects/General toggle — unified list below. */}
 {!isMobileShell ? (
 <div className="px-3 pt-1.5 pb-1">
 <div
 role="tablist"
 aria-label={t('sidebar:sectionToggle.label', { defaultValue: '侧栏分区' }) as string}
 className="flex w-full rounded-md bg-muted p-0.5"
 >
 <button
 type="button"
 role="tab"
 aria-selected={activeSection === 'projects'}
 onClick={handleProjectsSectionClick}
 className={cn(
 'flex-1 rounded text-[12px] font-medium transition-colors',
 'h-7 leading-none',
 activeSection === 'projects'
 ? 'bg-card text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground',
 )}
 >
 {t('sidebar:projects.title', { defaultValue: '项目' })}
 </button>
 <button
 type="button"
 role="tab"
 aria-selected={activeSection === 'general'}
 onClick={handleGeneralSectionClick}
 className={cn(
 'flex-1 rounded text-[12px] font-medium transition-colors',
 'h-7 leading-none',
 activeSection === 'general'
 ? 'bg-card text-foreground shadow-sm'
 : 'text-muted-foreground hover:text-foreground',
 )}
 >
 {t('sidebar:general.title', { defaultValue: '通用' })}
 </button>
 </div>
 </div>
 ) : null}

 <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2" ref={sessionListScrollRef}>
 {isLoading && safeProjects.length === 0 ? (
 <div className="px-2 py-4 text-xs text-muted-foreground">
 {t('sidebar:sessions.loading', { defaultValue: 'Loading...' })}
 </div>
 ) : isMobileShell ? (
 <section className="pt-2">
 {generalProject ? (
 <>
 <div className="flex items-center px-3 pb-1">
 <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">
 {t('common:tabs.chat', { defaultValue: '智能体' })}
 </span>
 <button
 type="button"
 onClick={(event) => handleNewSession(event, generalProject)}
 aria-label={t('sidebar:tooltips.newChat', { defaultValue: '新对话' }) as string}
 title={t('sidebar:tooltips.newChat', { defaultValue: '新对话' }) as string}
 className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} />
 </button>
 </div>
 <div className="px-1 pb-2">
 {renderSessionRows(generalProject, { flat: true })}
 </div>
 </>
 ) : null}
 <div className="flex items-center px-3 pb-1 pt-1">
 <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">
 {t('sidebar:projects.title', { defaultValue: '项目' })}
 </span>
 <button
 type="button"
 onClick={onCreateProject}
 aria-label={t('sidebar:projects.newProject', { defaultValue: '新建项目' }) as string}
 title={t('sidebar:projects.newProject', { defaultValue: '新建项目' }) as string}
 className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <Plus className="h-4 w-4" strokeWidth={1.75} />
 </button>
 </div>
 {otherProjects.length === 0 ? (
 <div className="px-3 py-1 text-[11px] text-muted-foreground">
 {t('sidebar:projects.noProjects', { defaultValue: '未找到项目' })}
 </div>
 ) : (
 <div className="space-y-0.5">
 {otherProjects.map((project) => renderProjectGroup(project))}
 </div>
 )}
 </section>
 ) : activeSection === 'projects' ? (
 <section className="pt-2">
 <div className="flex items-center px-3 pb-1">
 <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">
 {t('sidebar:projects.title', { defaultValue: 'Projects' })}
 </span>
 <button
 type="button"
 onClick={toggleAllProjectGroups}
 disabled={otherProjects.length === 0}
 aria-label={
 allProjectGroupsExpanded
 ? t('sidebar:projects.collapseAll', { defaultValue: 'Collapse all projects' }) as string
 : t('sidebar:projects.expandAll', { defaultValue: 'Expand all projects' }) as string
 }
 title={
 allProjectGroupsExpanded
 ? t('sidebar:projects.collapseAll', { defaultValue: 'Collapse all projects' }) as string
 : t('sidebar:projects.expandAll', { defaultValue: 'Expand all projects' }) as string
 }
 className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
 >
 {allProjectGroupsExpanded ? (
 <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={1.75} />
 ) : (
 <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 <button
 type="button"
 onClick={onCreateProject}
 aria-label={t('sidebar:projects.newProject', { defaultValue: 'New Project' }) as string}
 title={t('sidebar:projects.newProject', { defaultValue: 'New Project' }) as string}
 className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 </div>

 {otherProjects.length === 0 ? (
 <div className="px-3 py-1 text-[11px] text-muted-foreground">
 {t('sidebar:projects.noProjects', { defaultValue: 'No projects found' })}
 </div>
 ) : (
 <div className="space-y-0.5">
 {otherProjects.map((project) => renderProjectGroup(project))}
 </div>
 )}
 </section>
 ) : (
 <section className="pt-2">
 {generalProject ? (
 <>
 <div className="flex items-center px-3 pb-1">
 <span className="flex-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/90">
 {t('sidebar:general.title', { defaultValue: 'General' })}
 </span>
 <button
 type="button"
 onClick={(event) => handleNewSession(event, generalProject)}
 aria-label={t('sidebar:tooltips.newChat', { defaultValue: 'New Chat' }) as string}
 title={t('sidebar:tooltips.newChat', { defaultValue: 'New Chat' }) as string}
 className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 </div>
 <div className="px-1">
 {renderSessionRows(generalProject, { flat: true })}
 </div>
 </>
 ) : (
 <div className="px-3 py-1 text-[11px] text-muted-foreground">
 {t('sidebar:general.missing', {
 defaultValue: 'No general workspace found',
 })}
 </div>
 )}
 </section>
 )}
 </div>

 {multiSelectMode ? (
  <SidebarMultiSelectBar
   selectedCount={selectedSessionRefs.length}
   canPause={multiSelectCapabilities.canPause}
   canResume={multiSelectCapabilities.canResume}
   canComplete={multiSelectCapabilities.canComplete}
   canUncomplete={multiSelectCapabilities.canUncomplete}
   canLock={multiSelectCapabilities.canLock}
   canUnlock={multiSelectCapabilities.canUnlock}
   canDelete={multiSelectCapabilities.canDelete}
   onExit={exitMultiSelectMode}
   onSelectAll={selectAllVisibleForMultiSelect}
   onClearSelection={() => setMultiSelectedKeys(new Set())}
   onPause={handleBatchPause}
   onResume={handleBatchResume}
   onComplete={handleBatchComplete}
   onUncomplete={handleBatchUncomplete}
   onLock={handleBatchLock}
   onUnlock={handleBatchUnlock}
   onDelete={handleBatchDelete}
  />
 ) : null}

 {IS_SAAS_MODE ? (
 <>
 {/* PD-SAAS-FORK: N2 Bot β chip above account on official /app and Beta. */}
 <N2BotSidebarChip />
 <SaasSidebarAccount
 onShowSettings={!isMobileShell ? onShowSettings : undefined}
 onRequestLogout={!isMobileShell ? () => setShowLogoutConfirm(true) : undefined}
 />
 </>
 ) : null}

 {/* PD-SAAS-FORK: PC/Pad SaaS settings+logout on account strip; mobile footer kept; standalone PC keeps settings. */}
 {isMobileShell || !IS_SAAS_MODE ? (
 <div className="border-t border-border px-2 py-2">
 <div className="flex gap-1.5">
 <button
 type="button"
 onClick={onShowSettings}
 aria-label={t('sidebar:actions.settings', { defaultValue: 'Settings' }) as string}
 title={t('sidebar:actions.settings', { defaultValue: 'Settings' }) as string}
 className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
 >
 <SettingsIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
 <span className="truncate">{t('sidebar:actions.settings', { defaultValue: 'Settings' })}</span>
 </button>
 {IS_SAAS_MODE && isMobileShell ? (
 <button
 type="button"
 onClick={() => setShowLogoutConfirm(true)}
 aria-label={t('auth:logout.button') as string}
 title={t('auth:logout.button') as string}
 className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
 >
 <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
 <span className="truncate">{t('auth:logout.button')}</span>
 </button>
 ) : null}
 </div>
 </div>
 ) : null}

 <ProductInfoDialog open={showProductInfo} onClose={() => setShowProductInfo(false)} />

 {IS_SAAS_MODE ? (
 <SaasLogoutConfirm
 open={showLogoutConfirm}
 onCancel={() => setShowLogoutConfirm(false)}
 onConfirm={handleConfirmLogout}
 />
 ) : null}

 {contextMenu ? (
 <div
 role="menu"
 aria-label={t('sidebar:contextMenu.label', { defaultValue: 'Context menu' }) as string}
 onClick={(event) => event.stopPropagation()}
 onContextMenu={(event) => event.preventDefault()}
 className={cn(
 'fixed z-50 w-44 rounded-lg border border-border bg-card p-1 shadow-lg',
 'dark:border-border',
 )}
 style={{ left: contextMenu.x, top: contextMenu.y }}
 >
 {contextMenu.kind === 'session' ? (
 <>
 <button
 type="button"
 role="menuitem"
 onClick={handleContextEnterMultiSelect}
 className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-muted"
 >
 <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>{t('sidebar:actions.multiSelect', { defaultValue: '多选' })}</span>
 </button>
 <div className="my-1 h-px bg-border" role="separator" />
 {shouldShowContextResumeSession(contextMenu.session) ? (
 <button
 type="button"
 role="menuitem"
 onClick={handleContextResumeSession}
 className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-muted"
 >
 <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>{t('sidebar:actions.resumeSession', { defaultValue: 'Resume' })}</span>
 </button>
 ) : null}
 {shouldShowContextPauseSession(contextMenu.session, processingSessions) ? (
 <button
 type="button"
 role="menuitem"
 onClick={handleContextPauseSession}
 className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-muted"
 >
 <Pause className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>{t('sidebar:actions.pauseSession', { defaultValue: 'Pause' })}</span>
 </button>
 ) : null}
 {contextMenu.session.executionStatus === 'queued' ? (
 <button
 type="button"
 role="menuitem"
 onClick={handleContextCancelQueue}
 className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-muted"
 >
 <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>{t('sidebar:actions.cancelQueue', { defaultValue: 'Cancel queue' })}</span>
 </button>
 ) : null}
 <button
 type="button"
 role="menuitem"
 onClick={handleContextToggleComplete}
 className={cn(
 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
 'text-foreground hover:bg-muted',
 isSessionSidebarLocked(contextMenu.session.id) && 'opacity-55',
 )}
 >
 <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600/85 dark:text-emerald-400/85" strokeWidth={1.75} />
 <span>
 {isSessionSidebarCompleted(contextMenu.session.id)
 ? t('sidebar:actions.markTaskIncomplete', { defaultValue: 'Mark task incomplete' })
 : t('sidebar:actions.markTaskComplete', { defaultValue: 'Task complete' })}
 </span>
 </button>
 <button
 type="button"
 role="menuitem"
 onClick={handleContextToggleLock}
 className={cn(
 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
 'text-foreground hover:bg-muted',
 )}
 >
 {isSessionSidebarLocked(contextMenu.session.id) ? (
 <LockOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 ) : (
 <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 )}
 <span>
 {isSessionSidebarLocked(contextMenu.session.id)
 ? t('sidebar:actions.unlockSession', { defaultValue: 'Unlock' })
 : t('sidebar:actions.lockSession', { defaultValue: 'Lock' })}
 </span>
 </button>
 <button
 type="button"
 role="menuitem"
 onClick={() => handleContextExportHtml('user_archive')}
 disabled={exportingSessionId === contextMenu.session.id}
 className={cn(
 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
 'text-foreground hover:bg-muted',
 exportingSessionId === contextMenu.session.id && 'opacity-60',
 )}
 >
 <FileDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>
 {exportingSessionId === contextMenu.session.id
 ? t('sidebar:actions.exportingHtml', { defaultValue: '导出中…' })
 : (exportUserAuditModes
  ? t('sidebar:actions.exportHtmlArchive', { defaultValue: '导出归档 HTML' })
  : t('sidebar:actions.exportHtml', { defaultValue: '导出到 HTML' }))}
 </span>
 </button>
 {/* PD-SAAS-FORK: diagnostic export is runtime-gated; user archive remains the fallback. */}
 {exportUserAuditModes ? (
 <button
 type="button"
 role="menuitem"
 onClick={() => handleContextExportHtml('diagnostic')}
 disabled={exportingSessionId === contextMenu.session.id}
 className={cn(
 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
 'text-foreground hover:bg-muted',
 exportingSessionId === contextMenu.session.id && 'opacity-60',
 )}
 >
 <FileDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>
 {exportingSessionId === contextMenu.session.id
 ? t('sidebar:actions.exportingHtml', { defaultValue: '导出中…' })
 : t('sidebar:actions.exportHtmlDiagnostic', { defaultValue: '导出诊断 HTML' })}
 </span>
 </button>
 ) : null}
 <button
 type="button"
 role="menuitem"
 onClick={handleContextCopySessionId}
 className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-foreground hover:bg-muted"
 >
 <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>{t('sidebar:actions.copySessionId', { defaultValue: '复制对话 ID' })}</span>
 </button>
 <div className="my-1 h-px bg-border" role="separator" />
 </>
 ) : null}
 <button
 type="button"
 role="menuitem"
 onClick={handleContextRename}
 className={cn(
 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
 'text-foreground hover:bg-muted',
 contextMenu.kind === 'session' && isSessionSidebarLocked(contextMenu.session.id) && 'opacity-55',
 )}
 >
 <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 <span>{t('sidebar:actions.rename', { defaultValue: 'Rename' })}</span>
 </button>
 <button
 type="button"
 role="menuitem"
 onClick={handleContextDelete}
 className={cn(
 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
 contextMenu.kind === 'session' && isSessionSidebarLocked(contextMenu.session.id) && 'opacity-55',
 )}
 >
 <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
 <span>{t('sidebar:actions.delete', { defaultValue: 'Delete' })}</span>
 </button>
 </div>
 ) : null}

 {sidebarNotice ? (
 <div
 role="status"
 className={cn(
  'pointer-events-none fixed z-[70] w-[220px] rounded-lg border border-border bg-card/98 px-2.5 py-2 text-[11.5px] leading-snug text-muted-foreground shadow-lg backdrop-blur-sm',
  sidebarNotice.centered !== false && '-translate-y-1/2',
 )}
 style={{ top: sidebarNotice.top, left: sidebarNotice.left }}
 >
 {sidebarNotice.message}
 </div>
 ) : null}

 {/* Drag handle for resizing the sidebar. Sits flush against the right
 border, 4px wide; expands hit area on hover and shows a faint accent
 while dragging. Hidden on mobile (the overlay sidebar isn't resizable). */}
 <div
 role="separator"
 aria-orientation="vertical"
 aria-label={t('sidebar:tooltips.resize', { defaultValue: 'Resize sidebar' }) as string}
 title={t('sidebar:tooltips.resize', { defaultValue: 'Drag to resize' }) as string}
 onMouseDown={handleResizeStart}
 onDoubleClick={() => {
 setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
 try {
 window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(SIDEBAR_DEFAULT_WIDTH));
 } catch {
 // ignore
 }
 }}
 className={cn(
 'absolute inset-y-0 right-0 z-10 hidden w-1 cursor-col-resize select-none md:block',
 'transition-colors duration-150',
 isResizing
 ? 'bg-primary/60'
 : 'hover:bg-muted-foreground/30',
 )}
 />

 {/* While dragging, paint a fullscreen overlay so the cursor stays
 consistent and we don't accidentally select text in the main pane. */}
 {isResizing ? (
 <div
 className="fixed inset-0 z-[60] cursor-col-resize"
 style={{ userSelect: 'none' }}
 />
 ) : null}
 </aside>
 );
}
