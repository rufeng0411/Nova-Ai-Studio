/**
 * PD-SAAS-FORK (STDA): resolve session task directory from chat messages / API envelope.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { SessionTaskDirectoryUi } from './resolveContractScopeDir';

function isValidTaskDirectory(value: unknown): value is SessionTaskDirectoryUi {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.taskArtifactDir === 'string'
    && typeof record.taskDirKey === 'string'
    && typeof record.goalVersion === 'number';
}

function readFromPayload(payload: unknown): SessionTaskDirectoryUi | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const raw = (payload as Record<string, unknown>).sessionTaskDirectory;
  return isValidTaskDirectory(raw) ? raw : undefined;
}

export function resolveCurrentSessionTaskDirectory(
  messages: ChatMessage[],
): SessionTaskDirectoryUi | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    const fromPayload = readFromPayload(message.payload);
    if (fromPayload) return fromPayload;
    const flat = (message as Record<string, unknown>).sessionTaskDirectory;
    if (isValidTaskDirectory(flat)) return flat;
    if (message.metadata && typeof message.metadata === 'object') {
      const fromMeta = (message.metadata as Record<string, unknown>).sessionTaskDirectory;
      if (isValidTaskDirectory(fromMeta)) return fromMeta;
    }
  }
  return undefined;
}

export function resolveSessionTaskDirectoryFromEnvelope(
  envelope: unknown,
): SessionTaskDirectoryUi | undefined {
  if (!envelope || typeof envelope !== 'object') return undefined;
  const raw = (envelope as Record<string, unknown>).sessionTaskDirectory;
  return isValidTaskDirectory(raw) ? raw : undefined;
}
