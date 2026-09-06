// PD-SAAS-FORK: unified file preview renderer with video blob fallback.
// Single pipeline for 右栏 / 成果弹窗 / 文件树 — do not fork preview logic elsewhere.
import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import type { DeliverableKind } from '../../shared/artifactPaths';
import { useResolvedProjectApiPath } from '../../shared/hooks/useResolvedProjectApiPath';
import { resolvePreviewKind, requiresInAppPreviewRenderer, usesDocumentCanvas } from '../../shared/projectPreviewCapabilities';
import { api } from '../../utils/api';
import {
  isImageFile,
  isVideoFile,
  isXlsxFile,
} from '../code-editor/utils/binaryFile';
import { isMarkdownEditorFile } from '../code-editor/utils/previewableFile';
import SpreadsheetTablePreview from '../code-editor/view/subcomponents/SpreadsheetTablePreview';
import type { DocumentCanvasVariant } from '../document-canvas/types';
import SuperPreviewRoot from '../super-preview/SuperPreviewRoot';
import { shouldUseSuperPreview } from '../super-preview/superPreviewRouting';
import ProjectMarkdownPreview from './ProjectMarkdownPreview';
import ProgressiveProjectImage from './ProgressiveProjectImage';
import { supportsInlineSpreadsheetPreview } from './previewKindForExt';
import DeliverableQualityHintNotice from '../chat/deliverables/DeliverableQualityHintNotice';

const DocumentCanvasPreview = lazy(() => import('../document-canvas/DocumentCanvasPreview'));

export type ProjectFilePreviewProps = {
  projectName: string;
  apiPath: string;
  fileName: string;
  kind: DeliverableKind;
  previewUrl: string;
  projectRoot?: string;
  className?: string;
  documentCanvasVariant?: DocumentCanvasVariant;
  /** PD-SAAS-FORK: skip server resolve when path is already resolved (overlay pipeline) */
  skipResolve?: boolean;
  /** PD-SAAS-FORK: turn-scoped artifact directory for disambiguation */
  hintDir?: string;
  /** PD-SAAS-FORK: design canvas initial mode (sidebar only for edit) */
  designCanvasMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: HTML Studio initial mode (sidebar only for edit) */
  htmlStudioMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: HyperFrames Studio initial mode (sidebar only for edit) */
  hfStudioMode?: 'view' | 'edit';
  /** PD-SAAS-FORK: Bento deck initial mode (sidebar only for edit) */
  bentoStudioMode?: 'view' | 'edit';
  onEditDockRequest?: () => void;
  /** Unified sidebar preview chrome (download / export / window). */
  previewChromeActions?: ReactNode;
  /** Refresh + close — rendered last in preview chrome row. */
  previewChromeTrailing?: ReactNode;
  /** Shared document-canvas state across sidebar and overlay surfaces. */
  previewSessionKey?: string;
};

function DocumentPreviewSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    cells.push(current);
    return cells;
  });
}

function SpreadsheetPreviewLoader({
  projectName,
  apiPath,
  fileName,
}: {
  projectName: string;
  apiPath: string;
  fileName: string;
}) {
  const { t } = useTranslation('chat');
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    const isExcel = isXlsxFile(fileName) || fileName.toLowerCase().endsWith('.xls');
    const loadPromise = isExcel
      ? api.readFileBlob(projectName, apiPath)
        .then((res: Response) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) throw new Error('not a spreadsheet');
          return res.arrayBuffer();
        })
        .then((buffer) => {
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][];
        })
      : api.readFileBlob(projectName, apiPath)
        .then((res: Response) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) throw new Error('not a spreadsheet');
          return res.text();
        })
        .then((text) => parseCsvText(text));

    loadPromise
      .then((matrix) => {
        if (cancelled) return;
        const normalized = Array.isArray(matrix) ? matrix : [];
        setRows(normalized.filter((row) => row.some((cell) => String(cell).trim())));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiPath, fileName, projectName]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <div className="text-sm text-neutral-400">
          {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
        </div>
        <DeliverableQualityHintNotice filePath={fileName} previewFailed />
      </div>
    );
  }
  return <SpreadsheetTablePreview rows={rows} emptyLabel="空表格" />;
}

function ImagePreview({
  previewUrl,
  fileName,
  projectName,
  apiPath,
  projectRoot,
  hintDir,
  className,
}: {
  previewUrl: string;
  fileName: string;
  projectName: string;
  apiPath: string;
  projectRoot?: string;
  hintDir?: string;
  className: string;
}) {
  return (
    <ProgressiveProjectImage
      projectName={projectName}
      projectRoot={projectRoot}
      filePath={apiPath}
      hintDir={hintDir}
      fullMode="content"
      alt={fileName}
      className={`max-h-full max-w-full bg-transparent ${className}`}
      imageClassName="max-h-full max-w-full object-contain"
      loading="lazy"
    />
  );
}

function VideoPreview({
  previewUrl,
  fileName,
  projectName,
  apiPath,
  projectRoot,
  className,
}: {
  previewUrl: string;
  fileName: string;
  projectName: string;
  apiPath: string;
  projectRoot?: string;
  className: string;
}) {
  const src =
    projectName && apiPath
      ? api.fileContentUrl(projectName, apiPath, projectRoot || '')
      : previewUrl;

  return (
    <video
      src={src}
      controls
      playsInline
      preload="metadata"
      className={`max-h-full max-w-full bg-black ${className}`}
    >
      <track kind="captions" />
      {fileName}
    </video>
  );
}

