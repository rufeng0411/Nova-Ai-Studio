import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { api } from '../utils/api';
import type {
  AppSocketMessage,
  AppTab,
  LoadingProgress,
  Project,
  ProjectSession,
  ProjectsUpdatedMessage,
} from '../types/app';
import { isBackgroundTaskSession } from '../types/app';
import {
  mergePendingSessionIntentIntoProjects,
  prunePendingSessionIntentsPresentInProjects,
  savePendingSessionIntent,
  stampPendingSessionRealId,
  clearPendingSessionIntent,
} from '../shared/pendingSessionIntent';
import { isSameSessionId } from '../shared/sessionId';
import {
  applySessionTombstones,
  isSessionTombstoned,
  mergeSessionListsRespectingTombstones,
  tombstoneDeletedProject,
  tombstoneDeletedSession,
} from '../shared/projectListTombstones';
import { sortProjectTreeByRecency, sortSessionsByRecency } from '../shared/sidebarRecencySort';
import { SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT } from '../shared/sidebarSessionPreviewLimit';
import { applySelectProjectAndSession, resetProjectSessionPreviewForSwitch } from '../shared/applySelectProjectAndSession';
import { fetchWithBackoff } from '../shared/fetchWithBackoff';

type UseProjectsStateArgs = {
  sessionId?: string;
  navigate: NavigateFunction;
  latestMessage: AppSocketMessage | null;
  isMobile: boolean;
  activeSessions: Set<string>;
};

type FetchProjectsOptions = {
  showLoadingState?: boolean;
  /** Skip in-flight coalesce so mutation-triggered refreshes always hit the network. */
  force?: boolean;
};

const SESSION_PAGE_SIZE = 30;

/** Fetch /api/projects with 503/429 backoff (login + WS reconnect coalesce here). */
export async function fetchProjectsListFromApi(forceFresh: boolean): Promise<Project[]> {
  const suffix = forceFresh ? `?fresh=1&_=${Date.now()}` : '';
  const { response } = await fetchWithBackoff(
    `/api/projects${suffix}`,
    {},
    { maxAttempts: 4, defaultRetryAfterMs: 2000 },
  );
  const payload = (await response.json().catch(() => null)) as Project[] | { error?: string } | null;
  if (response.ok && Array.isArray(payload)) {
    return payload;
  }
  const detail =
    payload && !Array.isArray(payload) && typeof payload.error === 'string'
      ? payload.error
      : `HTTP ${response.status}`;
  throw new Error(detail);
}

/**
 * Coalesce parallel /api/projects calls. `force` during an in-flight fetch queues one
 * follow-up fresh fetch instead of starting a second HTTP request (503 under backpressure).
 */
