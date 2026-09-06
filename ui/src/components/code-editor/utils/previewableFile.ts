/** File types that support a rendered preview in the side editor. */
const TEXT_PREVIEW_EXTENSIONS = ['txt', 'log'];
const AUDIO_PREVIEW_EXTENSIONS = ['mp3', 'wav', 'm4a', 'ogg'];

export function isPreviewableEditorFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jsonld') return true;
  return (
    ext === 'md'
    || ext === 'markdown'
    || TEXT_PREVIEW_EXTENSIONS.includes(ext)
    || ext === 'html'
    || ext === 'htm'
    || ext === 'csv'
    || ext === 'tsv'
    || ext === 'pdf'
    || ['mp4', 'mov', 'webm', 'avi', 'mkv', 'flv', 'wmv', 'm4v'].includes(ext)
    || AUDIO_PREVIEW_EXTENSIONS.includes(ext)
    || ext === 'docx'
    || ext === 'pptx'
    || ext === 'xlsx'
    || ext === 'xls'
    || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)
  );
}

export function isTextPreviewFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_PREVIEW_EXTENSIONS.includes(ext);
}

export function isAudioEditorFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_PREVIEW_EXTENSIONS.includes(ext);
}

export function isHtmlEditorFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'html' || ext === 'htm';
}

export function isMarkdownEditorFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'md' || ext === 'markdown';
}

export function isCsvEditorFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'csv' || ext === 'tsv';
}