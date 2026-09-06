import { useMemo } from 'react';

import type { ReactNode } from 'react';
import type { CodeEditorFile } from '../../types/types';
import type { DocumentCanvasVariant } from '../../../document-canvas/types';

import { resolveEditorApiPath } from '../../utils/resolveEditorApiPath';

import { classifyDeliverablePath } from '../../../../shared/artifactPaths';
import { supportsUnifiedFilePreview } from '../../../../shared/projectPreviewCapabilities';
import { resolveProjectInlineMediaUrl } from '../../../../shared/projectInlineMediaUrl';

import UnifiedPreviewHost from '../../../shared/UnifiedPreviewHost';

type PreviewShellProps = {
  projectName?: string;
  projectRoot?: string;
  file: CodeEditorFile;
  title: string;
  message: string;
  onClose: () => void;
  surface?: DocumentCanvasVariant;
  previewChromeActions?: ReactNode;
  previewChromeTrailing?: ReactNode;
  previewSessionKey?: string;
  onEditDockRequest?: () => void;
};

function FallbackContent({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-card p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="mb-1 text-[14px] font-medium text-foreground">{title}</h3>
          <p className="text-[13px] text-muted-foreground">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-md bg-primary px-4 py-1.5 text-[13px] text-primary-foreground transition-colors hover:opacity-90 dark:bg-muted dark:text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// PD-SAAS-FORK: align sidebar preview with deliverable overlay (ProjectFilePreview + PreviewSurfaceShell)
function SharedProjectFilePreview({
  projectName,
  projectRoot,
  file,
  title,
  message,
  onClose,
  surface = 'sidebar',
  previewChromeActions,
  previewChromeTrailing,
  previewSessionKey,
  onEditDockRequest,
}: PreviewShellProps) {
  const apiPath = useMemo(() => resolveEditorApiPath(file.path, projectRoot), [file.path, projectRoot]);
  const kind = useMemo(() => classifyDeliverablePath(file.name), [file.name]);
  const previewUrl = useMemo(() => {
    if (!projectName || !apiPath) return '';
    return resolveProjectInlineMediaUrl(projectName, apiPath, file.name, projectRoot || '', kind);
  }, [apiPath, file.name, kind, projectName, projectRoot]);

  if (!projectName || !apiPath) {
    return <FallbackContent title={title} message={message} onClose={onClose} />;
  }

  return (
    <UnifiedPreviewHost
      surface={surface}
      projectName={projectName}
      apiPath={apiPath}
      fileName={file.name}
      kind={kind}
      previewUrl={previewUrl}
      projectRoot={projectRoot}
      className="h-full w-full min-h-0"
      designCanvasMode={file.designCanvasMode}
      htmlStudioMode={file.htmlStudioMode}
      hfStudioMode={file.hfStudioMode}
      bentoStudioMode={file.bentoStudioMode}
      hintDir={file.hintDir}
      skipResolve={file.skipResolve}
      previewChromeActions={previewChromeActions}
      previewChromeTrailing={previewChromeTrailing}
      previewSessionKey={previewSessionKey ?? `${projectName}::${apiPath}::${file.name}`}
      onEditDockRequest={onEditDockRequest}
    />
  );
}

export function BinaryFilePreviewContent(props: PreviewShellProps) {
  const { file } = props;
  if (supportsUnifiedFilePreview(file.name)) return <SharedProjectFilePreview {...props} />;
  return <FallbackContent title={props.title} message={props.message} onClose={props.onClose} />;
}

export function canPreviewBinaryFile(fileName: string): boolean {
  return supportsUnifiedFilePreview(fileName);
}
