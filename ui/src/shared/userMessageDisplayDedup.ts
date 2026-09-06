// PD-SAAS-FORK: dedupe optimistic vs persisted user bubbles + hide infra task-resume rows.
import type { ChatMessage } from '../components/chat/types/types';
import { parseUserMessageReferences } from './referenceMaterials';
import { containsTaskResumeMarkup } from './stripLeakedToolMarkup';

export function normalizeUserMessageTextForDedup(value: unknown): string {
  const parsed = parseUserMessageReferences(value);
  return parsed.content.replace(/\s+/g, ' ').trim();
}

function getUserAttachmentNames(message: ChatMessage): string[] {
  const explicitNames = Array.isArray(message.attachments)
    ? message.attachments.map((attachment) => attachment.name || '').filter(Boolean)
    : [];
  const parsedNames = parseUserMessageReferences(message.content).attachments
    .map((attachment) => attachment.name || '')
    .filter(Boolean);
  return [...new Set([...explicitNames, ...parsedNames])].sort();
}

/** Never render infra task-resume injections as user bubbles (history API already hides them). */
export function shouldHideUserFacingUserMessage(content: unknown): boolean {
  const text = typeof content === 'string' ? content : String(content ?? '');
  if (!text.trim()) return true;
  return containsTaskResumeMarkup(text);
}

export function dedupeConsecutiveUserMessages(messages: ChatMessage[]): ChatMessage[] {
  const deduped: ChatMessage[] = [];
  for (const message of messages) {
    const previous = deduped[deduped.length - 1];
    if (
      message.type === 'user'
      && previous?.type === 'user'
      && normalizeUserMessageTextForDedup(message.content)
        === normalizeUserMessageTextForDedup(previous.content)
      && getUserAttachmentNames(message).join('\n') === getUserAttachmentNames(previous).join('\n')
    ) {
      continue;
    }
    deduped.push(message);
  }
  return deduped;
}

export function hasEquivalentUserMessage(
  messages: ChatMessage[],
  pendingUserMessage: ChatMessage,
): boolean {
  const pendingText = normalizeUserMessageTextForDedup(pendingUserMessage.content);
  const pendingImageCount = Array.isArray(pendingUserMessage.images)
    ? pendingUserMessage.images.length
    : 0;
  const pendingAttachmentNames = getUserAttachmentNames(pendingUserMessage);

  return messages.some((message) => {
    if (message.type !== 'user') return false;
    if (shouldHideUserFacingUserMessage(message.content)) return false;
    if (normalizeUserMessageTextForDedup(message.content) !== pendingText) return false;

    const imageCount = Array.isArray(message.images) ? message.images.length : 0;
    if (imageCount !== pendingImageCount) return false;

    const attachmentNames = getUserAttachmentNames(message);
    return attachmentNames.join('\n') === pendingAttachmentNames.join('\n');
  });
}

export function hasEquivalentVisibleUserMessage(
  messages: ChatMessage[],
  anchor: ChatMessage,
): boolean {
  if (anchor.type !== 'user') return false;
  if (shouldHideUserFacingUserMessage(anchor.content)) return false;
  const anchorText = normalizeUserMessageTextForDedup(anchor.content);
  const anchorAttachments = getUserAttachmentNames(anchor).join('\n');
  return messages.some((message) => {
    if (message.type !== 'user') return false;
    if (shouldHideUserFacingUserMessage(message.content)) return false;
    return normalizeUserMessageTextForDedup(message.content) === anchorText
      && getUserAttachmentNames(message).join('\n') === anchorAttachments;
  });
}
