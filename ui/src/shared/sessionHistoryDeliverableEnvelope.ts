/**
 * PD-SAAS-FORK: co-source history response envelopes without creating UI messages.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import type { SessionTaskDirectoryUi } from './resolveContractScopeDir';
import { sanitizeTurnAcceptanceMetaRecord } from './turnAcceptanceMeta';

export type SessionHistoryDeliverableEnvelope = {
  latestTurnAcceptanceMeta?: Record<string, unknown> | null;
  sessionDeliverableManifest?: SessionDeliverableManifestUi | null;
  sessionTaskDirectory?: SessionTaskDirectoryUi | null;
};

export type SessionHistoryDeliverableContext = {
  messages: ChatMessage[];
  detachedEnvelope?: SessionHistoryDeliverableEnvelope;
};

function hasEnvelopeData(envelope: SessionHistoryDeliverableEnvelope): boolean {
  return Boolean(
    envelope.latestTurnAcceptanceMeta
    || envelope.sessionDeliverableManifest
    || envelope.sessionTaskDirectory,
  );
}

export function resolveSessionHistoryDeliverableContext(
  messages: ChatMessage[],
  envelope: SessionHistoryDeliverableEnvelope,
): SessionHistoryDeliverableContext {
  const sanitizedAcceptanceMeta = sanitizeTurnAcceptanceMetaRecord(
    envelope.latestTurnAcceptanceMeta ?? undefined,
  );
  const sanitizedEnvelope: SessionHistoryDeliverableEnvelope = {
    ...(sanitizedAcceptanceMeta
      ? { latestTurnAcceptanceMeta: sanitizedAcceptanceMeta as Record<string, unknown> }
      : {}),
    ...(envelope.sessionDeliverableManifest
      ? { sessionDeliverableManifest: envelope.sessionDeliverableManifest }
      : {}),
    ...(envelope.sessionTaskDirectory
      ? { sessionTaskDirectory: envelope.sessionTaskDirectory }
      : {}),
  };
  if (!hasEnvelopeData(sanitizedEnvelope)) {
    return { messages };
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type !== 'assistant' || message.isThinking || message.isStreaming) continue;
    const existingAcceptance = message.turnAcceptanceMeta
      && typeof message.turnAcceptanceMeta === 'object'
      ? message.turnAcceptanceMeta as Record<string, unknown>
      : {};
    const nextMessages = messages.slice();
    nextMessages[index] = {
      ...message,
      ...(sanitizedEnvelope.latestTurnAcceptanceMeta
        ? {
            turnAcceptanceMeta: {
              ...sanitizedEnvelope.latestTurnAcceptanceMeta,
              ...existingAcceptance,
            },
          }
        : {}),
      ...(message.sessionDeliverableManifest
        ? {}
        : sanitizedEnvelope.sessionDeliverableManifest
          ? { sessionDeliverableManifest: sanitizedEnvelope.sessionDeliverableManifest }
          : {}),
      ...(message.sessionTaskDirectory
        ? {}
        : sanitizedEnvelope.sessionTaskDirectory
          ? { sessionTaskDirectory: sanitizedEnvelope.sessionTaskDirectory }
          : {}),
    };
    return { messages: nextMessages };
  }

  return {
    messages,
    detachedEnvelope: sanitizedEnvelope,
  };
}

export function coSourceSessionHistoryDeliverableEnvelope(
  messages: ChatMessage[],
  envelope: SessionHistoryDeliverableEnvelope,
): ChatMessage[] {
  return resolveSessionHistoryDeliverableContext(messages, envelope).messages;
}
