// PD-SAAS-FORK: pick main deliverable paths from an existing conversation for @ references
import type { ChatMessage } from '../components/chat/types/types';
import {
  collectDeliverablesFromAssistantText,
  collectDeliverablesFromMessages,
  sortDeliverables,
  type DeliverableItem,
} from './collectDeliverables';
import { pickPrimaryDeliverableFile } from './pickPrimaryDeliverable';

const DEFAULT_LIMIT = 3;

function referencePathKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').trim().toLowerCase();
  if (/\/artifacts\/slides-[^/]+\//.test(normalized)) {
    return normalized;
  }
  return basename(path).toLowerCase();
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/').trim();
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function isBareFilename(path: string): boolean {
  return !path.replace(/\\/g, '/').includes('/');
}

function scoreReferencePath(item: DeliverableItem): number {
  let score = 0;
  const path = (item.apiPath || item.path).replace(/\\/g, '/');
  if (item.source === 'tool') score += 100;
  if (path.includes('artifacts/') && !path.includes('artifacts/geo/')) score += 25;
  if (path.endsWith('.md')) score += 20;
  if (path.endsWith('.html')) score += 15;
  if (path.endsWith('.pdf')) score += 12;
  if (path.endsWith('.docx')) score += 10;
  if (path.endsWith('.pptx')) score += 5;
  if (!isBareFilename(path)) score += 8;
  return score;
}

function sanitizeReferencePath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').trim();
  if (!normalized || /\s/.test(normalized)) return null;
  if (/\/artifacts\/geo\/geo\//.test(normalized)) return null;
  if (isBareFilename(normalized)) return null;
  return normalized;
}

function pickBestReferencePaths(items: DeliverableItem[], limit: number): string[] {
  const files = items.filter((item) => item.kind !== 'url');
  const byBasename = new Map<string, DeliverableItem>();

  for (const item of files) {
    const path = sanitizeReferencePath(item.apiPath || item.path);
    if (!path) continue;
    const key = referencePathKey(path);
    const scored = { ...item, apiPath: path, path };
    const current = byBasename.get(key);
    if (!current || scoreReferencePath(scored) > scoreReferencePath(current)) {
      byBasename.set(key, scored);
    }
  }

  const ranked = Array.from(byBasename.values())
    .sort((a, b) => scoreReferencePath(b) - scoreReferencePath(a))
    .map((item) => sanitizeReferencePath(item.apiPath || item.path))
    .filter((path): path is string => Boolean(path));

  const withoutGeoMirror = ranked.filter((path) => {
    if (!/\/artifacts\/geo\//.test(path)) return true;
    const suffix = path.replace(/^.*\/artifacts\/geo\//, '');
    return !ranked.some((candidate) => candidate.includes('/artifacts/') && !candidate.includes('/artifacts/geo/') && candidate.endsWith(suffix));
  });

  return withoutGeoMirror.slice(0, limit);
}

/** Parse deliverables token-by-token so space-joined path lists are not merged into one bogus path. */
function collectReferenceDeliverablesFromAssistantText(
  text: string,
  projectRoot?: string,
): DeliverableItem[] {
  const tokens = text.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return [];
  return tokens.reduce<DeliverableItem[]>(
    (acc, token) => mergeItems(acc, collectDeliverablesFromAssistantText(token, projectRoot)),
    [],
  );
}

function mergeItems(existing: DeliverableItem[], incoming: DeliverableItem[]): DeliverableItem[] {
  const map = new Map<string, DeliverableItem>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    const current = map.get(item.id);
    if (!current || (current.source !== 'tool' && item.source === 'tool')) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function isAssistantMessage(message: ChatMessage): boolean {
  return message.type === 'assistant' || message.role === 'assistant';
}

function messageText(message: ChatMessage): string {
  return typeof message.content === 'string' ? message.content : '';
}

/** Collect project-relative paths for main deliverables in a conversation (for @ mentions). */
export function collectConversationMainDeliverablePaths(
  messages: ChatMessage[],
  projectRoot?: string,
  limit = DEFAULT_LIMIT,
): string[] {
  if (messages.length === 0) return [];

  let items = collectDeliverablesFromMessages(messages, projectRoot);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!isAssistantMessage(message)) continue;
    const text = messageText(message);
    if (!text.trim()) continue;
    items = mergeItems(items, collectReferenceDeliverablesFromAssistantText(text, projectRoot));
  }

  const files = sortDeliverables(items.filter((item) => item.kind !== 'url'));
  if (files.length === 0) return [];

  const primary = pickPrimaryDeliverableFile(files);
  const prioritized = primary ? [primary, ...files.filter((item) => item.id !== primary.id)] : files;
  return pickBestReferencePaths(prioritized, limit);
}
