// PD-SAAS-FORK: human-readable file type labels for deliverable summary table
import {
  isAudioFile,
  isImageFile,
  isVideoFile,
} from '../components/code-editor/utils/binaryFile';
import { getArtifactFileName, type DeliverableKind } from './artifactPaths';
import { formatDeliverableLinkPath } from './deliverableSummaryLabels';

const EXT_TYPE_LABELS: Record<string, string> = {
  md: 'Markdown',
  markdown: 'Markdown',
  txt: '文本',
  html: 'HTML',
  htm: 'HTML',
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  pptx: 'PPT',
  ppt: 'PPT',
  xlsx: 'Excel',
  xls: 'Excel',
  csv: 'CSV',
  png: 'PNG',
  jpg: 'JPEG',
  jpeg: 'JPEG',
  webp: 'WebP',
  gif: 'GIF',
  svg: 'SVG',
  bmp: 'BMP',
  mp4: 'MP4',
  webm: 'WebM',
  mov: 'MOV',
  avi: 'AVI',
  mkv: 'MKV',
  mp3: 'MP3',
  wav: 'WAV',
  jsonld: 'JSON-LD',
  json: 'JSON',
  xml: 'XML',
  zip: 'ZIP',
};

export function formatDeliverableFileTypeLabel(path: string, kind: DeliverableKind): string {
  if (kind === 'url') return '链接';
  const fileName = getArtifactFileName(path) || path;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (EXT_TYPE_LABELS[ext]) return EXT_TYPE_LABELS[ext];
  if (isAudioFile(fileName)) return '音频';
  if (isImageFile(fileName)) return '图片';
  if (isVideoFile(fileName)) return '视频';

  switch (kind) {
    case 'html':
      return 'HTML';
    case 'image':
      return '图片';
    case 'video':
      return '视频';
    case 'pdf':
      return 'PDF';
    case 'document':
      return ext === 'docx' || ext === 'doc' ? 'Word' : 'Markdown';
    case 'spreadsheet':
      return '表格';
    case 'presentation':
      return 'PPT';
    case 'archive':
      return '压缩包';
    case 'code':
      return ext ? ext.toUpperCase() : '代码';
    case 'design_canvas':
      return '设计画布';
    default:
      return ext ? ext.toUpperCase() : '文件';
  }
}

/** 汇总表名称列内联缩略图：图片 / 视频（点击放大或播放） */
export function supportsSummaryInlineMediaPreview(path: string, kind: DeliverableKind): boolean {
  if (kind === 'url') return false;
  const fileName = getArtifactFileName(path) || path;
  return kind === 'image'
    || kind === 'video'
    || isImageFile(fileName)
    || isVideoFile(fileName);
}

export type SummaryTableLinkDisplay =
  | { mode: 'external'; href: string }
  | { mode: 'project'; href: string }
  | { mode: 'none' };

/**
 * 链接列：外链展示短 URL；项目文件展示 basename（完整路径在 title / path 解析）。
 */
export function formatSummaryTableLinkLabel(path: string, kind: DeliverableKind): string {
  const normalized = String(path ?? '').replace(/\\/g, '/').trim();
  if (/^https?:\/\//i.test(normalized)) {
    return truncateExternalUrl(normalized);
  }
  return getArtifactFileName(normalized) || normalized;
}

export function resolveSummaryTableLinkDisplay(path: string, kind: DeliverableKind): SummaryTableLinkDisplay {
  const normalized = String(path ?? '').replace(/\\/g, '/').trim();
  if (/^https?:\/\//i.test(normalized)) {
    return { mode: 'external', href: normalized };
  }
  const link = formatDeliverableLinkPath(normalized);
  return link ? { mode: 'project', href: link } : { mode: 'none' };
}

export function truncateExternalUrl(url: string, max = 48): string {
  const text = String(url ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
