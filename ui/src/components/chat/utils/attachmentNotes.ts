// PD-SAAS-FORK: attachment notes + @ reference intent markers for composer
import type { ChatAttachment } from '../types/types';

const ATTACHMENT_NOTE_MARKER = '[Files attached by user and available for reading in the project:]';
const REFERENCE_INTENT_MARKER_ZH =
  '[用户已通过 @ 引用以下项目文件，请先 read_file 阅读再执行任务：]';
const REFERENCE_INTENT_MARKER_EN =
  '[User referenced these project files via @ — read them before executing:]';

export function inferAttachmentMimeType(name: string, filePath: string): string | undefined {
  const source = `${name || filePath}`.toLowerCase();
  if (source.endsWith('.pdf')) return 'application/pdf';
  if (source.endsWith('.doc')) return 'application/msword';
  if (source.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (source.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (source.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (source.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (source.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (source.endsWith('.txt')) return 'text/plain';
  if (source.endsWith('.md') || source.endsWith('.markdown')) return 'text/markdown';
  if (source.endsWith('.json')) return 'application/json';
  if (source.endsWith('.csv')) return 'text/csv';
  if (source.endsWith('.xml')) return 'application/xml';
  if (source.endsWith('.png')) return 'image/png';
  if (source.endsWith('.jpg') || source.endsWith('.jpeg')) return 'image/jpeg';
  if (source.endsWith('.gif')) return 'image/gif';
  if (source.endsWith('.webp')) return 'image/webp';
  return undefined;
}

export function parseUserAttachmentNote(content: unknown): {
  content: string;
  attachments: ChatAttachment[];
} {
  const text = typeof content === 'string' ? content : '';
  const markerIndex = text.indexOf(ATTACHMENT_NOTE_MARKER);
  if (markerIndex < 0) {
    return { content: text, attachments: [] };
  }

  const visibleContent = text.slice(0, markerIndex).trimEnd();
  const note = text.slice(markerIndex + ATTACHMENT_NOTE_MARKER.length);
  const attachments: ChatAttachment[] = [];

  for (const rawLine of note.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('- ')) continue;
    const separator = line.indexOf(': ');
    if (separator < 0) continue;

    const name = line.slice(2, separator).trim();
    const filePath = line.slice(separator + 2).trim();
    if (!name || !filePath) continue;

    attachments.push({
      name,
      path: filePath,
      mimeType: inferAttachmentMimeType(name, filePath),
    });
  }

  return { content: visibleContent, attachments };
}

export function parseReferenceIntentNote(content: unknown): {
  content: string;
  attachments: ChatAttachment[];
} {
  const text = typeof content === 'string' ? content : '';
  const markerIndexZh = text.indexOf(REFERENCE_INTENT_MARKER_ZH);
  const markerIndexEn = text.indexOf(REFERENCE_INTENT_MARKER_EN);
  const markerIndex =
    markerIndexZh >= 0 && markerIndexEn >= 0
      ? Math.min(markerIndexZh, markerIndexEn)
      : Math.max(markerIndexZh, markerIndexEn);
  if (markerIndex < 0) {
    return { content: text, attachments: [] };
  }

  const markerLength =
    markerIndex === markerIndexZh
      ? REFERENCE_INTENT_MARKER_ZH.length
      : REFERENCE_INTENT_MARKER_EN.length;
  const visibleContent = text.slice(0, markerIndex).trimEnd();
  const note = text.slice(markerIndex + markerLength);
  const attachments: ChatAttachment[] = [];

  for (const rawLine of note.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('- ')) continue;
    const filePath = line.slice(2).trim();
    if (!filePath) continue;
    const normalized = filePath.replace(/\\/g, '/');
    const name = normalized.split('/').pop() || normalized;
    attachments.push({
      name,
      path: normalized,
      mimeType: inferAttachmentMimeType(name, normalized),
    });
  }

  return { content: visibleContent, attachments };
}
