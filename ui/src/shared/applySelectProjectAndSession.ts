/**
 * PD-SAAS-FORK: atomic cross-project session selection — no welcome flash.
 */
import type { AppTab, Project, ProjectSession } from '../types/app';
import { isSameSessionId } from './sessionId';
import { sortSessionsByRecency } from './sidebarRecencySort';
import { SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT } from './sidebarSessionPreviewLimit';

export type SelectProjectAndSessionInput = {
  project: Project;
  session: ProjectSession;
  previousProjectName?: string | null;
};

export type SelectProjectAndSessionResult = {
  selectedProject: Project;
  selectedSession: ProjectSession;
  projects: Project[];
  navigateTo: string;
  shouldSwitchChatTab: boolean;
};

const isTemporarySessionId = (id: unknown): boolean =>
  typeof id === 'string' && id.startsWith('new-session-');

export function resetProjectSessionPreviewForSwitch(
  project: Project,
  pinSessionId?: string | null,
): Project {
  const sessions = project.sessions ?? [];
  if (sessions.length <= SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT) {
    return project;
  }

  const total =
    typeof project.sessionMeta?.total === 'number'
      ? project.sessionMeta.total
      : sessions.length;

  const sorted = sortSessionsByRecency(sessions);
  const pinnedIds = new Set<string>();
  const pinned: ProjectSession[] = [];
  const addPin = (session: ProjectSession) => {
    if (pinnedIds.has(session.id)) return;
    pinnedIds.add(session.id);
    pinned.push(session);
  };

  for (const session of sorted) {
    if (isTemporarySessionId(session.id)) addPin(session);
  }
  if (pinSessionId) {
    const selected = sorted.find((s) => isSameSessionId(s.id, pinSessionId));
    if (selected) addPin(selected);
  }

  const rest = sorted.filter((s) => !pinnedIds.has(s.id));
  const preview = [
    ...pinned,
    ...rest.slice(0, Math.max(0, SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT - pinned.length)),
  ];

  return {
    ...project,
    sessions: preview,
    sessionMeta: {
      ...(project.sessionMeta ?? {}),
      total,
      hasMore: total > SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT && sessions.length > 0,
    },
  };
}

export function applySelectProjectAndSession(
  input: SelectProjectAndSessionInput,
  ctx: { projects: Project[]; activeTab: AppTab },
): SelectProjectAndSessionResult {
  const pinSessionId = input.session.id;
  const previewProject = resetProjectSessionPreviewForSwitch(input.project, pinSessionId);
  const sessionWithProject = {
    ...input.session,
    __projectName: input.session.__projectName ?? input.project.name,
  };

  const shouldSwitchChatTab = ctx.activeTab === 'tasks' || ctx.activeTab === 'preview';

  return {
    selectedProject: previewProject,
    selectedSession: sessionWithProject,
    projects: ctx.projects.map((project) => (
      project.name === input.project.name
        ? resetProjectSessionPreviewForSwitch(project, pinSessionId)
        : resetProjectSessionPreviewForSwitch(project)
    )),
    navigateTo: `/session/${input.session.id}`,
    shouldSwitchChatTab,
  };
}
