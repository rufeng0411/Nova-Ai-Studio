// PD-SAAS-FORK: sidebar multi-select keys + batch action filters.
import type { Project, ProjectSession } from '../types/app';
import { isSessionSidebarCompleted, isSessionSidebarLocked } from '../lib/sessionSidebarState';
import { normalizeSessionId } from './sessionId';
import {
  shouldShowContextPauseSession,
  shouldShowContextResumeSession,
} from './sidebarSessionExecutionStatus';

export type SidebarSessionRef = {
  project: Project;
  session: ProjectSession;
  sessionId: string;
};

export function buildSidebarMultiSelectKey(projectName: string, sessionId: string): string {
  return `${projectName}::${normalizeSessionId(sessionId)}`;
}

export function isOptimisticSidebarSessionId(sessionId: string | undefined): boolean {
  return typeof sessionId === 'string' && sessionId.startsWith('new-session-');
}

export function collectSidebarSessionRefs(
  projects: Project[],
  selectedKeys: ReadonlySet<string>,
  collectSessions: (project: Project) => Array<{ session: ProjectSession; sessionId: string }>,
): SidebarSessionRef[] {
  const refs: SidebarSessionRef[] = [];
  for (const project of projects) {
    if (!project?.name) continue;
    for (const row of collectSessions(project)) {
      if (isOptimisticSidebarSessionId(row.sessionId)) continue;
      const key = buildSidebarMultiSelectKey(project.name, row.sessionId);
      if (!selectedKeys.has(key)) continue;
      refs.push({
        project,
        session: row.session,
        sessionId: row.sessionId,
      });
    }
  }
  return refs;
}

export function partitionBatchDeletableSessions(refs: SidebarSessionRef[]): {
  deletable: SidebarSessionRef[];
  lockedCount: number;
} {
  const deletable: SidebarSessionRef[] = [];
  let lockedCount = 0;
  for (const ref of refs) {
    if (isSessionSidebarLocked(ref.sessionId)) {
      lockedCount += 1;
      continue;
    }
    deletable.push(ref);
  }
  return { deletable, lockedCount };
}

export function filterBatchPauseSessions(
  refs: SidebarSessionRef[],
  processingSessions?: Set<string>,
): SidebarSessionRef[] {
  return refs.filter((ref) => shouldShowContextPauseSession(ref.session, processingSessions));
}

export function filterBatchResumeSessions(refs: SidebarSessionRef[]): SidebarSessionRef[] {
  return refs.filter((ref) => shouldShowContextResumeSession(ref.session));
}

export function filterBatchCompleteSessions(refs: SidebarSessionRef[]): SidebarSessionRef[] {
  return refs.filter((ref) => !isSessionSidebarCompleted(ref.sessionId) && !isSessionSidebarLocked(ref.sessionId));
}

export function filterBatchUncompleteSessions(refs: SidebarSessionRef[]): SidebarSessionRef[] {
  return refs.filter((ref) => isSessionSidebarCompleted(ref.sessionId));
}

export function filterBatchLockSessions(refs: SidebarSessionRef[]): SidebarSessionRef[] {
  return refs.filter((ref) => !isSessionSidebarLocked(ref.sessionId));
}

export function filterBatchUnlockSessions(refs: SidebarSessionRef[]): SidebarSessionRef[] {
  return refs.filter((ref) => isSessionSidebarLocked(ref.sessionId));
}
