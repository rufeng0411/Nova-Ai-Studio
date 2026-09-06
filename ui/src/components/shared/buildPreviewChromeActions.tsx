import type { ReactNode } from 'react';
import type { DeliverableKind } from '../../shared/artifactPaths';
import { isMarkdownEditorFile } from '../code-editor/utils/previewableFile';
import { supportsBrowserNewTabForFile } from '../../shared/projectPreviewCapabilities';
import MarkdownShareButton from './MarkdownShareButton';
import type { MarkdownShareTarget } from '../../shared/markdownShareUrl';
import PreviewActionToolbar from './PreviewActionToolbar';
import { PreviewChromeCloseButton } from '../super-preview/PreviewChromeBar';

type PreviewChromePagination = {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export type MarkdownShareContext = MarkdownShareTarget;

export type BuildPreviewChromeActionsOptions = {
  fileName: string;
  kind?: DeliverableKind;
  previewUrl?: string | null;
  downloadUrl?: string | null;
  showOpenInPanel?: boolean;
  showDownload?: boolean;
  showClose?: boolean;
  onOpenInPanel?: () => void;
  onClose?: () => void;
  exportActions?: ReactNode;
  pagination?: PreviewChromePagination;
  /** Markdown 分享（PC 新标签 / 移动端系统分享） */
  markdownShare?: MarkdownShareContext | null;
};

function resolveMarkdownShare(
  fileName: string,
  markdownShare?: MarkdownShareContext | null,
): MarkdownShareContext | null {
  if (!markdownShare?.projectName || !markdownShare.apiPath) return null;
  if (!isMarkdownEditorFile(fileName)) return null;
  return markdownShare;
}

export function buildPreviewChromeActions({
  fileName,
  kind,
  previewUrl = null,
  downloadUrl = null,
  showOpenInPanel = false,
  showDownload = true,
  showClose = false,
  onOpenInPanel,
  onClose,
  exportActions,
  pagination,
  markdownShare,
}: BuildPreviewChromeActionsOptions): ReactNode {
  const shareTarget = resolveMarkdownShare(fileName, markdownShare);
  return (
    <PreviewActionToolbar
      variant="editor"
      previewUrl={previewUrl}
      downloadUrl={downloadUrl}
      showOpenInPanel={showOpenInPanel}
      showRevealFolder={false}
      showDownload={showDownload}
      showNewTab={supportsBrowserNewTabForFile(fileName, kind) && Boolean(previewUrl)}
      showClose={showClose}
      onOpenInPanel={onOpenInPanel}
      onClose={onClose}
      exportActions={exportActions}
      pagination={pagination}
      markdownShare={shareTarget}
    />
  );
}

export function buildPreviewChromeTrailing(onClose: () => void, label: string): ReactNode {
  return <PreviewChromeCloseButton onClose={onClose} label={label} />;
}

/** Shared session key — overlay / detached / sidebar stay on the same page + zoom. */
export function buildPreviewSessionKey(projectName: string, apiPath: string, fileName: string): string {
  return `${projectName}::${apiPath}::${fileName}`;
}

/** Document canvas (PDF/Word/PPT) chrome aligned to right sidebar — no deliverable pagination / 右栏打开. */
export function buildSidebarDocumentPreviewChrome(
  options: Omit<BuildPreviewChromeActionsOptions, 'showOpenInPanel' | 'pagination' | 'showClose' | 'onClose'>,
): ReactNode {
  return buildPreviewChromeActions({
    ...options,
    showOpenInPanel: false,
    showClose: false,
    pagination: undefined,
  });
}
