/**
 * PD-SAAS-FORK: client-side sidebar default time window (mirrors server).
 */
import type { ProjectSession } from '../types/app';
import { sessionLastActivityMs, sortSessionsByRecency } from './sidebarRecencySort';

export const SIDEBAR_DEFAULT_DAYS = Number(import.meta.env.VITE_SAAS_SIDEBAR_DEFAULT_DAYS || 7);

export function resolveSidebarDefaultSinceMs(includeOlder = false): number | undefined {
  if (includeOlder) return undefined;
  if (!Number.isFinite(SIDEBAR_DEFAULT_DAYS) || SIDEBAR_DEFAULT_DAYS <= 0) return undefined;
  return Date.now() - SIDEBAR_DEFAULT_DAYS * 86_400_000;
}

export function isSessionWithinSidebarWindow(
  session: ProjectSession,
  includeOlderLoaded = false,
): boolean {
  if (includeOlderLoaded) return true;
  const sinceMs = resolveSidebarDefaultSinceMs(false);
  if (sinceMs == null) return true;
  const ts = sessionLastActivityMs(session);
  if (!ts) return true;
  return ts >= sinceMs;
}

export function filterSessionsForSidebarWindow(
  sessions: ProjectSession[],
  includeOlderLoaded = false,
): ProjectSession[] {
  const sorted = sortSessionsByRecency(sessions).filter((session) => session.sessionKind !== 'n2_bot');
  if (includeOlderLoaded) return sorted;
  return sorted.filter((session) => isSessionWithinSidebarWindow(session, false));
}