export default function ProjectFilePreview({
  projectName,
  apiPath,
  fileName,
  kind,
  previewUrl,
  projectRoot,
  className = '',
  documentCanvasVariant = 'overlay',
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
}: ProjectFilePreviewProps) {
  const { t } = useTranslation('chat');
  const { resolvedApiPath, resolving } = useResolvedProjectApiPath(
    projectName,
    apiPath,
    projectRoot,
    { skipResolve, hintDir },
  );
  const fetchPath = resolvedApiPath || apiPath;
  const resolvedKind = resolvePreviewKind(fileName, kind);
  const lowerName = fileName.toLowerCase();
  const useSpreadsheet = useMemo(
    () => resolvedKind === 'spreadsheet' || supportsInlineSpreadsheetPreview(lowerName),
    [resolvedKind, lowerName],
  );
  const mediaClassName = className.includes('max-') ? className : `max-h-full max-w-full ${className}`.trim();

  if (resolving && projectName && apiPath) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className}`}>
        <DocumentPreviewSpinner />
      </div>
    );
  }

  if (projectName && fetchPath && shouldUseSuperPreview(fileName, resolvedKind)) {
    const superPreviewClassName = className.includes('h-full')
      ? className
      : `h-full w-full min-h-0 ${className}`.trim();
    return (
      <SuperPreviewRoot
        projectName={projectName}
        apiPath={fetchPath}
        fileName={fileName}
        kind={resolvedKind}
        previewUrl={previewUrl}
        projectRoot={projectRoot}
        className={superPreviewClassName}
        documentCanvasVariant={documentCanvasVariant}
        previewSurface={documentCanvasVariant === 'sidebar' ? 'sidebar' : 'overlay'}
        initialDesignCanvasMode={designCanvasMode}
        initialHtmlStudioMode={htmlStudioMode}
        initialHfStudioMode={hfStudioMode}
        initialBentoStudioMode={bentoStudioMode}
        hintDir={hintDir}
        onEditDockRequest={onEditDockRequest}
        previewChromeActions={previewChromeActions}
        previewChromeTrailing={previewChromeTrailing}
        previewSessionKey={previewSessionKey ?? `${projectName}::${fetchPath}::${fileName}`}
      />
    );
  }

  if (isMarkdownEditorFile(fileName) && projectName && (fetchPath || apiPath)) {
    return (
      <ProjectMarkdownPreview
        projectName={projectName}
        apiPath={fetchPath || apiPath}
        projectRoot={projectRoot}
        hintDir={hintDir}
        className={className}
      />
    );
  }

  if (useSpreadsheet && projectName && fetchPath) {
    return (
      <div className={`h-full min-h-0 w-full ${className}`}>
        <SpreadsheetPreviewLoader projectName={projectName} apiPath={fetchPath} fileName={fileName} />
      </div>
    );
  }

  if (resolvedKind === 'image' || isImageFile(fileName)) {
    return (
      <ImagePreview
        previewUrl={previewUrl}
        fileName={fileName}
        projectName={projectName}
        apiPath={fetchPath}
        projectRoot={projectRoot}
        hintDir={hintDir}
        className={mediaClassName}
      />
    );
  }

  if (resolvedKind === 'video' || isVideoFile(fileName)) {
    return (
      <VideoPreview
        previewUrl={previewUrl}
        fileName={fileName}
        projectName={projectName}
        apiPath={fetchPath}
        projectRoot={projectRoot}
        className={mediaClassName}
      />
    );
  }

  if (usesDocumentCanvas(fileName) && projectName && fetchPath) {
    return (
      <Suspense fallback={<DocumentPreviewSpinner />}>
        <DocumentCanvasPreview
          projectName={projectName}
          apiPath={fetchPath}
          fileName={fileName}
          variant={documentCanvasVariant}
          className={className}
          fallbackPreviewUrl={previewUrl}
          previewSessionKey={previewSessionKey ?? `${projectName}::${fetchPath}::${fileName}`}
        />
      </Suspense>
    );
  }

  if (resolvedKind === 'html' && previewUrl) {
    return (
      <iframe
        title={fileName}
        src={previewUrl}
        className={`h-full w-full border-0 bg-white ${className}`}
        sandbox="allow-scripts allow-same-origin allow-popups"
        loading="lazy"
      />
    );
  }

  if (requiresInAppPreviewRenderer(fileName, resolvedKind)) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center ${className}`.trim()}>
        <div className="text-sm text-muted-foreground">
          {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
        </div>
        <DeliverableQualityHintNotice filePath={fileName} previewFailed />
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center ${className}`.trim()}>
        <div className="text-sm text-muted-foreground">
          {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
        </div>
        <DeliverableQualityHintNotice filePath={fileName} previewFailed />
      </div>
    );
  }

  return (
    <iframe
      title={fileName}
      src={previewUrl}
      className={`h-full w-full border-0 bg-white ${className}`}
      loading="lazy"
    />
  );
}
