import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import type { ArtifactScope } from '../../shared/artifactScope';
import type { ArtifactContract, SuperPreviewAdapter } from '../../shared/artifactContract';
import { cn } from '../../lib/utils';
import {
  PreviewChromeBar,
  PreviewChromeDivider,
  PreviewChromeGroup,
} from './PreviewChromeBar';
import SuperPreviewModeToggle, { type SuperPreviewMode } from './SuperPreviewModeToggle';
import SuperPreviewReferenceButton from './SuperPreviewReferenceButton';

type SuperPreviewShellProps = {
  contract: ArtifactContract;
  adapter: SuperPreviewAdapter;
  loading?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
  showModeToggle?: boolean;
  previewMode?: SuperPreviewMode;
  onPreviewModeChange?: (mode: SuperPreviewMode) => void;
  editModeDisabled?: boolean;
  editModeDisabledReason?: string;
  artifactScope?: ArtifactScope;
  referenceSiblings?: string[];
  /** Sidebar: filename lives here; editor header hidden. */
  compact?: boolean;
  /** Adapter controls (web viewport / refresh). */
  headerActions?: ReactNode;
  /** File-level actions from editor (download, export, window). */
  chromeActions?: ReactNode;
  /** Refresh + other trailing actions (scroll with toolbar). */
  endActions?: ReactNode;
  /** Close — always pinned on the right edge of the chrome bar. */
  pinnedEndActions?: ReactNode;
  /** Hide bar — actions moved to document canvas toolbar. */
  hideHeader?: boolean;
};

export default function SuperPreviewShell({
  contract,
  adapter: _adapter,
  loading = false,
  error,
  className,
  children,
  showModeToggle = false,
  previewMode = 'view',
  onPreviewModeChange,
  editModeDisabled = false,
  editModeDisabledReason,
  artifactScope,
  referenceSiblings,
  compact = false,
  headerActions,
  chromeActions,
  endActions,
  pinnedEndActions,
  hideHeader = false,
}: SuperPreviewShellProps) {
  const showTitle = compact || Boolean(chromeActions);
  const hasActions =
    headerActions || chromeActions || endActions || pinnedEndActions || artifactScope || showModeToggle || loading || error;

  if (hideHeader || (!showTitle && !hasActions)) {
    return (
      <div className={cn('flex h-full w-full min-h-0 flex-col overflow-hidden bg-card', className)}>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    );
  }

  const statusHint = loading
    ? '…'
    : error
      ? '!'
      : null;

  return (
    <div className={cn('flex h-full w-full min-h-0 flex-col overflow-hidden bg-card', className)}>
      <PreviewChromeBar
        title={showTitle ? contract.title : undefined}
        titleIcon={<FileText className="h-3.5 w-3.5" aria-hidden />}
        pinnedTrailing={pinnedEndActions}
      >
        {headerActions ? headerActions : null}
        {headerActions && chromeActions ? <PreviewChromeDivider /> : null}
        {chromeActions ? chromeActions : null}
        {(headerActions || chromeActions) && artifactScope ? <PreviewChromeDivider /> : null}
        {artifactScope ? (
          <PreviewChromeGroup>
            <SuperPreviewReferenceButton
              artifactScope={artifactScope}
              siblings={referenceSiblings}
            />
          </PreviewChromeGroup>
        ) : null}
        {showModeToggle && onPreviewModeChange ? (
          <>
            <PreviewChromeDivider />
            <PreviewChromeGroup>
              <SuperPreviewModeToggle
                mode={previewMode}
                onModeChange={onPreviewModeChange}
                editDisabled={editModeDisabled}
                editDisabledReason={editModeDisabledReason}
              />
            </PreviewChromeGroup>
          </>
        ) : null}
        {endActions ? (
          <>
            <PreviewChromeDivider />
            {endActions}
          </>
        ) : null}
        {statusHint ? (
          <span
            className="ml-1 shrink-0 text-[10px] text-muted-foreground"
            title={
              loading
                ? '正在读取预览上下文…'
                : '部分预览上下文读取失败，已使用基础预览。'
            }
          >
            {statusHint}
          </span>
        ) : null}
      </PreviewChromeBar>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
