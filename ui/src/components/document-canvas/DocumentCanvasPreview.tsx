// PD-SAAS-FORK: lazy-loaded document canvas entry
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createDocumentAdapter } from './adapters/createDocumentAdapter';
import DocumentCanvasShell from './DocumentCanvasShell';
import { useDocumentBlob } from './hooks/useDocumentBlob';
import type { DocumentCanvasVariant } from './types';
import { getDocumentCanvasFormat } from './utils/documentPreviewRouting';

export type DocumentCanvasPreviewProps = {
  projectName: string;
  apiPath: string;
  fileName: string;
  variant?: DocumentCanvasVariant;
  className?: string;
  /** Browser-native preview URL when pdf.js / office canvas fails (same as「新标签」). */
  fallbackPreviewUrl?: string;
  /** Extra icon actions appended on the unified toolbar row (reference, export, window). */
  toolbarTrailing?: ReactNode;
  /** Close — always pinned on the right edge of the toolbar row. */
  toolbarPinnedTrailing?: ReactNode;
  /** Sidebar unified chrome: show filename on the document toolbar row. */
  toolbarTitle?: string;
  previewSessionKey?: string;
};

function PreviewSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

export default function DocumentCanvasPreview({
  projectName,
  apiPath,
  fileName,
  variant = 'overlay',
  className = '',
  fallbackPreviewUrl = '',
  toolbarTrailing,
  toolbarPinnedTrailing,
  toolbarTitle,
  previewSessionKey,
}: DocumentCanvasPreviewProps) {
  const { t } = useTranslation('common');
  const format = useMemo(() => getDocumentCanvasFormat(fileName), [fileName]);
  const { buffer, loading, error, largeFileHint } = useDocumentBlob(projectName, apiPath, Boolean(format));
  const [adapter, setAdapter] = useState<ReturnType<typeof createDocumentAdapter> | null>(null);
  const [adapterError, setAdapterError] = useState(false);
  const allowIframeFallback = format === 'pdf' && Boolean(fallbackPreviewUrl);

  useEffect(() => {
    if (!format || !buffer) {
      setAdapter(null);
      return undefined;
    }
    let cancelled = false;
    const nextAdapter = createDocumentAdapter(format);
    setAdapter(null);
    setAdapterError(false);
    nextAdapter.load(buffer)
      .then(() => {
        if (!cancelled) setAdapter(nextAdapter);
      })
      .catch(() => {
        if (!cancelled) setAdapterError(true);
      });
    return () => {
      cancelled = true;
      nextAdapter.destroy();
    };
  }, [buffer, format]);

  if (!format) {
    return (
      <div className={`flex h-full items-center justify-center text-sm text-muted-foreground ${className}`}>
        {t('documentCanvas.unsupported', { defaultValue: '该格式暂不支持文档预览' })}
      </div>
    );
  }

  if (loading || (!adapter && !adapterError && !error)) {
    return (
      <div className={className}>
        <PreviewSpinner />
      </div>
    );
  }

  if (error || adapterError || !adapter || adapter.pageCount <= 0) {
    if (allowIframeFallback) {
      return (
        <iframe
          title={fileName}
          src={fallbackPreviewUrl}
          className={`h-full w-full border-0 bg-white ${className}`}
        />
      );
    }
    return (
      <div className={`flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground ${className}`}>
        {t('documentCanvas.loadFailed', { defaultValue: '预览加载失败，请下载后查看。' })}
      </div>
    );
  }

  return (
    <div className={`h-full w-full min-h-0 ${className}`}>
      <DocumentCanvasShell
        adapter={adapter}
        variant={variant}
        largeFileHint={largeFileHint}
        fallbackPreviewUrl={allowIframeFallback ? fallbackPreviewUrl : ''}
        toolbarTrailing={toolbarTrailing}
        toolbarPinnedTrailing={toolbarPinnedTrailing}
        toolbarTitle={toolbarTitle}
        previewSessionKey={previewSessionKey}
      />
    </div>
  );
}
