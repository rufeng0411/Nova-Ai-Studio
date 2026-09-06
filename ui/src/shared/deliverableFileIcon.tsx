/**
 * PD-SAAS-FORK: deliverable file-type icons — shared by conversation thumbs, dock list, file tree colors.
 */
import { useMemo } from 'react';
import {
  Archive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType2,
  Globe,
  Image as ImageIcon,
  Play,
  Presentation,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DeliverableKind } from './artifactPaths';
import { getFileIconData } from '../components/file-tree/constants/fileIcons';
import { isAudioFile } from '../components/code-editor/utils/binaryFile';
import { cn } from '../lib/utils';

function kindIcon(kind: DeliverableKind, fileName = ''): LucideIcon {
  if (isAudioFile(fileName)) return Play;
  switch (kind) {
    case 'html':
      return FileCode2;
    case 'image':
      return ImageIcon;
    case 'video':
      return Play;
    case 'pdf':
      return FileType2;
    case 'document':
      return FileText;
    case 'spreadsheet':
      return FileSpreadsheet;
    case 'presentation':
      return Presentation;
    case 'archive':
      return Archive;
    case 'code':
      return FileCode2;
    case 'url':
      return Globe;
    default:
      return FileText;
  }
}

/** Align with file-tree extension colors (md → blue, pdf → red, html → orange, …). */
export function resolveDeliverableFileIcon(
  fileName: string,
  kind: DeliverableKind,
): { Icon: LucideIcon; colorClass: string } {
  if (isAudioFile(fileName)) {
    return { Icon: Play, colorClass: 'text-pink-500' };
  }
  if (kind === 'url') {
    return { Icon: Globe, colorClass: 'text-sky-500' };
  }

  const { icon, color } = getFileIconData(fileName);
  if (color !== 'text-muted-foreground') {
    return { Icon: icon, colorClass: color };
  }

  const kindColor: Partial<Record<DeliverableKind, string>> = {
    html: 'text-orange-600',
    image: 'text-purple-500',
    video: 'text-rose-500',
    pdf: 'text-red-600',
    document: 'text-blue-600',
    spreadsheet: 'text-green-600',
    presentation: 'text-orange-500',
    archive: 'text-amber-600',
    code: 'text-blue-500',
    file: 'text-muted-foreground',
  };

  return {
    Icon: kindIcon(kind, fileName),
    colorClass: kindColor[kind] ?? 'text-muted-foreground',
  };
}

export function DeliverableFileTypeIcon({
  fileName,
  kind,
  className,
  strokeWidth = 1.75,
}: {
  fileName: string;
  kind: DeliverableKind;
  className?: string;
  strokeWidth?: number;
}) {
  const { Icon, colorClass } = useMemo(
    () => resolveDeliverableFileIcon(fileName, kind),
    [fileName, kind],
  );
  return (
    <Icon
      className={cn('shrink-0', colorClass, className)}
      strokeWidth={strokeWidth}
      aria-hidden
    />
  );
}
