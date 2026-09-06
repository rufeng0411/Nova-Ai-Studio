// PD-SAAS-FORK: file-level icon actions for unified preview chrome (sidebar)
import type { ReactNode } from 'react';
import {
  ChevronsLeftRight,
  ChevronsRightLeft,
  Code2,
  Download,
  ExternalLink,
  Eye,
} from 'lucide-react';
import type { MarkdownShareTarget } from '../../../../shared/markdownShareUrl';
import MarkdownShareButton from '../../../shared/MarkdownShareButton';
import {
  PreviewChromeDivider,
  PreviewChromeGroup,
  PreviewChromeIconButton,
  PreviewChromeLink,
} from '../../../super-preview/PreviewChromeBar';

export type PreviewEditorChromeActionsProps = {
  previewOpenUrl?: string | null;
  showExternalLink?: boolean;
  showEditToggle?: boolean;
  previewMode?: boolean;
  onTogglePreview?: () => void;
  onDownload: () => void;
  onToggleExpand?: (() => void) | null;
  isExpanded?: boolean;
  exportActions?: ReactNode;
  markdownShare?: MarkdownShareTarget | null;
  labels: {
    editSource: string;
    previewContent: string;
    download: string;
    openInNewWindow?: string;
    expand: string;
    collapse: string;
  };
};

function hasNodeContent(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false;
}

export default function PreviewEditorChromeActions({
  previewOpenUrl,
  showExternalLink = false,
  showEditToggle = false,
  previewMode = true,
  onTogglePreview,
  onDownload,
  onToggleExpand,
  isExpanded = false,
  exportActions,
  markdownShare,
  labels,
}: PreviewEditorChromeActionsProps) {
  const showOpen = showExternalLink && Boolean(previewOpenUrl);
  const showShare = Boolean(markdownShare);
  const showExport = hasNodeContent(exportActions);
  const showView = (showEditToggle && onTogglePreview) || Boolean(onToggleExpand);

  let sectionStarted = false;
  const leadDivider = () => {
    if (!sectionStarted) {
      sectionStarted = true;
      return null;
    }
    return <PreviewChromeDivider />;
  };

  return (
    <>
      {showOpen ? (
        <>
          {leadDivider()}
          <PreviewChromeGroup aria-label="外部打开">
            <PreviewChromeLink
              href={previewOpenUrl!}
              title={labels.openInNewWindow || '新标签页打开'}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            </PreviewChromeLink>
          </PreviewChromeGroup>
        </>
      ) : null}

      {showShare && markdownShare ? (
        <>
          {leadDivider()}
          <PreviewChromeGroup aria-label="分享">
            <MarkdownShareButton target={markdownShare} />
          </PreviewChromeGroup>
        </>
      ) : null}

      {showExport ? (
        <>
          {leadDivider()}
          <PreviewChromeGroup aria-label="导出">{exportActions}</PreviewChromeGroup>
        </>
      ) : null}

      <>
        {leadDivider()}
        <PreviewChromeGroup aria-label="文件">
          <PreviewChromeIconButton title={labels.download} aria-label={labels.download} onClick={onDownload}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          </PreviewChromeIconButton>
        </PreviewChromeGroup>
      </>

      {showView ? (
        <>
          {leadDivider()}
          <PreviewChromeGroup aria-label="视图">
            {showEditToggle && onTogglePreview ? (
              <PreviewChromeIconButton
                active={previewMode}
                title={previewMode ? labels.editSource : labels.previewContent}
                aria-label={previewMode ? labels.editSource : labels.previewContent}
                onClick={onTogglePreview}
              >
                {previewMode ? (
                  <Code2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </PreviewChromeIconButton>
            ) : null}
            {onToggleExpand ? (
              <PreviewChromeIconButton
                title={isExpanded ? labels.collapse : labels.expand}
                aria-label={isExpanded ? labels.collapse : labels.expand}
                onClick={onToggleExpand}
              >
                {isExpanded ? (
                  <ChevronsRightLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <ChevronsLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </PreviewChromeIconButton>
            ) : null}
          </PreviewChromeGroup>
        </>
      ) : null}
    </>
  );
}
