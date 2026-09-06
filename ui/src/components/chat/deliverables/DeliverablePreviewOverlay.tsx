// PD-SAAS-FORK: deliverable overlay uses shared preview pipeline and toolbar.
// Must stay in sync with sidebar preview (ProjectFilePreview + DocumentCanvas + previewUrl fallback).
import React, { useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { classifyDeliverablePath, getArtifactFileName } from '../../../shared/artifactPaths';
import { resolveEditorApiPath } from '../../code-editor/utils/resolveEditorApiPath';
import { isMarkdownEditorFile } from '../../code-editor/utils/previewableFile';
import {
  resolvePreviewKind,
  requiresInAppPreviewRenderer,
  supportsBrowserNewTabForFile,
  supportsOverlayPreview,
  supportsUnifiedFilePreview,
  usesDocumentCanvas,
} from '../../../shared/projectPreviewCapabilities';
import { resolveArtifactScope } from '../../../shared/artifactScope';
import { buildExportCapabilities } from '../../../shared/documentExportMatrix';
import { api } from '../../../utils/api';
import PreviewActionToolbar, { PreviewPaginationControls } from '../../shared/PreviewActionToolbar';
import DocumentExportActionBar from '../../shared/DocumentExportActionBar';
import { useResolvedProjectApiPath } from '../../../shared/hooks/useResolvedProjectApiPath';
import type { FileOpenOptions } from '../../code-editor/utils/fileOpen';
import { openDesignCanvasInSidebar } from '../../../shared/designCanvasDock';
import { openHtmlStudioInSidebar } from '../../../shared/htmlStudioDock';
import { openHfStudioInSidebar } from '../../../shared/hfStudioDock';
import { supportsHtmlStudioEditContract } from '../../../shared/htmlStudioSupport';
import { isHtmlStudioEnabled } from '../../../shared/htmlStudioGate';
import { isHfStudioEnabled } from '../../../shared/hfStudioGate';
import { supportsHyperframesStudioEditContract } from '../../../shared/hfStudioSupport';
import { isDesignCanvasEnabled } from '../../../shared/designCanvasGate';
import { supportsDesignCanvasEdit } from '../../../shared/designCanvasSupport';
import { resolveEditAdapter } from '../../../shared/resolveEditAdapter';
import type { ArtifactContract } from '../../../shared/artifactContract';

import { resolveProjectInlineMediaUrl } from '../../../shared/projectInlineMediaUrl';
import { shouldUseSuperPreview } from '../../super-preview/superPreviewRouting';
import { PreviewChromeBar } from '../../super-preview/PreviewChromeBar';
import UnifiedPreviewHost from '../../shared/UnifiedPreviewHost';
import { buildPreviewChromeActions, buildPreviewChromeTrailing, buildPreviewSessionKey, buildSidebarDocumentPreviewChrome } from '../../shared/buildPreviewChromeActions';

type DeliverablePreviewOverlayProps = {
  items: DeliverableItem[];
  index: number;
  onIndexChange: (index: number) => void;
  selectedProject?: Project | null;
  onFileOpen?: (filePath: string, options?: FileOpenOptions | null) => void;
  onClose: () => void;
};

function previewUrlFor(
  project: Project | null | undefined,
  apiPath: string,
  projectRoot: string,
  fileName: string,
  kind: ReturnType<typeof classifyDeliverablePath>,
): string {
  if (!project?.name || !apiPath) return '';
  return resolveProjectInlineMediaUrl(project.name, apiPath, fileName, projectRoot, kind);
}

export function DeliverablePreviewOverlay({
  items,
  index,
  onIndexChange,
  selectedProject,
  onFileOpen,
  onClose,
}: DeliverablePreviewOverlayProps) {
  const { t } = useTranslation('chat');

  const safeIndex = useMemo(() => {
    if (items.length === 0) return 0;
    if (index < 0) return 0;
    if (index >= items.length) return items.length - 1;
    return index;
  }, [index, items.length]);

  const active = items[safeIndex];
  const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
  const isExternal = active?.kind === 'url';
  const rawApiPath = active?.resolvedPath || active?.apiPath || active?.path || '';
  const turnHintDir = active?.turnArtifactDir;
  const { resolvedApiPath, resolving } = useResolvedProjectApiPath(
    selectedProject?.name,
    isExternal ? undefined : rawApiPath,
    projectRoot,
    { hintDir: turnHintDir },
  );
  const apiPath = isExternal ? rawApiPath : (resolvedApiPath || rawApiPath);
  /** Overlay already resolved — never re-resolve inside ProjectFilePreview (avoids spinner flash). */
  const skipInnerResolve = Boolean(!isExternal && selectedProject?.name && apiPath && !resolving);
  const fileName = isExternal
    ? (active?.path || '').replace(/^https?:\/\//i, '').slice(0, 64)
    : getArtifactFileName(apiPath);
  const exportSourcePath = useMemo(
    () => (apiPath && !isExternal ? resolveEditorApiPath(apiPath, projectRoot) : ''),
    [apiPath, isExternal, projectRoot],
  );
  const siblingPaths = useMemo(
    () => items
      .map((item) => item.apiPath || item.path || '')
      .filter((path): path is string => Boolean(path) && !/^https?:\/\//i.test(path)),
    [items],
  );
  const artifactScope = useMemo(
    () => (exportSourcePath ? resolveArtifactScope({ activePath: exportSourcePath, siblings: siblingPaths }) : null),
    [exportSourcePath, siblingPaths],
  );
  const showExport = useMemo(() => {
    if (isExternal || !exportSourcePath) return false;
    const kind = classifyDeliverablePath(fileName);
    if (artifactScope && buildExportCapabilities({
      scopeId: artifactScope.carrierScope,
      bundle: artifactScope.canBundleExport,
      bundleImagePaths: artifactScope.bundleImagePaths,
      pageCount: artifactScope.pageCount,
      bundleDir: artifactScope.scopeRoot || undefined,
    }, artifactScope.exportSourcePath).length > 0) {
      return true;
    }
    return (
      kind === 'document' ||
      kind === 'html' ||
      kind === 'pdf' ||
      kind === 'spreadsheet' ||
      kind === 'presentation'
    );
  }, [artifactScope, exportSourcePath, fileName, isExternal]);

  const previewUrl = useMemo(() => {
    if (isExternal) return active?.path || '';
    const kind = resolvePreviewKind(fileName, active?.kind);
    return previewUrlFor(selectedProject, apiPath, projectRoot, fileName, kind);
  }, [active?.kind, active?.path, apiPath, fileName, isExternal, projectRoot, selectedProject]);

  const downloadUrl = useMemo(() => {
    if (isExternal || !selectedProject?.name || !apiPath) return null;
    return api.fileDownloadUrl(selectedProject.name, apiPath);
  }, [apiPath, isExternal, selectedProject?.name]);

  const showPrev = useCallback(() => {
    if (items.length <= 1) return;
    onIndexChange(safeIndex <= 0 ? items.length - 1 : safeIndex - 1);
  }, [items.length, onIndexChange, safeIndex]);

  const showNext = useCallback(() => {
    if (items.length <= 1) return;
    onIndexChange(safeIndex >= items.length - 1 ? 0 : safeIndex + 1);
  }, [items.length, onIndexChange, safeIndex]);

  const documentCanvasActive = usesDocumentCanvas(fileName);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (documentCanvasActive || items.length <= 1) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [documentCanvasActive, items.length, onClose, showNext, showPrev]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleOpenInPanel = useCallback(() => {
    if (!onFileOpen || isExternal || !apiPath) return;
    const name = getArtifactFileName(apiPath);
    onFileOpen(
      apiPath,
      supportsUnifiedFilePreview(name, active?.kind) ? { initialPreview: true } : undefined,
    );
    onClose();
  }, [active?.kind, apiPath, isExternal, onClose, onFileOpen]);

  const handleEditInCanvas = useCallback(() => {
    if (!onFileOpen || isExternal || !apiPath) return;
    const name = getArtifactFileName(apiPath);
    const opened = openDesignCanvasInSidebar(onFileOpen, apiPath, name, {
      hintDir: turnHintDir,
      designCanvasMode: 'edit',
    });
    if (opened) onClose();
  }, [apiPath, isExternal, onClose, onFileOpen, turnHintDir]);

  const handleEditDock = useCallback(() => {
    if (!onFileOpen || isExternal || !apiPath) return;
    const name = getArtifactFileName(apiPath);
    const contractStub = {
      carrierScope: artifactScope?.carrierScope ?? 'report_html',
      pages: [],
    } as ArtifactContract;
    const surface = resolveEditAdapter({
      contract: contractStub,
      fileName: name,
      apiPath,
      siblings: siblingPaths,
    });
    if (surface === 'hyperframesStudio') {
      const opened = openHfStudioInSidebar(onFileOpen, apiPath, name, siblingPaths, {
        hintDir: turnHintDir,
        hfStudioMode: 'edit',
      });
      if (opened) onClose();
      return;
    }
    if (surface === 'htmlStudio') {
      const opened = openHtmlStudioInSidebar(onFileOpen, apiPath, name, 0, {
        hintDir: turnHintDir,
        htmlStudioMode: 'edit',
      });
      if (opened) onClose();
      return;
    }
    handleEditInCanvas();
  }, [apiPath, artifactScope?.carrierScope, handleEditInCanvas, isExternal, onClose, onFileOpen, siblingPaths, turnHintDir]);

  const showDesignCanvasDock =
    isDesignCanvasEnabled() && supportsDesignCanvasEdit(fileName, apiPath) && Boolean(onFileOpen && !isExternal);

  const showHtmlStudioDock =
    isHtmlStudioEnabled()
    && supportsHtmlStudioEditContract(
      { carrierScope: artifactScope?.carrierScope ?? 'report_html', pages: [] } as ArtifactContract,
      fileName,
      apiPath,
    )
    && Boolean(onFileOpen && !isExternal);

  const showHfStudioDock =
    isHfStudioEnabled()
    && supportsHyperframesStudioEditContract(
      { carrierScope: artifactScope?.carrierScope ?? 'hyperframes_project', pages: [] } as ArtifactContract,
      fileName,
      apiPath,
      siblingPaths,
    )
    && Boolean(onFileOpen && !isExternal);

  const showEditDock = showDesignCanvasDock || showHtmlStudioDock || showHfStudioDock;

  const resolvedKind = resolvePreviewKind(fileName, active?.kind);
  const canPreview = isExternal || supportsOverlayPreview(fileName, active?.kind);

  const useSuperPreviewChrome = useMemo(() => {
    if (isExternal || !selectedProject?.name || !apiPath || resolving) return false;
    return shouldUseSuperPreview(fileName, resolvedKind);
  }, [apiPath, fileName, isExternal, resolvedKind, resolving, selectedProject?.name]);

  const exportActionsEl = useMemo(() => {
    if (!showExport || !selectedProject?.name) return null;
    return (
      <DocumentExportActionBar
        variant="editor"
        projectName={selectedProject.name}
        sourcePath={exportSourcePath}
        projectRoot={projectRoot}
      />
    );
  }, [exportSourcePath, projectRoot, selectedProject?.name, showExport]);

  const previewChromeActions = useMemo(() => {
    if (!useSuperPreviewChrome) return null;
    if (documentCanvasActive) {
      return buildSidebarDocumentPreviewChrome({
        fileName,
        kind: active?.kind,
        previewUrl,
        downloadUrl,
        showDownload: !isExternal,
        exportActions: exportActionsEl,
      });
    }
    return buildPreviewChromeActions({
      fileName,
      kind: active?.kind,
      previewUrl,
      downloadUrl,
      showOpenInPanel: Boolean(onFileOpen && !isExternal),
      showDownload: !isExternal,
      onOpenInPanel: handleOpenInPanel,
      exportActions: exportActionsEl,
      markdownShare: !isExternal && selectedProject?.name && isMarkdownEditorFile(fileName)
        ? {
            projectName: selectedProject.name,
            apiPath,
            hintDir: turnHintDir,
            fileName,
          }
        : null,
      pagination: items.length > 1
        ? { index: safeIndex, total: items.length, onPrev: showPrev, onNext: showNext }
        : undefined,
    });
  }, [
    active?.kind,
    documentCanvasActive,
    downloadUrl,
    exportActionsEl,
    fileName,
    handleOpenInPanel,
    isExternal,
    items.length,
    onFileOpen,
    previewUrl,
    safeIndex,
    showNext,
    showPrev,
    apiPath,
    selectedProject?.name,
    turnHintDir,
    useSuperPreviewChrome,
  ]);

  const previewChromeTrailing = useMemo(() => {
    if (!useSuperPreviewChrome) return null;
    return buildPreviewChromeTrailing(onClose, t('deliverables.closePreview', { defaultValue: '关闭预览' }));
  }, [onClose, t, useSuperPreviewChrome]);

  const renderFallbackChrome = () => (
    <PreviewChromeBar
      title={fileName}
      pinnedTrailing={buildPreviewChromeTrailing(onClose, t('deliverables.closePreview', { defaultValue: '关闭预览' }))}
    >
      <PreviewActionToolbar
        variant="editor"
        previewUrl={previewUrl}
        downloadUrl={downloadUrl}
        showOpenInPanel={Boolean(onFileOpen && !isExternal)}
        showRevealFolder={false}
        showDownload={!isExternal}
        showNewTab={supportsBrowserNewTabForFile(fileName, active?.kind) && Boolean(previewUrl)}
        showClose={false}
        onOpenInPanel={handleOpenInPanel}
        onClose={onClose}
        exportActions={exportActionsEl}
        markdownShare={!isExternal && selectedProject?.name && isMarkdownEditorFile(fileName)
          ? {
              projectName: selectedProject.name,
              apiPath,
              hintDir: turnHintDir,
              fileName,
            }
          : null}
        pagination={
          items.length > 1
            ? { index: safeIndex, total: items.length, onPrev: showPrev, onNext: showNext }
            : undefined
        }
      />
    </PreviewChromeBar>
  );

  if (typeof document === 'undefined') return null;
  if (!active) return null;

  const renderBody = () => {
    if (isExternal && previewUrl) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          {renderFallbackChrome()}
          <iframe
            key={previewUrl}
            title="deliverable-preview-frame"
            src={previewUrl}
            className="min-h-0 flex-1 border-0 bg-card"
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
          />
        </div>
      );
    }
    if (!canPreview) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          {renderFallbackChrome()}
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
          </div>
        </div>
      );
    }
    if (selectedProject?.name && apiPath) {
      if (useSuperPreviewChrome) {
        return (
          <UnifiedPreviewHost
            surface="overlay"
            projectName={selectedProject.name}
            apiPath={apiPath}
            fileName={fileName}
            kind={resolvedKind}
            previewUrl={previewUrl}
            projectRoot={projectRoot}
            skipResolve={skipInnerResolve}
            hintDir={turnHintDir}
            resolving={resolving}
            onEditDockRequest={showEditDock ? handleEditDock : undefined}
            previewChromeActions={previewChromeActions}
            previewChromeTrailing={previewChromeTrailing}
            previewSessionKey={
              selectedProject?.name && apiPath
                ? buildPreviewSessionKey(selectedProject.name, apiPath, fileName)
                : undefined
            }
          />
        );
      }
      return (
        <div className="flex h-full min-h-0 flex-col">
          {renderFallbackChrome()}
          <div className="min-h-0 flex-1">
            {resolving ? (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
              </div>
            ) : (
              <UnifiedPreviewHost
                surface="overlay"
                projectName={selectedProject.name}
                apiPath={apiPath}
                fileName={fileName}
                kind={resolvedKind}
                previewUrl={previewUrl}
                projectRoot={projectRoot}
                className="h-full w-full min-h-0"
                skipResolve={skipInnerResolve}
                hintDir={turnHintDir}
                onEditDockRequest={showEditDock ? handleEditDock : undefined}
                previewSessionKey={
                  selectedProject?.name && apiPath
                    ? buildPreviewSessionKey(selectedProject.name, apiPath, fileName)
                    : undefined
                }
              />
            )}
          </div>
        </div>
      );
    }
    if (!previewUrl) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          {renderFallbackChrome()}
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
          </div>
        </div>
      );
    }
    if (requiresInAppPreviewRenderer(fileName, resolvedKind)) {
      return (
        <div className="flex h-full min-h-0 flex-col">
          {renderFallbackChrome()}
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('deliverables.previewUnavailable', { defaultValue: '该文件暂不支持内联预览，请用「在右栏打开」或「打开文件夹」查看。' })}
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-0 flex-col">
        {renderFallbackChrome()}
        <iframe
          key={previewUrl}
          title="deliverable-preview-frame"
          src={previewUrl}
          className="min-h-0 flex-1 border-0 bg-card"
          sandbox="allow-scripts allow-same-origin allow-popups"
          loading="lazy"
        />
      </div>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
      data-testid="deliverable-preview-overlay"
      className="fixed inset-0 z-[2147483647] flex flex-col bg-black/85 p-0 backdrop-blur-sm max-md:pb-safe-area-inset-bottom max-md:pt-safe-area-inset-top sm:p-5"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none border border-border bg-neutral-950 shadow-2xl max-md:border-0 sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderBody()}

          {items.length > 1 && !documentCanvasActive ? (
            <PreviewPaginationControls
              onPrev={showPrev}
              onNext={showNext}
              prevLabel={t('deliverables.prev', { defaultValue: '上一项' })}
              nextLabel={t('deliverables.next', { defaultValue: '下一项' })}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default DeliverablePreviewOverlay;
