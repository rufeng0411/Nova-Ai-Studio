/**
 * PD-SAAS-FORK: sidebar project/session ordering — newest activity first.
 */
import type { Project, ProjectSession } from '../types/app';

export function asRecencyTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function sessionLastActivityMs(session: ProjectSession): number {
  return Math.max(
    asRecencyTimestamp(session.lastActivity),
    asRecencyTimestamp(session.updated_at),
    asRecencyTimestamp(session.createdAt),
    asRecencyTimestamp(session.created_at),
  );
}

export function sortSessionsByRecency(sessions: ProjectSession[]): ProjectSession[] {
  return [...sessions].sort((a, b) => {
    const diff = sessionLastActivityMs(b) - sessionLastActivityMs(a);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function projectLastActivityMs(project: Project): number {
  let latest = Math.max(
    asRecencyTimestamp(project.lastActivity),
    asRecencyTimestamp(project.updated_at),
    asRecencyTimestamp(project.createdAt),
    asRecencyTimestamp(project.created_at),
  );
  for (const session of project.sessions ?? []) {
    latest = Math.max(latest, sessionLastActivityMs(session));
  }
  return latest;
}

export function sortProjectsByRecency(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const diff = projectLastActivityMs(b) - projectLastActivityMs(a);
    if (diff !== 0) return diff;
    const nameA = a.displayName || a.name;
    const nameB = b.displayName || b.name;
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
}

export function sortProjectTreeByRecency(projects: Project[]): Project[] {
  return sortProjectsByRecency(
    projects.map((project) => ({
      ...project,
      sessions: sortSessionsByRecency(project.sessions ?? []),
    })),
  );
}
