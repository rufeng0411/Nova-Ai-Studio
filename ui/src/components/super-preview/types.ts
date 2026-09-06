import type { ReactNode } from 'react';
import type { DeliverableKind } from '../../shared/artifactPaths';
import type { ArtifactContract, SuperPreviewAdapter } from '../../shared/artifactContract';
import type { ArtifactScope } from '../../shared/artifactScope';
import type { DocumentCanvasVariant } from '../document-canvas/types';
import type { SuperPreviewMode } from './SuperPreviewModeToggle';

export type SuperPreviewRootProps = {
  projectName: string;
  apiPath: string;
  fileName: string;
  kind: DeliverableKind;
  previewUrl: string;
  projectRoot?: string;
  className?: string;
  documentCanvasVariant?: DocumentCanvasVariant;
  /** PD-SAAS-FORK: overlay forbids inline edit — use dock protocol */
  previewSurface?: 'overlay' | 'sidebar';
  initialDesignCanvasMode?: SuperPreviewMode;
  /** PD-SAAS-FORK: HTML Studio initial mode (sidebar only for edit) */
  initialHtmlStudioMode?: SuperPreviewMode;
  /** PD-SAAS-FORK: HyperFrames Studio initial mode (sidebar only for edit) */
  initialHfStudioMode?: SuperPreviewMode;
  /** PD-SAAS-FORK: Bento deck initial mode (sidebar defaults to edit) */
  initialBentoStudioMode?: SuperPreviewMode;
  hintDir?: string;
  /** When set (overlay), Edit button triggers dock instead of inline edit */
  onEditDockRequest?: () => void;
  /** Unified sidebar chrome: download / export / window controls (single row). */
  previewChromeActions?: ReactNode;
  /** Close (and pairs with web refresh at row end). */
  previewChromeTrailing?: ReactNode;
  /** Shared document-canvas state across sidebar and overlay surfaces. */
  previewSessionKey?: string;
};

export type SuperPreviewContext = {
  contract: ArtifactContract;
  artifactScope: ArtifactScope;
  adapter: SuperPreviewAdapter;
  siblings: string[];
  loading: boolean;
  error?: string;
};
