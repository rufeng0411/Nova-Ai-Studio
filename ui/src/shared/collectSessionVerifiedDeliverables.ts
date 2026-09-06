// PD-SAAS-FORK: aggregate verified deliverable paths across a whole chat session
import type { ChatMessage } from '../components/chat/types/types';
import {
  type DeliverableItem,
} from './collectDeliverables';
import {
  classifyDeliverablePath,
  getArtifactDirectory,
  normalizeArtifactPath,
  resolveDeliverableApiPath,
} from './artifactPaths';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';

function pathsFromMessage(message: ChatMessage): string[] {
  const raw = Array.isArray(message.verifiedDeliverablePaths)
    ? message.verifiedDeliverablePaths
    : [];
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((path) => normalizeArtifactPath(path))
    .filter(Boolean);
}

function deliverableFromVerifiedPath(
  path: string,
  turnArtifactDir?: string,
  projectRoot = '',
): DeliverableItem | null {
  const normalized = normalizeArtifactPath(path);
  if (!normalized || isNonUserDeliverablePath(normalized)) return null;
  const kind = classifyDeliverablePath(normalized);
  const apiPath = resolveDeliverableApiPath({ writtenFilePath: normalized }, undefined, projectRoot) || normalized;
  return {
    id: `${kind}:${normalized.toLowerCase()}`,
    path: normalized,
    apiPath,
    kind,
    source: 'text',
    turnArtifactDir: turnArtifactDir ?? getArtifactDirectory(normalized) ?? undefined,
  };
}

export function collectSessionVerifiedDeliverables(
  sessionMessages: ChatMessage[],
  projectRoot = '',
): DeliverableItem[] {
  const seen = new Set<string>();
  const items: DeliverableItem[] = [];

  for (const message of sessionMessages) {
    if (message.type !== 'assistant') continue;
    const turnDir = typeof message.turnArtifactDir === 'string' ? message.turnArtifactDir : undefined;
    for (const path of pathsFromMessage(message)) {
      if (seen.has(path)) continue;
      seen.add(path);
      const item = deliverableFromVerifiedPath(path, turnDir, projectRoot);
      if (item) items.push(item);
    }
  }

  return items;
}
