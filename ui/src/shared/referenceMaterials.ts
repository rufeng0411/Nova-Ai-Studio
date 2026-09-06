// PD-SAAS-FORK: unified reference materials (uploaded files + @ file references)
import type { ChatAttachment } from '../components/chat/types/types';
import {
  inferAttachmentMimeType,
  parseReferenceIntentNote,
  parseUserAttachmentNote,
} from '../components/chat/utils/attachmentNotes';
import { normalizeReferencePath } from './fileReferenceComposer';

export function pathsToReferenceAttachments(paths: string[]): ChatAttachment[] {
  return paths.map((filePath) => {
    const normalized = normalizeReferencePath(filePath);
    const name = normalized.split('/').pop() || normalized;
    return {
      name,
      path: normalized,
      mimeType: inferAttachmentMimeType(name, normalized),
    };
  });
}

export function dedupeReferenceAttachments(attachments: ChatAttachment[]): ChatAttachment[] {
  const seen = new Set<string>();
  const ordered: ChatAttachment[] = [];
  for (const attachment of attachments) {
    const path = String(attachment.path || attachment.name || '').replace(/\\/g, '/').trim();
    if (!path) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push({
      ...attachment,
      path,
      name: attachment.name || path.split('/').pop() || path,
    });
  }
  return ordered;
}

/** Strip hidden attachment/reference notes and collect all reference materials. */
export function parseUserMessageReferences(content: unknown): {
  content: string;
  attachments: ChatAttachment[];
} {
  let text = typeof content === 'string' ? content : '';
  const collected: ChatAttachment[] = [];

  const attachmentParsed = parseUserAttachmentNote(text);
  text = attachmentParsed.content;
  collected.push(...attachmentParsed.attachments);

  const referenceParsed = parseReferenceIntentNote(text);
  text = referenceParsed.content;
  collected.push(...referenceParsed.attachments);

  return {
    content: text,
    attachments: dedupeReferenceAttachments(collected),
  };
}

export function resolveUserMessageAttachments(message: {
  content?: unknown;
  attachments?: ChatAttachment[];
}): ChatAttachment[] {
  const stored = Array.isArray(message.attachments)
    ? message.attachments.filter((attachment) => attachment && typeof attachment.name === 'string')
    : [];
  const parsed = parseUserMessageReferences(message.content).attachments;
  return dedupeReferenceAttachments([...stored, ...parsed]);
}

export function getAttachmentTypeLabel(name?: string, mimeType?: string): string {
  const ext = String(name || '').split('.').pop()?.toUpperCase();
  if (ext && ext !== String(name || '').toUpperCase()) return ext;
  if (mimeType?.includes('/')) return mimeType.split('/').pop()?.toUpperCase() || 'FILE';
  return 'FILE';
}

export function getAttachmentAccent(name?: string, mimeType?: string): string {
  const label = getAttachmentTypeLabel(name, mimeType).toLowerCase();
  if (label === 'pdf') return 'bg-red-500 text-primary-foreground';
  if (label === 'doc' || label === 'docx') return 'bg-primary text-primary-foreground';
  if (label === 'xls' || label === 'xlsx' || label === 'csv') return 'bg-success text-primary-foreground';
  if (label === 'ppt' || label === 'pptx') return 'bg-orange-500 text-primary-foreground';
  return 'bg-neutral-500 text-primary-foreground';
}
