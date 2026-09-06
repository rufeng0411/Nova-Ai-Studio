import { Suspense, lazy, useMemo } from 'react';
import type { DeliverableKind } from '../../../../shared/artifactPaths';
import { getArtifactFileName } from '../../../../shared/artifactPaths';
import { resolvePreviewKind } from '../../../../shared/projectPreviewCapabilities';
import { resolveProjectInlineMediaUrl } from '../../../../shared/projectInlineMediaUrl';
import {
  isAudioFile,
  isDocxFile,
  isImageFile,
  isPdfFile,
  isPptxFile,
  isVideoFile,
} from '../../../code-editor/utils/binaryFile';
import {
  isMarkdownEditorFile,
  isTextPreviewFile,
} from '../../../code-editor/utils/previewableFile';
import { supportsInlineSpreadsheetPreview } from '../../../shared/previewKindForExt';
import ProjectMarkdownPreview from '../../../shared/ProjectMarkdownPreview';
import ProgressiveProjectImage from '../../../shared/ProgressiveProjectImage';
import FallbackPreviewAdapter from '../fallback/FallbackPreviewAdapter';
import MediaPreviewAdapter from '../media/MediaPreviewAdapter';
import SpreadsheetPreviewAdapter from '../spreadsheet/SpreadsheetPreviewAdapter';
import TextPreviewAdapter from '../markdownText/TextPreviewAdapter';
import CodePreviewAdapter from '../code/CodePreviewAdapter';
import WebPreviewEmbedded from '../web/WebPreviewEmbedded';
import { isCodePreviewFile, isHtmlPreviewFile } from '../../superPreviewRouting';

const DocumentCanvasPreview = lazy(() => import('../../../document-canvas/DocumentCanvasPreview'));

function LoadingSurface() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

type CollectionMainPreviewProps = {
  projectName: string;
  projectRoot?: string;
  path: string;
  kind: DeliverableKind;
};

export default function CollectionMainPreview({
  projectName,
  projectRoot,
  path,
  kind,
}: CollectionMainPreviewProps) {
  const fileName = getArtifactFileName(path);
  const resolvedKind = resolvePreviewKind(fileName, kind);
  const previewUrl = useMemo(
    () => resolveProjectInlineMediaUrl(projectName, path, fileName, projectRoot, resolvedKind),
    [fileName, path, projectName, projectRoot, resolvedKind],
  );

  if (isMarkdownEditorFile(fileName)) {
    return (
      <ProjectMarkdownPreview
        projectName={projectName}
        apiPath={path}
        projectRoot={projectRoot}
        className="h-full min-h-0"
      />
    );
  }

  if (isHtmlPreviewFile(fileName)) {
    return (
      <WebPreviewEmbedded
        previewUrl={previewUrl}
        fileName={fileName}
      />
    );
  }

  if (isCodePreviewFile(fileName, resolvedKind)) {
    return (
      <CodePreviewAdapter
        projectName={projectName}
        apiPath={path}
        projectRoot={projectRoot}
        fileName={fileName}
        embedInChrome
      />
    );
  }

  if (isTextPreviewFile(fileName)) {
    return (
      <TextPreviewAdapter
        projectName={projectName}
        apiPath={path}
        projectRoot={projectRoot}
        title={fileName}
        embedInChrome
      />
    );
  }

  if (resolvedKind === 'spreadsheet' || supportsInlineSpreadsheetPreview(fileName)) {
    return (
      <SpreadsheetPreviewAdapter
        projectName={projectName}
        apiPath={path}
        fileName={fileName}
        projectRoot={projectRoot}
      />
    );
  }

  if (isImageFile(fileName)) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-neutral-950 p-4">
        <ProgressiveProjectImage
          projectName={projectName}
          projectRoot={projectRoot}
          filePath={path}
          fullMode="content"
          alt={fileName}
          className="max-h-full max-w-full rounded bg-transparent shadow-2xl"
          imageClassName="max-h-full max-w-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  if (isVideoFile(fileName) || isAudioFile(fileName)) {
    return (
      <MediaPreviewAdapter
        projectName={projectName}
        apiPath={path}
        previewUrl={previewUrl}
        fileName={fileName}
      />
    );
  }

  if (isPdfFile(fileName) || isDocxFile(fileName) || isPptxFile(fileName)) {
    return (
      <Suspense fallback={<LoadingSurface />}>
        <DocumentCanvasPreview
          projectName={projectName}
          apiPath={path}
          fileName={fileName}
          variant="sidebar"
          fallbackPreviewUrl={previewUrl}
          previewSessionKey={`${projectName}::${path}::${fileName}`}
        />
      </Suspense>
    );
  }

  if (previewUrl) {
    return (
      <iframe
        title={fileName}
        src={previewUrl}
        className="h-full w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    );
  }

  return <FallbackPreviewAdapter message="该文件暂不支持内联预览。" />;
}
