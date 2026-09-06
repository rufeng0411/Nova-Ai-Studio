// PD-SAAS-FORK: shared preview chrome (new tab, download, panel, folder)
import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  PanelRight,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MarkdownShareTarget } from '../../shared/markdownShareUrl';
import MarkdownShareButton from './MarkdownShareButton';
import { PreviewChromeDivider, PreviewChromeGroup } from '../super-preview/PreviewChromeBar';

export type PreviewActionToolbarProps = {
  previewUrl?: string | null;
  downloadUrl?: string | null;
  showOpenInPanel?: boolean;
  showRevealFolder?: boolean;
  showDownload?: boolean;
  showNewTab?: boolean;
  showClose?: boolean;
  onOpenInPanel?: () => void;
  onRevealFolder?: () => void;
  onClose?: () => void;
  revealing?: boolean;
  revealDisabled?: boolean;
  variant?: 'overlay' | 'editor';
  pagination?: {
    index: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
  };
  /** PD-SAAS-FORK: office export actions (PDF/Word/PPT/Excel) */
  exportActions?: ReactNode;
  /** PD-SAAS-FORK: Markdown 分享 */
  markdownShare?: MarkdownShareTarget | null;
};

function hasNodeContent(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false;
}

export function PreviewActionToolbar({
  previewUrl = null,
  downloadUrl = null,
  showOpenInPanel = false,
  showRevealFolder = false,
  showDownload = true,
  showNewTab = true,
  showClose = true,
  onOpenInPanel,
  onRevealFolder,
  onClose,
  revealing = false,
  revealDisabled = false,
  variant = 'overlay',
  pagination,
  exportActions,
  markdownShare,
}: PreviewActionToolbarProps) {
  const { t } = useTranslation('chat');

  const overlayBtn =
    'inline-flex min-h-[44px] items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-card/10 hover:text-primary-foreground max-md:min-h-[44px] max-md:px-2';
  const editorBtn =
    'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
  const btn = variant === 'editor' ? editorBtn : overlayBtn;

  const newTabLabel = t('deliverables.newTab', { defaultValue: '新标签' });
  const downloadLabel = t('deliverables.download', { defaultValue: '下载' });

  const showNavigate = showOpenInPanel && onOpenInPanel;
  const showShare = Boolean(markdownShare);
  const showOpen = showNewTab && Boolean(previewUrl);
  const showFile = (showDownload && Boolean(downloadUrl)) || hasNodeContent(exportActions);
  const showFolder = showRevealFolder && onRevealFolder;

  if (variant === 'editor') {
    let sectionStarted = false;
    const leadDivider = () => {
      if (!sectionStarted) {
        sectionStarted = true;
        return null;
      }
      return <PreviewChromeDivider />;
    };

    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
        {showNavigate ? (
          <>
            {leadDivider()}
            <PreviewChromeGroup aria-label="导航">
              <button
                type="button"
                onClick={onOpenInPanel}
                className={btn}
                title={t('deliverables.openInPanel', { defaultValue: '在右栏打开' })}
              >
                <PanelRight className="h-3.5 w-3.5" />
              </button>
            </PreviewChromeGroup>
          </>
        ) : null}
        {showShare && markdownShare ? (
          <>
            {leadDivider()}
            <PreviewChromeGroup aria-label={t('deliverables.shareMarkdown', { defaultValue: '分享' })}>
              <MarkdownShareButton target={markdownShare} />
            </PreviewChromeGroup>
          </>
        ) : null}
        {showOpen ? (
          <>
            {leadDivider()}
            <PreviewChromeGroup aria-label="外部打开">
              <a
                href={previewUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className={btn}
                title={newTabLabel}
                aria-label={newTabLabel}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </PreviewChromeGroup>
          </>
        ) : null}
        {showFile ? (
          <>
            {leadDivider()}
            <PreviewChromeGroup aria-label="文件">
              {showDownload && downloadUrl ? (
                <a href={downloadUrl} download className={btn} title={downloadLabel} aria-label={downloadLabel}>
                  <Download className="h-3.5 w-3.5" />
                </a>
              ) : null}
              {exportActions}
            </PreviewChromeGroup>
          </>
        ) : null}
        {showFolder ? (
          <>
            {leadDivider()}
            <PreviewChromeGroup aria-label="位置">
              <button
                type="button"
                onClick={() => void onRevealFolder()}
                disabled={revealing || revealDisabled}
                className={btn}
                title={t('deliverables.openFolder', { defaultValue: '打开文件夹' })}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </PreviewChromeGroup>
          </>
        ) : null}
        {pagination && pagination.total > 1 ? (
          <>
            {leadDivider()}
            <span className="shrink-0 rounded-full bg-card/10 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {pagination.index + 1} / {pagination.total}
            </span>
          </>
        ) : null}
        {showClose && onClose ? (
          <>
            {leadDivider()}
            <PreviewChromeGroup aria-label="面板">
              <button
                type="button"
                onClick={onClose}
                className={`${editorBtn} max-md:min-h-[44px] max-md:min-w-[44px]`}
                aria-label={t('deliverables.closePreview', { defaultValue: '关闭预览' })}
                title={t('deliverables.closePreview', { defaultValue: '关闭预览' })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </PreviewChromeGroup>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mobile-icon-row flex shrink-0 flex-nowrap items-center gap-0.5 max-md:gap-2">
      {showNavigate ? (
        <button type="button" onClick={onOpenInPanel} className={btn} title={t('deliverables.openInPanel', { defaultValue: '在右栏打开' })}>
          <PanelRight className="h-3.5 w-3.5" />
          {t('deliverables.openInPanel', { defaultValue: '在右栏打开' })}
        </button>
      ) : null}
      {showShare && markdownShare ? (
        <MarkdownShareButton target={markdownShare} variant="overlay" />
      ) : null}
      {showOpen ? (
        <a href={previewUrl!} target="_blank" rel="noopener noreferrer" className={btn} title={newTabLabel} aria-label={newTabLabel}>
          <ExternalLink className="h-3.5 w-3.5" />
          {newTabLabel}
        </a>
      ) : null}
      {showDownload && downloadUrl ? (
        <a href={downloadUrl} download className={btn} title={downloadLabel} aria-label={downloadLabel}>
          <Download className="h-3.5 w-3.5" />
          {downloadLabel}
        </a>
      ) : null}
      {exportActions}
      {showFolder ? (
        <button
          type="button"
          onClick={() => void onRevealFolder()}
          disabled={revealing || revealDisabled}
          className={btn}
          title={t('deliverables.openFolder', { defaultValue: '打开文件夹' })}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {t('deliverables.openFolder', { defaultValue: '打开文件夹' })}
        </button>
      ) : null}
      {pagination && pagination.total > 1 ? (
        <span className="shrink-0 rounded-full bg-card/10 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {pagination.index + 1} / {pagination.total}
        </span>
      ) : null}
      {showClose && onClose ? (
        <button
          type="button"
          onClick={onClose}
          className={`${editorBtn} max-md:min-h-[44px] max-md:min-w-[44px]`}
          aria-label={t('deliverables.closePreview', { defaultValue: '关闭预览' })}
          title={t('deliverables.closePreview', { defaultValue: '关闭预览' })}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export type PreviewPaginationControlsProps = {
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
};

export function PreviewPaginationControls({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: PreviewPaginationControlsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-primary-foreground shadow-sm transition hover:bg-black/70"
        aria-label={prevLabel}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-primary-foreground shadow-sm transition hover:bg-black/70"
        aria-label={nextLabel}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  );
}

export default PreviewActionToolbar;
