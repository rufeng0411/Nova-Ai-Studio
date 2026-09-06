import { readPendingSessionIntents } from './pendingSessionIntent';
import { isSameSessionId } from './sessionId';

export function isTemporarySessionId(sessionId: string | null | undefined): boolean {
  return Boolean(sessionId && sessionId.startsWith('new-session-'));
}

export type ResolveAbortTargetSessionIdInput = {
  currentSessionId?: string | null;
  selectedSessionId?: string | null;
  pendingViewSessionId?: string | null;
  pendingSessionIdFromStorage?: string | null;
  processingSessionIds?: Iterable<string>;
};

/** Resolve the concrete PilotDeck session id to target for pause/abort WS frames. */
export function resolveAbortTargetSessionId(
  input: ResolveAbortTargetSessionIdInput,
): string | null {
  const candidates: Array<string | null | undefined> = [
    input.currentSessionId,
    input.pendingViewSessionId,
    input.pendingSessionIdFromStorage,
    input.selectedSessionId,
  ];

  for (const intent of readPendingSessionIntents()) {
    candidates.push(intent.realSessionId ?? null);
  }

  if (input.processingSessionIds) {
    for (const sessionId of input.processingSessionIds) {
      candidates.push(sessionId);
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || isTemporarySessionId(candidate)) continue;
    const normalized = candidate.replace(/^web:s_/, 'web-s_');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    return candidate;
  }

  return null;
}

export function processingSessionsHas(
  processingSessions: Set<string> | undefined,
  sessionId: string | null | undefined,
): boolean {
  if (!processingSessions || !sessionId || processingSessions.size === 0) return false;
  if (processingSessions.has(sessionId)) return true;
  for (const id of processingSessions) {
    if (isSameSessionId(id, sessionId)) return true;
  }
  return false;
}
