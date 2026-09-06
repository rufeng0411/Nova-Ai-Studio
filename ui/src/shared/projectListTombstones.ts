// PD-SAAS-FORK: tombstone deleted sidebar rows until the server list catches up.
// Prevents preserveLoadedSessions / projects_updated from resurrecting deleted sessions.
import type { Project, ProjectSession } from '../types/app';
import { sortSessionsByRecency } from './sidebarRecencySort';

export function normalizeTombstoneSessionId(id: string): string {
  return id.replace(/^web:s_/, 'web-s_');
}

const tombstonedSessionIds = new Set<string>();
const tombstonedProjectNames = new Set<string>();

export function tombstoneDeletedSession(sessionId: string): void {
  if (!sessionId) return;
  tombstonedSessionIds.add(normalizeTombstoneSessionId(sessionId));
}

export function tombstoneDeletedProject(projectName: string): void {
  if (!projectName) return;
  tombstonedProjectNames.add(projectName);
}

export function isSessionTombstoned(sessionId: string): boolean {
  return tombstonedSessionIds.has(normalizeTombstoneSessionId(sessionId));
}

export function isProjectTombstoned(projectName: string): boolean {
  return tombstonedProjectNames.has(projectName);
}

export function filterTombstonedSessions<T extends { id: string }>(sessions: T[]): T[] {
  return sessions.filter((session) => !isSessionTombstoned(session.id));
}

export function filterTombstonedProjects(projects: Project[]): Project[] {
  return projects
    .filter((project) => !isProjectTombstoned(project.name))
    .map((project) => ({
      ...project,
      sessions: filterTombstonedSessions(project.sessions ?? []),
    }));
}

/** Test-only reset. */
export function resetProjectListTombstonesForTests(): void {
  tombstonedSessionIds.clear();
  tombstonedProjectNames.clear();
}

export function applySessionTombstonesToProject(project: Project): Project {
  const sessions = filterTombstonedSessions(project.sessions ?? []);
  const removedCount = (project.sessions?.length ?? 0) - sessions.length;
  if (removedCount <= 0) return project;
  const prevTotal = project.sessionMeta?.total;
  return {
    ...project,
    sessions,
    sessionMeta: {
      ...project.sessionMeta,
      total:
        typeof prevTotal === 'number'
          ? Math.max(0, prevTotal - removedCount)
          : project.sessionMeta?.total,
    },
  };
}

export function applySessionTombstones(projects: Project[]): Project[] {
  return filterTombstonedProjects(projects).map(applySessionTombstonesToProject);
}

export function mergeSessionListsRespectingTombstones(
  existing: ProjectSession[],
  incoming: ProjectSession[],
): ProjectSession[] {
  const seen = new Set(existing.map((session) => normalizeTombstoneSessionId(session.id)));
  const merged = [...existing];
  for (const session of incoming) {
    if (!session?.id || isSessionTombstoned(session.id)) continue;
    const normalized = normalizeTombstoneSessionId(session.id);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(session);
  }
  return sortSessionsByRecency(merged);
}
