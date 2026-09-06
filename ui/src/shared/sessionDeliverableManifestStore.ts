/**
 * PD-SAAS-FORK: incremental session SDM cache keyed by session id.
 */
import type { ChatMessage } from '../components/chat/types/types';
import {
  resolveCurrentSessionManifest,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';

const cache = new Map<string, { fingerprint: string; manifest?: SessionDeliverableManifestUi }>();

function fingerprint(messages: ChatMessage[]): string {
  const tail = messages.slice(-3);
  return tail.map((m) => `${m.id}:${m.timestamp ?? ''}`).join('|');
}

export function getCachedSessionManifest(
  sessionId: string | undefined,
  messages: ChatMessage[],
): SessionDeliverableManifestUi | undefined {
  if (!sessionId) return resolveCurrentSessionManifest(messages);
  const fp = fingerprint(messages);
  const hit = cache.get(sessionId);
  if (hit?.fingerprint === fp) return hit.manifest;
  const manifest = resolveCurrentSessionManifest(messages);
  cache.set(sessionId, { fingerprint: fp, manifest });
  return manifest;
}

export function invalidateSessionManifestCache(sessionId?: string): void {
  if (sessionId) cache.delete(sessionId);
  else cache.clear();
}
