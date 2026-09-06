/**
 * PD-SAAS-FORK: collect session-scoped folder items for dock / folder modal.
 */

import type { ChatMessage } from '../components/chat/types/types';
import type { DeliverableItem } from './collectDeliverables';
import { collectDeliverablesFromMessages, sortDeliverables } from './collectDeliverables';
import { getArtifactDirectory } from './artifactPaths';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import { extractUserGoalFromSessionMessages } from './deliverableDisplayPolicy';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';
import { resolveTaskFolderLocation } from './pickPrimaryDeliverable';
import { resolveContractScopeDir } from './resolveContractScopeDir';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';

export type CollectSessionFolderItemsInput = {
  messages: ChatMessage[];
  projectRoot: string;
  turnDeliverables?: DeliverableItem[];
  turnArtifactDir?: string | null;
};

function dedupeByPath(items: DeliverableItem[]): DeliverableItem[] {
  const seen = new Set<string>();
  const out: DeliverableItem[] = [];
  for (const item of items) {
    const key = (item.resolvedPath || item.apiPath || item.path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function itemsInFolder(items: DeliverableItem[], folderPath: string): DeliverableItem[] {
  const norm = folderPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return items.filter((item) => {
    const dir = getArtifactDirectory(item.resolvedPath || item.apiPath || item.path).toLowerCase();
    return dir === norm || dir.startsWith(`${norm}/`);
  });
}

/** Folder items for the active session deliverable directory. */
export function collectSessionFolderItems(input: CollectSessionFolderItemsInput): DeliverableItem[] {
  const sessionGoal = extractUserGoalFromSessionMessages(input.messages);
  const sessionItems = collectDeliverablesFromMessages(input.messages, input.projectRoot);
  const turnItems = input.turnDeliverables ?? [];
  const sessionTaskDirectory = resolveCurrentSessionTaskDirectory(input.messages);

  let folderPath = resolveContractScopeDir({
    messages: input.messages,
    sessionTaskDirectory,
    turnArtifactDir: input.turnArtifactDir,
  })
    ?? input.turnArtifactDir
    ?? inferTurnArtifactDirectory(turnItems.length > 0 ? turnItems : sessionItems)
    ?? null;

  if (!folderPath && sessionItems.length > 0) {
    const location = resolveTaskFolderLocation(sessionItems);
    folderPath = location?.folderPath ?? null;
  }

  if (!folderPath) {
    return sortDeliverables(dedupeByPath([...turnItems, ...sessionItems]));
  }

  const scoped = itemsInFolder([...turnItems, ...sessionItems], folderPath);
  if (scoped.length > 0) {
    return sortDeliverables(dedupeByPath(scoped));
  }

  // Fallback: latest turn deliverables when session scan is empty (tail-read window).
  for (let i = input.messages.length - 1; i >= 0; i -= 1) {
    const message = input.messages[i];
    if (message.type !== 'assistant') continue;
    const turnId = message.turnId ?? message.id;
    const turnMessages: ChatMessage[] = [];
    for (let j = i; j >= 0; j -= 1) {
      turnMessages.unshift(input.messages[j]);
      if (input.messages[j].id === turnId || input.messages[j].turnId === turnId) break;
    }
    const latestTurnItems = collectTurnFinalDeliverables({
      assistantText: String(message.content ?? ''),
      toolMessages: turnMessages,
      // PD-SAAS-FORK: folder enrichment cannot add rows beyond frozen SDM.
      sessionToolMessages: input.messages,
      projectRoot: input.projectRoot,
      userGoalText: sessionGoal,
      turnArtifactDirOverride: folderPath ?? undefined,
    });
    const inFolder = itemsInFolder(latestTurnItems, folderPath);
    if (inFolder.length > 0) {
      return sortDeliverables(dedupeByPath(inFolder));
    }
    break;
  }

  return sortDeliverables(dedupeByPath(sessionItems));
}

export function resolveSessionFolderPath(input: CollectSessionFolderItemsInput): string | null {
  const turnItems = input.turnDeliverables ?? [];
  const sessionItems = collectDeliverablesFromMessages(input.messages, input.projectRoot);
  return input.turnArtifactDir
    ?? inferTurnArtifactDirectory(turnItems.length > 0 ? turnItems : sessionItems)
    ?? resolveTaskFolderLocation(sessionItems)?.folderPath
    ?? null;
}
