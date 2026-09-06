import type { ReactNode } from 'react';
import type { DeliverableKind } from '../../shared/artifactPaths';
import type { DocumentCanvasVariant } from '../document-canvas/types';
import ProjectFilePreview from './ProjectFilePreview';
import PreviewSurfaceShell from './PreviewSurfaceShell';

export type UnifiedPreviewHostProps = {
  surface: DocumentCanvasVariant;
  projectName?: string;
  apiPath?: string;
  fileName: string;
  kind: DeliverableKind;
  previewUrl: string;
  projectRoot?: string;
  className?: string;
  skipResolve?: boolean;
  hintDir?: string;
  designCanvasMode?: 'view' | 'edit';
  htmlStudioMode?: 'view' | 'edit';
  hfStudioMode?: 'view' | 'edit';
  bentoStudioMode?: 'view' | 'edit';
  onEditDockRequest?: () => void;
  previewChromeActions?: ReactNode;
  previewChromeTrailing?: ReactNode;
  previewSessionKey?: string;
  resolving?: boolean;
  fallbackContent?: ReactNode;
};

export default function UnifiedPreviewHost({
  surface,
  projectName,
  apiPath,
  fileName,
  kind,
  previewUrl,
  projectRoot,
  className = 'h-full min-h-0 flex-1',
  skipResolve = false,
  hintDir,
  designCanvasMode = 'view',
  htmlStudioMode = 'view',
  hfStudioMode = 'view',
  bentoStudioMode = 'edit',
  onEditDockRequest,
  previewChromeActions,
  previewChromeTrailing,
  previewSessionKey,
  resolving = false,
  fallbackContent,
}: UnifiedPreviewHostProps) {
  return (
    <PreviewSurfaceShell fileName={fileName} kind={kind} className={className}>
      {resolving ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : projectName && apiPath ? (
        <ProjectFilePreview
          projectName={projectName}
          apiPath={apiPath}
          fileName={fileName}
          kind={kind}
          previewUrl={previewUrl}
          projectRoot={projectRoot}
          documentCanvasVariant={surface}
          className="h-full w-full min-h-0"
          skipResolve={skipResolve}
          hintDir={hintDir}
          designCanvasMode={designCanvasMode}
          htmlStudioMode={htmlStudioMode}
          hfStudioMode={hfStudioMode}
          bentoStudioMode={bentoStudioMode}
          onEditDockRequest={onEditDockRequest}
          previewChromeActions={previewChromeActions}
          previewChromeTrailing={previewChromeTrailing}
          previewSessionKey={previewSessionKey}
        />
      ) : (
        fallbackContent
      )}
    </PreviewSurfaceShell>
  );
}