export function createProjectsFetchCoalescer(
  fetchOnce: (forceFresh: boolean) => Promise<Project[]>,
) {
  let inFlight: Promise<Project[]> | null = null;
  let needsForce = false;

  return async (force: boolean): Promise<Project[]> => {
    if (force) {
      needsForce = true;
    }
    if (!inFlight) {
      inFlight = (async () => {
        let result: Project[] = [];
        do {
          const forceFresh = needsForce;
          needsForce = false;
          result = await fetchOnce(forceFresh);
        } while (needsForce);
        return result;
      })().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}

const serialize = (value: unknown) => JSON.stringify(value ?? null);

export const projectsHaveChanges = (
  prevProjects: Project[],
  nextProjects: Project[],
  includeExternalSessions: boolean,
): boolean => {
  if (prevProjects.length !== nextProjects.length) {
    return true;
  }

  return nextProjects.some((nextProject, index) => {
    const prevProject = prevProjects[index];
    if (!prevProject) {
      return true;
    }

    const baseChanged =
      nextProject.name !== prevProject.name ||
      nextProject.displayName !== prevProject.displayName ||
      nextProject.fullPath !== prevProject.fullPath ||
      nextProject.lastActivity !== prevProject.lastActivity ||
      serialize(nextProject.alwaysOn) !== serialize(prevProject.alwaysOn) ||
      serialize(nextProject.sessionMeta) !== serialize(prevProject.sessionMeta) ||
      serialize(nextProject.sessions) !== serialize(prevProject.sessions) ||
      serialize(nextProject.taskmaster) !== serialize(prevProject.taskmaster);

    if (baseChanged) {
      return true;
    }

    if (!includeExternalSessions) {
      return false;
    }

    return false;
  });
};

const getProjectSessions = (project: Project): ProjectSession[] =>
  project.sessions ?? [];

// Local-only placeholders we prepend to a project's session list the moment
// the user submits a new-session message, so the sidebar reflects it without
// waiting for the server's debounced `projects_updated` round-trip. They are
// carried forward across `projects_updated` events (so an unrelated update
// fired between submit and chokidar can't flicker them away) and replaced
// in-place via `replaceOptimisticInProjects` once the real id arrives via
// `session_created`, or dropped via `dropOptimisticInProjects` on
// completion/abort if no real id was ever assigned.
const isTemporarySessionId = (id: unknown): boolean =>
  typeof id === 'string' && id.startsWith('new-session-');

// On Windows, session keys like `web:s_<uuid>` are sanitized to `web-s_<uuid>`
// for disk storage. Normalize to the disk form so that in-memory state
// (from session_created) matches server listings (from filenames).
const normalizeSessionId = (id: string): string => id.replace(/^web:s_/, 'web-s_');
const sessionTranscriptFilename = (id: string): string => `${normalizeSessionId(id)}.jsonl`;

/** Preserve in-flight queued/running rows until server catalog lists them (turn_accepted lag). */
const shouldPreserveInFlightSession = (
  session: ProjectSession,
  updatedIds: Set<string>,
): boolean => {
  if (updatedIds.has(normalizeSessionId(session.id))) return false;
  if (isTemporarySessionId(session.id)) return false;
  return session.executionStatus === 'queued' || session.executionStatus === 'running';
};

export const preserveLoadedSessions = (prevProjects: Project[], nextProjects: Project[]): Project[] =>
  nextProjects.map((updated) => {
    const prev = prevProjects.find((p) => p.name === updated.name);
    if (!prev) return updated;
    const includeOlderLoaded = Boolean(updated.sessionMeta?.includeOlderLoaded);
    const prevSessions = prev.sessions ?? [];
    const updatedSessions = updated.sessions ?? [];
    const updatedIds = new Set(updatedSessions.map((s) => normalizeSessionId(s.id)));
    const optimisticToKeep = prevSessions.filter(
      (s) => isTemporarySessionId(s.id) && !updatedIds.has(normalizeSessionId(s.id)),
    );
    const activeExecutionToKeep = prevSessions.filter((s) =>
      shouldPreserveInFlightSession(s, updatedIds),
    );
    if (!includeOlderLoaded) {
      return applySessionTombstones([
        {
          ...updated,
          sessions: sortSessionsByRecency([...optimisticToKeep, ...activeExecutionToKeep, ...updatedSessions]),
        },
      ])[0] ?? updated;
    }
    const prevRealSessions = prevSessions.filter(
      (s) => !isTemporarySessionId(s.id) && !isSessionTombstoned(s.id),
    );
    if (prevRealSessions.length <= updatedSessions.length) {
      if (optimisticToKeep.length === 0 && activeExecutionToKeep.length === 0) {
        return applySessionTombstones([{
          ...updated,
          sessions: sortSessionsByRecency(updatedSessions),
        }])[0] ?? updated;
      }
      return applySessionTombstones([
        {
          ...updated,
          sessions: sortSessionsByRecency([...optimisticToKeep, ...activeExecutionToKeep, ...updatedSessions]),
        },
      ])[0] ?? updated;
    }
    const merged = sortSessionsByRecency([
      ...optimisticToKeep,
      ...activeExecutionToKeep,
      ...updatedSessions,
      ...prevRealSessions.filter((s) => !updatedIds.has(normalizeSessionId(s.id))),
    ]);
    return applySessionTombstones([
      {
        ...updated,
        sessions: merged,
        sessionMeta: {
          ...updated.sessionMeta,
          hasMore: prev.sessionMeta?.hasMore ?? updated.sessionMeta?.hasMore,
          total: prev.sessionMeta?.total ?? updated.sessionMeta?.total,
        },
      },
    ])[0] ?? updated;
  });

/**
 * Merge server project list into local state while preserving optimistic create rows
 * and loaded session pages until the server catches up.
 */
export function mergeProjectsWithServerList(
  prevProjects: Project[],
  serverProjects: Project[],
): Project[] {
  prunePendingSessionIntentsPresentInProjects(serverProjects);
  const normalizedServer = sortProjectTreeByRecency(mergePendingSessionIntentIntoProjects(serverProjects));
  if (prevProjects.length === 0) {
    return normalizedServer;
  }

  const serverNameSet = new Set(normalizedServer.map((project) => project.name));
  const withSessions = preserveLoadedSessions(prevProjects, normalizedServer).map((project) => {
    if (!serverNameSet.has(project.name)) return project;
    if (!project.sidebarSyncPending) return project;
    return { ...project, sidebarSyncPending: undefined };
  });
  const serverNames = new Set(withSessions.map((project) => project.name));
  const pendingCreates = prevProjects.filter(
    (project) => project.sidebarSyncPending && !serverNames.has(project.name),
  );
  const merged =
    pendingCreates.length > 0 ? [...withSessions, ...pendingCreates] : withSessions;

  const pendingNowSynced = prevProjects.some(
    (project) => project.sidebarSyncPending && serverNameSet.has(project.name),
  );
  if (!projectsHaveChanges(prevProjects, merged, true) && !pendingNowSynced) {
    return prevProjects;
  }
  return applySessionTombstones(sortProjectTreeByRecency(merged));
}

/**
 * Merge a `projects_updated` payload into local state without spurious
 * reference churn. Returns `prevProjects` when nothing meaningful changed
 * so React can skip re-renders and effects won't re-fire on `projects`.
 */
export function applyProjectsSocketUpdate(
  prevProjects: Project[],
  updatedProjects: Project[],
): Project[] {
  if (prevProjects.length === 0) {
    return updatedProjects;
  }
  return mergeProjectsWithServerList(prevProjects, updatedProjects);
}

const resetProjectSessionPreview = resetProjectSessionPreviewForSwitch;

const projectFromCreatePayload = (raw?: Record<string, unknown>): Project | null => {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const displayName =
    typeof raw?.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : name;
  const fullPath =
    typeof raw?.fullPath === 'string'
      ? raw.fullPath
      : typeof raw?.path === 'string'
        ? raw.path
        : '';
  return {
    name,
    displayName,
    fullPath,
    path: typeof raw?.path === 'string' ? raw.path : fullPath,
    sessionProjectKey:
      typeof raw?.sessionProjectKey === 'string' ? raw.sessionProjectKey : undefined,
    storageKind: raw?.storageKind === 'cloud' ? 'cloud' : undefined,
    syncEnabled: raw?.syncEnabled === true ? true : undefined,
    sidebarSyncPending: true,
    lastActivity: Date.now(),
    sessions: [],
    sessionMeta: { total: 0, hasMore: false },
    taskmaster: { hasTaskmaster: false },
    alwaysOn: { enabled: false },
  };
};

const isUpdateAdditive = (
  currentProjects: Project[],
  updatedProjects: Project[],
  selectedProject: Project | null,
  selectedSession: ProjectSession | null,
): boolean => {
  if (!selectedProject || !selectedSession) {
    return true;
  }

  const currentSelectedProject = currentProjects.find((project) => project.name === selectedProject.name);
  const updatedSelectedProject = updatedProjects.find((project) => project.name === selectedProject.name);

  if (!currentSelectedProject || !updatedSelectedProject) {
    return false;
  }

  const currentSelectedSession = getProjectSessions(currentSelectedProject).find(
    (session) => session.id === selectedSession.id,
  );
  const updatedSelectedSession = getProjectSessions(updatedSelectedProject).find(
    (session) => session.id === selectedSession.id,
  );

  if (!currentSelectedSession || !updatedSelectedSession) {
    return false;
  }

  return (
    currentSelectedSession.id === updatedSelectedSession.id &&
    currentSelectedSession.title === updatedSelectedSession.title &&
    currentSelectedSession.created_at === updatedSelectedSession.created_at &&
    currentSelectedSession.updated_at === updatedSelectedSession.updated_at
  );
};

const VALID_TABS: Set<string> = new Set([
  'home',
  'chat',
  'always-on',
  'files',
  'shell',
  'git',
  'tasks',
  'memory',
  'skills',
  'preview',
  'dashboard',
]);

const isValidTab = (tab: string): tab is AppTab => {
  return VALID_TABS.has(tab) || tab.startsWith('plugin:');
};

const readPersistedTab = (): AppTab => {
  // PD-SAAS-FORK: PWA shortcut deep-links (?tab=chat / ?tab=discover) win
  // over the persisted tab so home-screen shortcuts land where they promise.
  try {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab === 'chat' || urlTab === 'discover') {
      return urlTab;
    }
  } catch {
    // URL parsing unavailable
  }
  try {
    const stored = localStorage.getItem('activeTab');
    if (stored === 'home') {
      return 'chat';
    }
    // PD-SAAS-FORK: skills tab moved to admin — fall back to capability hub.
    if (stored === 'skills') {
      return 'discover';
    }
    if (stored && isValidTab(stored)) {
      return stored as AppTab;
    }
  } catch {
    // localStorage unavailable
  }
  return 'chat';
};

export function useProjectsState({
  sessionId,
  navigate,
  latestMessage,
  isMobile,
  activeSessions,
}: UseProjectsStateArgs) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedSession, setSelectedSession] = useState<ProjectSession | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>(readPersistedTab);

  useEffect(() => {
    try {
      localStorage.setItem('activeTab', activeTab);
    } catch {
      // Silently ignore storage errors
    }
  }, [activeTab]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('appearance');
  const [externalMessageUpdate, setExternalMessageUpdate] = useState(0);

  const loadingProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectsFetchCoalescerRef = useRef(createProjectsFetchCoalescer(fetchProjectsListFromApi));

  // Track when a session was first selected so the projects_updated handler
  const prevTrackedSessionIdRef = useRef<string | null>(null);
  if (selectedSession?.id !== prevTrackedSessionIdRef.current) {
    prevTrackedSessionIdRef.current = selectedSession?.id ?? null;
  }

  // Mirror `projects` into a ref so async callbacks can read the latest list
  // without closing over stale state (e.g. loadMoreSessions early-bail check).
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const fetchProjects = useCallback(async ({ showLoadingState = true, force = false }: FetchProjectsOptions = {}) => {
    try {
      if (showLoadingState) {
        setIsLoadingProjects(true);
      }
      const projectData = await projectsFetchCoalescerRef.current(force);

      if (!Array.isArray(projectData)) {
        console.error('Error fetching projects: expected array, got', projectData);
        return;
      }

      setProjects((prevProjects) => mergeProjectsWithServerList(prevProjects, projectData));
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      if (showLoadingState) {
        setIsLoadingProjects(false);
      }
    }
  }, []);

  const refreshProjectsSilently = useCallback(async (options?: { force?: boolean }) => {
    // Keep chat view stable while still syncing sidebar/session metadata in background.
    await fetchProjects({ showLoadingState: false, force: options?.force ?? true });
  }, [fetchProjects]);

  const upsertCreatedProject = useCallback((raw?: Record<string, unknown>): Project | null => {
    const entry = projectFromCreatePayload(raw);
    if (!entry) return null;
    setProjects((prevProjects) => {
      const existingIndex = prevProjects.findIndex((project) => project.name === entry.name);
      if (existingIndex >= 0) {
        const next = [...prevProjects];
        next[existingIndex] = { ...next[existingIndex], ...entry, sidebarSyncPending: true };
        return next;
      }
      return [...prevProjects, entry];
    });
    return entry;
  }, []);

  const openSettings = useCallback((tab = 'appearance') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  useEffect(() => {
    // PD-SAAS-FORK: bypass Redis sidebar cache on cold load so deleted rows cannot reappear after F5.
    void fetchProjects({ force: true });
  }, [fetchProjects]);

  // Auto-select the project when there is only one, so the user lands on the new session page
  useEffect(() => {
    if (!isLoadingProjects && projects.length === 1 && !selectedProject && !sessionId) {
      setSelectedProject(projects[0]);
    }
  }, [isLoadingProjects, projects, selectedProject, sessionId]);

  useEffect(() => {
    if (!latestMessage) {
      return;
    }

    if (latestMessage.type === 'loading_progress') {
      if (loadingProgressTimeoutRef.current) {
        clearTimeout(loadingProgressTimeoutRef.current);
        loadingProgressTimeoutRef.current = null;
      }

      setLoadingProgress(latestMessage as LoadingProgress);

      if (latestMessage.phase === 'complete') {
        loadingProgressTimeoutRef.current = setTimeout(() => {
          setLoadingProgress(null);
          loadingProgressTimeoutRef.current = null;
        }, 500);
      }

      return;
    }

    if (latestMessage.type !== 'projects_updated') {
      return;
    }

    const projectsMessage = latestMessage as ProjectsUpdatedMessage;

    if (projectsMessage.changedFile && selectedSession && selectedProject) {
      const normalized = projectsMessage.changedFile.replace(/\\/g, '/');
      const projectPrefix = `${selectedProject.name}/`;
      const projectRelativeChanged = normalized.startsWith(projectPrefix)
        ? normalized.slice(projectPrefix.length)
        : '';
      const isSelectedBackgroundTranscriptChange =
        isBackgroundTaskSession(selectedSession) &&
        projectRelativeChanged === selectedSession.relativeTranscriptPath;
      const isMainSessionChange =
        !isBackgroundTaskSession(selectedSession) &&
        projectRelativeChanged === sessionTranscriptFilename(selectedSession.id);

      if (isMainSessionChange || isSelectedBackgroundTranscriptChange) {
        const isSessionActive = activeSessions.has(selectedSession.id);

        if (!isSessionActive) {
          setExternalMessageUpdate((prev) => prev + 1);
        }
      }
    }

    const hasActiveSession =
      (selectedSession && activeSessions.has(selectedSession.id)) ||
      (activeSessions.size > 0 && Array.from(activeSessions).some((id) => id.startsWith('new-session-')));

    const updatedProjects = projectsMessage.projects;

    // While a session is streaming we must NOT replace `selectedProject` /
    // `selectedSession` mid-flight (the chat pane and downstream hooks key
    // off the session reference and would re-load / re-render unexpectedly).
    // However, we DO still want the sidebar to reflect the new `updated_at`
    // / `lastActivity` for the streaming session — that's the whole point
    // of broadcasting `projects_updated`. The earlier implementation bailed
    // out of the entire handler here, which left the sidebar stale until
    // the user manually refreshed.
    const skipSelectedReplacement =
      hasActiveSession &&
      !isUpdateAdditive(
        projectsRef.current,
        updatedProjects,
        selectedProject,
        selectedSession,
      );

    setProjects((prevProjects) => applyProjectsSocketUpdate(prevProjects, updatedProjects));

    if (skipSelectedReplacement) {
      return;
    }

    if (!selectedProject) {
      return;
    }

    const updatedSelectedProject = updatedProjects.find(
      (project) => project.name === selectedProject.name,
    );

    if (!updatedSelectedProject) {
      return;
    }

    if (serialize(updatedSelectedProject) !== serialize(selectedProject)) {
      setSelectedProject(updatedSelectedProject);
    }

    if (!selectedSession) {
      return;
    }

    const updatedSelectedSession = getProjectSessions(updatedSelectedProject).find(
      (session) => session.id === selectedSession.id,
    );

    if (!updatedSelectedSession) {
      // The session is absent from the truncated project list (only the
      // top-N sessions are included in projects_updated for performance).
      // This does NOT mean the session was deleted — it may simply be
      // older than the top-N cut-off, or the file watcher hasn't indexed
      // a brand-new session yet.
      //
      // Never clear selectedSession here. The only paths that should
      // clear it are explicit user actions: switching projects, starting
      // a new session, or deleting the session/project.
      return;
    }

    const normalizedUpdatedSelectedSession = updatedSelectedSession;

    if (serialize(normalizedUpdatedSelectedSession) !== serialize(selectedSession)) {
      setSelectedSession(normalizedUpdatedSelectedSession);
    }
  }, [latestMessage, selectedProject, selectedSession, activeSessions]);

  useEffect(() => {
    return () => {
      if (loadingProgressTimeoutRef.current) {
        clearTimeout(loadingProgressTimeoutRef.current);
        loadingProgressTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId || projects.length === 0) {
      return;
    }

    for (const project of projects) {
      const session = project.sessions?.find((s) => isSameSessionId(s.id, sessionId));
      if (session) {
        if (selectedProject?.name !== project.name) {
          setSelectedProject(project);
        }
        if (selectedSession?.id !== sessionId) {
          setSelectedSession(session);
        }
        return;
      }
    }
  }, [sessionId, projects, selectedProject?.name, selectedSession?.id]);

  const handleProjectSelect = useCallback(
    (project: Project) => {
      const previewProject = resetProjectSessionPreview(project);
      setSelectedProject(previewProject);
      setSelectedSession(null);
      setProjects((prevProjects) => prevProjects.map(resetProjectSessionPreview));
      navigate('/');

      if (isMobile) {
        setSidebarOpen(false);
      }
    },
    [isMobile, navigate],
  );

  const handleSessionSelect = useCallback(
    (session: ProjectSession) => {
      setSelectedSession(session);

      if (activeTab === 'tasks' || activeTab === 'preview') {
        setActiveTab('chat');
      }

      if (isMobile) {
        const sessionProjectName = session.__projectName;
        const currentProjectName = selectedProject?.name;

        if (sessionProjectName !== currentProjectName) {
          setSidebarOpen(false);
        }
      }

      navigate(`/session/${session.id}`);
    },
    [activeTab, isMobile, navigate, selectedProject?.name],
  );

  // PD-SAAS-FORK: atomic cross-project switch — never null session + navigate('/')
  const selectProjectAndSession = useCallback(
    (project: Project, session: ProjectSession) => {
      const result = applySelectProjectAndSession(
        { project, session, previousProjectName: selectedProject?.name },
        { projects, activeTab },
      );
      setSelectedProject(result.selectedProject);
      setSelectedSession(result.selectedSession);
      setProjects(result.projects);
      if (result.shouldSwitchChatTab) {
        setActiveTab('chat');
      }
      if (isMobile) {
        setSidebarOpen(false);
      }
      navigate(result.navigateTo);
    },
    [activeTab, isMobile, navigate, projects, selectedProject?.name],
  );

  const handleNewSession = useCallback(
    (project: Project) => {
      setSelectedProject(project);
      setSelectedSession(null);
      setActiveTab('chat');
      navigate('/');

      if (isMobile) {
        setSidebarOpen(false);
      }
    },
    [isMobile, navigate],
  );

	  const handleSessionDelete = useCallback(
	    (sessionIdToDelete: string) => {
	      const normalizedDeleteId = normalizeSessionId(sessionIdToDelete);
	      // PD-SAAS-FORK: sync tombstone before async refresh — preserveLoadedSessions must not resurrect.
	      tombstoneDeletedSession(sessionIdToDelete);
	      if (selectedSession && normalizeSessionId(selectedSession.id) === normalizedDeleteId) {
	        setSelectedSession(null);
	        navigate('/');
	      }

	      setProjects((prevProjects) =>
	        prevProjects.map((project) => {
	          const hadSession = (project.sessions ?? []).some(
	            (session) => normalizeSessionId(session.id) === normalizedDeleteId,
	          );

	          return {
	            ...project,
	            sessions: project.sessions?.filter(
	              (session) => normalizeSessionId(session.id) !== normalizedDeleteId,
	            ) ?? [],
	            sessionMeta: {
	              ...project.sessionMeta,
	              total: hadSession
	                ? Math.max(0, (project.sessionMeta?.total as number | undefined ?? 0) - 1)
	                : project.sessionMeta?.total,
	            },
	          };
	        }),
	      );
	    },
    [navigate, selectedSession],
  );

  // The /api/projects payload caps each project's sessions array at 10 for a
  // snappy first paint. Sidebar exposes a "更多对话记录" affordance backed by
  // this action: it pages through /api/projects/:name/sessions?limit=&offset=
  // names so the button can render a loading state and reject re-entrancy.
  const loadingMoreSessionsRef = useRef<Set<string>>(new Set());
  const [loadingMoreProjectIds, setLoadingMoreProjectIds] = useState<Set<string>>(new Set());

  const setProjectLoading = useCallback((projectName: string, loading: boolean) => {
    if (loading) loadingMoreSessionsRef.current.add(projectName);
    else loadingMoreSessionsRef.current.delete(projectName);
    setLoadingMoreProjectIds(new Set(loadingMoreSessionsRef.current));
  }, []);

  const loadMoreSessions = useCallback(
    async (projectName: string) => {
      if (!projectName) return;
      if (loadingMoreSessionsRef.current.has(projectName)) return;

      const project = projectsRef.current.find((p) => p.name === projectName);
      if (!project) return;
      if (project.sessionMeta?.hasMore === false) return;

      const offset = (project.sessions ?? []).length;
      setProjectLoading(projectName, true);

      try {
        const response = await api.sessions(projectName, SESSION_PAGE_SIZE, offset);
        if (!response.ok) {
          throw new Error(`Failed to load sessions: ${response.status}`);
        }
        const data = (await response.json()) as {
          sessions?: ProjectSession[];
          hasMore?: boolean;
          total?: number;
        };
        const incoming = Array.isArray(data.sessions) ? data.sessions : [];

        const mergeSessions = (existing: ProjectSession[]): ProjectSession[] =>
          mergeSessionListsRespectingTombstones(existing, incoming);

        const applyToProject = (target: Project): Project => {
          const merged = applySessionTombstones([
            {
              ...target,
              sessions: mergeSessions(target.sessions ?? []),
              sessionMeta: {
                ...(target.sessionMeta ?? {}),
                hasMore: Boolean(data.hasMore),
                total: typeof data.total === 'number' ? data.total : target.sessionMeta?.total,
              },
            },
          ])[0];
          return merged ?? target;
        };

        setProjects((prevProjects) =>
          prevProjects.map((p) => (p.name === projectName ? applyToProject(p) : p)),
        );

        setSelectedProject((prev) =>
          prev && prev.name === projectName ? applyToProject(prev) : prev,
        );
      } catch (error) {
        console.error('loadMoreSessions failed for project', projectName, error);
      } finally {
        setProjectLoading(projectName, false);
      }
    },
    [setProjectLoading],
  );

  const loadOlderSessions = useCallback(
    async (projectName: string) => {
      if (!projectName || loadingMoreSessionsRef.current.has(projectName)) return;
      setProjectLoading(projectName, true);
      try {
        const response = await api.sessions(projectName, 30, 0, { includeOlder: true });
        if (!response.ok) throw new Error(`Failed to load older sessions: ${response.status}`);
        const data = (await response.json()) as {
          sessions?: ProjectSession[];
          hasMore?: boolean;
          total?: number;
          hasOlderSessions?: boolean;
        };
        const incoming = Array.isArray(data.sessions) ? data.sessions : [];
        const mergeSessions = (existing: ProjectSession[]): ProjectSession[] =>
          mergeSessionListsRespectingTombstones(existing, incoming);

        const applyToProject = (target: Project): Project => {
          const merged = applySessionTombstones([
            {
              ...target,
              sessions: mergeSessions(target.sessions ?? []),
              sessionMeta: {
                ...(target.sessionMeta ?? {}),
                hasMore: Boolean(data.hasMore),
                total: typeof data.total === 'number' ? data.total : target.sessionMeta?.total,
                hasOlderSessions: false,
                includeOlderLoaded: true,
              },
            },
          ])[0];
          return merged ?? target;
        };

        setProjects((prev) => prev.map((p) => (p.name === projectName ? applyToProject(p) : p)));
        setSelectedProject((prev) =>
          prev && prev.name === projectName ? applyToProject(prev) : prev,
        );
      } catch (error) {
        console.error('loadOlderSessions failed for project', projectName, error);
      } finally {
        setProjectLoading(projectName, false);
      }
    },
    [setProjectLoading],
  );

  const handleSidebarRefresh = useCallback(async () => {
    try {
      const response = await api.projects();
      const freshProjects = (await response.json()) as Project[];

      setProjects((prevProjects) => mergeProjectsWithServerList(prevProjects, freshProjects));

      if (!selectedProject) {
        return;
      }

      const refreshedProject = freshProjects.find((project) => project.name === selectedProject.name);
      if (!refreshedProject) {
        return;
      }

      if (serialize(refreshedProject) !== serialize(selectedProject)) {
        setSelectedProject(refreshedProject);
      }

      if (!selectedSession) {
        return;
      }

      const refreshedSession = getProjectSessions(refreshedProject).find(
        (session) => session.id === selectedSession.id,
      );

      if (refreshedSession) {
        if (serialize(refreshedSession) !== serialize(selectedSession)) {
          setSelectedSession(refreshedSession);
        }
      }
    } catch (error) {
      console.error('Error refreshing sidebar:', error);
    }
  }, [selectedProject, selectedSession]);

  const handleProjectDelete = useCallback(
    (projectName: string) => {
      tombstoneDeletedProject(projectName);
      if (selectedProject?.name === projectName) {
        setSelectedProject(null);
        setSelectedSession(null);
        navigate('/');
      }

      setProjects((prevProjects) => prevProjects.filter((project) => project.name !== projectName));
    },
    [navigate, selectedProject?.name],
  );

  const handleDeselectProject = useCallback(() => {
    setSelectedProject(null);
    setSelectedSession(null);
    setProjects((prevProjects) => prevProjects.map(resetProjectSessionPreview));
    navigate('/');
  }, [navigate]);

  // Optimistic sidebar update for the moment a user submits a message.
  // We do NOT wait for the server's chokidar-debounced `projects_updated`
  // round-trip — instead we either bump the existing session's lastActivity
  // (so "sort by date" reorders immediately) or prepend a placeholder
  // entry for a brand-new session. The placeholder uses a `new-session-*`
  // id and is filtered out automatically the next time `preserveLoadedSessions`
  // runs against a server payload.
  const bumpSessionActivity = useCallback(
    (projectName: string, sessionId: string, optimisticTitle?: string) => {
      if (!projectName || !sessionId) return;
      const now = new Date().toISOString();

      const apply = (project: Project): Project => {
        if (project.name !== projectName) return project;
        const sessions = project.sessions ?? [];
        const idx = sessions.findIndex((s) => s.id === sessionId);

        if (idx >= 0) {
          const bumped: ProjectSession = {
            ...sessions[idx],
            updated_at: now,
            lastActivity: now,
          };
          const reordered = sortSessionsByRecency([bumped, ...sessions.filter((s) => s.id !== sessionId)]);
          return { ...project, lastActivity: now, sessions: reordered };
        }

        const trimmedTitle = (optimisticTitle ?? '').replace(/\s+/g, ' ').trim();
        const placeholder: ProjectSession = {
          id: sessionId,
          title: trimmedTitle ? trimmedTitle.slice(0, 80) : 'New session',
          created_at: now,
          updated_at: now,
          lastActivity: now,
          messageCount: 0,
          __projectName: projectName,
        };
        if (isTemporarySessionId(sessionId)) {
          savePendingSessionIntent({
            optimisticId: sessionId,
            projectKey: projectName,
            projectName,
            firstPrompt: trimmedTitle,
          });
        }
        return {
          ...project,
          lastActivity: now,
          sessions: sortSessionsByRecency([placeholder, ...sessions]),
          sessionMeta: {
            ...(project.sessionMeta ?? {}),
            total:
              typeof project.sessionMeta?.total === 'number'
                ? project.sessionMeta.total + 1
                : project.sessionMeta?.total,
          },
        };
      };

      setProjects((prev) => prev.map(apply));
      setSelectedProject((prev) => (prev && prev.name === projectName ? apply(prev) : prev));
    },
    [],
  );

  // Swap a `new-session-*` placeholder for the real id the server just
  // assigned (fired on `session_created`). We replace in-place so the row
  // doesn't flicker, and dedupe if `projects_updated` already brought the
  // real session in.
  const replaceOptimisticInProjects = useCallback((realSessionId: string) => {
    if (!realSessionId || isTemporarySessionId(realSessionId)) return;
    const apply = (project: Project): Project => {
      const sessions = project.sessions ?? [];
      const tempIdx = sessions.findIndex((s) => isTemporarySessionId(s.id));
      if (tempIdx < 0) return project;
      const tempId = sessions[tempIdx]!.id;
      stampPendingSessionRealId(realSessionId, tempId);
      const realExists = sessions.some((s) => s.id === realSessionId);
      if (realExists) {
        return {
          ...project,
          sessions: sessions.filter((s) => !isTemporarySessionId(s.id)),
        };
      }
      const replaced: ProjectSession = {
        ...sessions[tempIdx],
        id: realSessionId,
        executionStatus: sessions[tempIdx]?.executionStatus ?? 'queued',
      };
      return {
        ...project,
        sessions: sessions.map((s, i) => (i === tempIdx ? replaced : s)),
      };
    };
    setProjects((prev) => prev.map(apply));
    setSelectedProject((prev) => (prev ? apply(prev) : prev));
    setSelectedSession((prev) => {
      if (!prev || !isTemporarySessionId(prev.id)) return prev;
      return { ...prev, id: realSessionId };
    });
  }, []);

  // Drop any optimistic placeholders for a given session id. Used when a
  // session goes inactive without ever receiving a real id (errors, aborts
  // before the agent emitted `session_created`).
  const dropOptimisticInProjects = useCallback((sessionId: string) => {
    if (!sessionId || !isTemporarySessionId(sessionId)) return;
    clearPendingSessionIntent(sessionId);
    const apply = (project: Project): Project => {
      const sessions = project.sessions ?? [];
      if (!sessions.some((s) => s.id === sessionId)) return project;
      return {
        ...project,
        sessions: sessions.filter((s) => s.id !== sessionId),
      };
    };
    setProjects((prev) => prev.map(apply));
    setSelectedProject((prev) => (prev ? apply(prev) : prev));
  }, []);

  // PD-SAAS-FORK: optimistic executionStatus patch (pause/resume) without waiting for projects_updated.
  const patchSessionExecutionStatus = useCallback(
    (
      sessionId: string,
      executionStatus: ProjectSession['executionStatus'],
      pausedReason?: string | null,
      queuePosition?: number | null,
    ) => {
      if (!sessionId) return;
      const apply = (project: Project): Project => {
        const sessions = project.sessions ?? [];
        const idx = sessions.findIndex((s) => isSameSessionId(s.id, sessionId));
        if (idx < 0) return project;
        const nextSessions = [...sessions];
        const nextQueuePosition =
          queuePosition !== undefined
            ? queuePosition
            : executionStatus === 'idle' || executionStatus === 'running'
              ? null
              : nextSessions[idx].queuePosition;
        nextSessions[idx] = {
          ...nextSessions[idx],
          executionStatus,
          queuePosition: nextQueuePosition,
          ...(pausedReason !== undefined ? { pausedReason } : {}),
        };
        return { ...project, sessions: nextSessions };
      };
      setProjects((prev) => prev.map(apply));
      setSelectedProject((prev) => (prev ? apply(prev) : prev));
      setSelectedSession((prev) => {
        if (!prev || !isSameSessionId(prev.id, sessionId)) return prev;
        return {
          ...prev,
          executionStatus,
          queuePosition:
            queuePosition !== undefined
              ? queuePosition
              : executionStatus === 'idle' || executionStatus === 'running'
                ? null
                : prev.queuePosition,
          ...(pausedReason !== undefined ? { pausedReason } : {}),
        };
      });
    },
    [],
  );

  const handleResetProjectSessionPreview = useCallback((projectName: string) => {
    setProjects((prevProjects) =>
      prevProjects.map((project) =>
        project.name === projectName ? resetProjectSessionPreview(project) : project,
      ),
    );
    setSelectedProject((prev) =>
      prev?.name === projectName ? resetProjectSessionPreview(prev) : prev,
    );
  }, []);

  const sidebarSharedProps = useMemo(
    () => ({
      projects,
      selectedProject,
      selectedSession,
      onProjectSelect: handleProjectSelect,
      onSessionSelect: handleSessionSelect,
      onNewSession: handleNewSession,
      onSessionDelete: handleSessionDelete,
      onProjectDelete: handleProjectDelete,
      isLoading: isLoadingProjects,
      loadingProgress,
      onRefresh: handleSidebarRefresh,
      onShowSettings: () => setShowSettings(true),
      showSettings,
      settingsInitialTab,
      onCloseSettings: () => setShowSettings(false),
      isMobile,
    }),
    [
      handleNewSession,
      handleProjectDelete,
      handleProjectSelect,
      handleSessionDelete,
      handleSessionSelect,
      handleSidebarRefresh,
      isLoadingProjects,
      isMobile,
      loadingProgress,
      projects,
      settingsInitialTab,
      selectedProject,
      selectedSession,
      showSettings,
    ],
  );

  return {
    projects,
    selectedProject,
    selectedSession,
    activeTab,
    sidebarOpen,
    isLoadingProjects,
    loadingProgress,
    isInputFocused,
    showSettings,
    settingsInitialTab,
    externalMessageUpdate,
    setActiveTab,
    setSelectedSession,
    setSidebarOpen,
    setIsInputFocused,
    setShowSettings,
    openSettings,
    fetchProjects,
    refreshProjectsSilently,
    upsertCreatedProject,
    sidebarSharedProps,
    handleProjectSelect,
    handleSessionSelect,
    selectProjectAndSession,
    handleNewSession,
    handleSessionDelete,
    handleProjectDelete,
    handleDeselectProject,
    handleResetProjectSessionPreview,
    setSelectedProject,
    handleSidebarRefresh,
    loadMoreSessions,
    loadOlderSessions,
    loadingMoreProjectIds,
    bumpSessionActivity,
    replaceOptimisticInProjects,
    dropOptimisticInProjects,
    patchSessionExecutionStatus,
  };
}
