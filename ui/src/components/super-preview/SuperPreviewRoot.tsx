import { useEffect, useMemo, useState, Suspense, useCallback, lazy, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { ArtifactPage } from '../../shared/artifactContract';
import { cn } from '../../lib/utils';
import { api } from '../../utils/api';
import {
  isAudioFile,
  isDocxFile,
  isImageFile,
  isPdfFile,
  isPptxFile,
  isVideoFile,
} from '../code-editor/utils/binaryFile';
import {
  isMarkdownEditorFile,
  isTextPreviewFile,
} from '../code-editor/utils/previewableFile';
import { supportsInlineSpreadsheetPreview } from '../shared/previewKindForExt';
import ProjectMarkdownPreview from '../shared/ProjectMarkdownPreview';
import ProgressiveProjectImage from '../shared/ProgressiveProjectImage';
import LazyVisibleProjectImage from '../shared/LazyVisibleProjectImage';
import DocumentCanvasPreview from '../document-canvas/DocumentCanvasPreview';
import CollectionPreviewAdapter from './adapters/collection/CollectionPreviewAdapter';
import FallbackPreviewAdapter from './adapters/fallback/FallbackPreviewAdapter';
import ImagePreviewAdapter from './adapters/image/ImagePreviewAdapter';
import TextPreviewAdapter from './adapters/markdownText/TextPreviewAdapter';
import CodePreviewAdapter from './adapters/code/CodePreviewAdapter';
import MediaPreviewAdapter from './adapters/media/MediaPreviewAdapter';
import SpreadsheetPreviewAdapter from './adapters/spreadsheet/SpreadsheetPreviewAdapter';
import WebPreviewEmbedded from './adapters/web/WebPreviewEmbedded';
import SuperPreviewShell from './SuperPreviewShell';
import { PreviewChromeBar, PreviewChromeDivider, PreviewChromeGroup, PreviewChromeIconButton } from './PreviewChromeBar';
import SuperPreviewReferenceButton from './SuperPreviewReferenceButton';
import { useSuperPreviewContext } from './hooks/useSuperPreviewContext';
import { extension, isCodePreviewFile, isHtmlPreviewFile } from './superPreviewRouting';
import type { SuperPreviewRootProps } from './types';
import type { SuperPreviewMode } from './SuperPreviewModeToggle';
import { isDesignCanvasEnabled, subscribeDesignCanvasEnabled } from '../../shared/designCanvasGate';
import {
  canEnterDesignCanvasEditMode,
  supportsDesignCanvasEditContract,
} from '../../shared/designCanvasSupport';
import {
  isMobilePreviewSurface,
  supportsHtmlStudioEditContract,
} from '../../shared/htmlStudioSupport';
import { isHtmlStudioEnabled, subscribeHtmlStudioEnabled } from '../../shared/htmlStudioGate';
import {
  supportsHyperframesStudioEditContract,
  supportsHyperframesStudioView,
} from '../../shared/hfStudioSupport';
import { isHfStudioEnabled, subscribeHfStudioEnabled } from '../../shared/hfStudioGate';
import { resolveEditAdapter, canEnterEditModeForAdapter } from '../../shared/resolveEditAdapter';
import DesignCanvasAdapter from './adapters/designCanvas';
import HtmlStudioAdapter from './adapters/htmlStudio';
import BentoDeckAdapter from './adapters/bentoDeck/BentoDeckAdapter';
import { isBentoDeckEnabled, subscribeBentoDeckEnabled } from '../../shared/bentoStudioGate';
import {
  supportsBentoDeckEditContract,
} from '../../shared/bentoStudioSupport';

const HyperframesStudioAdapter = lazy(() => import('./adapters/hyperframesStudio'));

function LoadingSurface() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

function PptDeckWorkbench({
  projectName,
  projectRoot,
  contract,
  activePath,
  toolbarTrailing,
  toolbarPinnedTrailing,
  toolbarTitle,
}: {
  projectName: string;
  projectRoot?: string;
  contract: ReturnType<typeof useSuperPreviewContext>['contract'];
  activePath: string;
  toolbarTrailing?: ReactNode;
  toolbarPinnedTrailing?: ReactNode;
  toolbarTitle?: string;
}) {
  const [pages, setPages] = useState<ArtifactPage[]>(() => contract.pages);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [index, setIndex] = useState(0);
  const manifestPath = contract.sourcePaths.find((path) => /(?:^|\/)slide-manifest\.json$/i.test(path));
  const previewPages = pages.filter((page) => page.previewPath);
  const active = pages[index] ?? previewPages[0];
  const src = active?.previewPath
    ? api.fileContentUrl(projectName, active.previewPath, projectRoot || '')
    : '';

  useEffect(() => {
    setPages(contract.pages);
    const activeIndex = contract.pages.findIndex((page) => page.previewPath === activePath);
    setIndex(activeIndex >= 0 ? activeIndex : 0);
  }, [activePath, contract]);

  const persistPages = async (nextPages: ArtifactPage[]) => {
    setPages(nextPages);
    setSaveError(false);
    if (!manifestPath) return;
    setSaving(true);
    try {
      const manifest = {
        skill_version: 'super-preview',
        deck_title: contract.title,
        idea_prompt: contract.title,
        preset_id: null,
        template_style: contract.exportHints.aspectRatio ?? '16:9',
        aspect_ratio: contract.exportHints.aspectRatio ?? '16:9',
        language: 'zh-CN',
        detail_level: 'default',
        page_count: nextPages.length,
        generated_at: new Date().toISOString(),
        pages: nextPages.map((page, pageIndex) => ({
          page_index: pageIndex + 1,
          title: page.title ?? '新页面',
          points: page.points,
          page_description: page.description ?? page.title ?? '新页面',
          image_path: page.previewPath,
          status: page.status === 'failed' ? 'failed' : page.previewPath ? 'completed' : 'pending',
          error: page.error,
        })),
      };
      const response = await api.saveFile(projectName, manifestPath, JSON.stringify(manifest, null, 2));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const updateActive = (patch: Partial<ArtifactPage>) => {
    if (!active) return;
    const nextPages = pages.map((page) => (page.pageId === active.pageId ? { ...page, ...patch } : page));
    void persistPages(nextPages);
  };

  const moveActive = (direction: -1 | 1) => {
    const current = pages.findIndex((page) => page.pageId === active?.pageId);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= pages.length) return;
    const nextPages = [...pages];
    const currentPage = nextPages[current];
    const targetPage = nextPages[target];
    if (!currentPage || !targetPage) return;
    nextPages[current] = { ...targetPage, index: current + 1 };
    nextPages[target] = { ...currentPage, index: target + 1 };
    setIndex(target);
    void persistPages(nextPages);
  };

  const deleteActive = () => {
    if (!active || pages.length <= 1) return;
    const nextPages = pages
      .filter((page) => page.pageId !== active.pageId)
      .map((page, pageIndex) => ({ ...page, index: pageIndex + 1 }));
    setIndex(Math.max(0, index - 1));
    void persistPages(nextPages);
  };

  const insertAfterActive = () => {
    const insertAt = Math.min(index + 1, pages.length);
    const newPage: ArtifactPage = {
      pageId: `page-${Date.now()}`,
      index: insertAt + 1,
      title: '新页面',
      points: [],
      description: '新页面',
      status: 'pending',
    };
    const nextPages = [
      ...pages.slice(0, insertAt),
      newPage,
      ...pages.slice(insertAt),
    ].map((page, pageIndex) => ({ ...page, index: pageIndex + 1 }));
    setIndex(insertAt);
    void persistPages(nextPages);
  };

  if (!active) {
    return <FallbackPreviewAdapter message="该 PPT 暂无可展示的页面图，已保留下载与导出入口。" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PreviewChromeBar
        title={toolbarTitle ?? contract.title}
        pinnedTrailing={toolbarPinnedTrailing}
      >
        <PreviewChromeGroup aria-label="幻灯片编辑">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            disabled={index <= 0}
            onClick={() => moveActive(-1)}
          >
            上移
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            disabled={index >= pages.length - 1}
            onClick={() => moveActive(1)}
          >
            下移
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={insertAfterActive}
          >
            插入
          </button>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            disabled={pages.length <= 1}
            onClick={deleteActive}
          >
            删除
          </button>
        </PreviewChromeGroup>
        <PreviewChromeDivider />
        <PreviewChromeGroup aria-label="页码">
          <PreviewChromeIconButton
            title="上一页"
            aria-label="上一页"
            disabled={index <= 0}
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </PreviewChromeIconButton>
          <span className="min-w-[3.25rem] shrink-0 text-center text-xs tabular-nums text-foreground">
            {index + 1} / {pages.length}
          </span>
          <PreviewChromeIconButton
            title="下一页"
            aria-label="下一页"
            disabled={index >= pages.length - 1}
            onClick={() => setIndex((current) => Math.min(pages.length - 1, current + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </PreviewChromeIconButton>
        </PreviewChromeGroup>
        {saving || saveError || manifestPath ? (
          <>
            <PreviewChromeDivider />
            <span className="shrink-0 px-1 text-[10px] text-muted-foreground">
              {saving ? '保存中…' : saveError ? '保存失败' : manifestPath ? '已连接 manifest' : null}
            </span>
          </>
        ) : null}
        {toolbarTrailing ? (
          <>
            <PreviewChromeDivider />
            {toolbarTrailing}
          </>
        ) : null}
      </PreviewChromeBar>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(8rem,14rem)_1fr]">
      <div className="min-h-0 overflow-auto border-r border-border p-2">
        {pages.map((page, pageIndex) => (
          <button
            key={page.pageId}
            type="button"
            className={cn(
              'mb-2 block w-full rounded-lg border bg-card p-1 text-left transition hover:border-primary/50',
              pageIndex === index ? 'border-primary/60' : 'border-border',
            )}
            onClick={() => setIndex(pageIndex)}
          >
            {page.previewPath ? (
              <LazyVisibleProjectImage
                projectName={projectName}
                projectRoot={projectRoot}
                filePath={page.previewPath}
                alt={page.title ?? `第 ${page.index} 页`}
                className="aspect-video w-full rounded"
                imageClassName="h-full w-full object-cover"
                thumbnailMax={240}
                preloadFull={false}
                forceVisible={pageIndex === index}
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">
                待生成
              </div>
            )}
            <div className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
              {page.index}. {page.title || '未命名页面'}
            </div>
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="shrink-0 border-b border-border px-3 py-2">
          <input
            value={active.title ?? ''}
            onChange={(event) => updateActive({ title: event.target.value })}
            className="h-7 w-full rounded-md border border-transparent bg-transparent px-1 text-sm font-medium outline-none hover:border-border focus:border-primary/50"
            placeholder="页面标题"
          />
          <input
            value={active.description ?? ''}
            onChange={(event) => updateActive({ description: event.target.value })}
            className="h-6 w-full rounded-md border border-transparent bg-transparent px-1 text-xs text-muted-foreground outline-none hover:border-border focus:border-primary/50"
            placeholder="页面描述"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-neutral-950 p-4">
          {src ? (
            <ProgressiveProjectImage
              projectName={projectName}
              projectRoot={projectRoot}
              filePath={active.previewPath}
              fullMode="content"
              alt={active.title ?? contract.title}
              className="mx-auto max-h-full max-w-full rounded bg-transparent shadow-2xl"
              imageClassName="max-h-full max-w-full"
              thumbnailMax={640}
              loading="eager"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              当前页尚未生成配图
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function SuperPreviewRoot({
  projectName,
  apiPath,
  fileName,
  kind,
  previewUrl,
  projectRoot,
  className = '',
  documentCanvasVariant = 'overlay',
  previewSurface,
  initialDesignCanvasMode = 'view',
  initialHtmlStudioMode = 'view',
  initialHfStudioMode = 'view',
  initialBentoStudioMode = 'edit',
  hintDir,
  onEditDockRequest,
  previewChromeActions,
  previewChromeTrailing,
  previewSessionKey,
}: SuperPreviewRootProps) {
  const { t } = useTranslation('chat');
  const context = useSuperPreviewContext({ projectName, apiPath, fileName, projectRoot });
  const requestedSurface = previewSurface ?? (documentCanvasVariant === 'sidebar' ? 'sidebar' : 'overlay');
  const useUnifiedChrome = Boolean(previewChromeActions);
  const isDocumentCanvasPreview =
    isPdfFile(fileName) || isDocxFile(fileName) || isPptxFile(fileName);
  // PD-SAAS-FORK: PDF/Office 弹窗/detached 用 sidebar 文档 chrome，但 previewSurface 仍区分右栏 vs 弹层（编辑 Dock）
  const documentCanvasVariantEffective =
    useUnifiedChrome && isDocumentCanvasPreview ? 'sidebar' : documentCanvasVariant;
  const compact = documentCanvasVariantEffective === 'sidebar';
  const embedInUnifiedChrome = useUnifiedChrome;
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [refreshAction, setRefreshAction] = useState<ReactNode>(null);
  const [designCanvasGateOn, setDesignCanvasGateOn] = useState(() => isDesignCanvasEnabled());
  const [htmlStudioGateOn, setHtmlStudioGateOn] = useState(() => isHtmlStudioEnabled());
  const [hfStudioGateOn, setHfStudioGateOn] = useState(() => isHfStudioEnabled());
  const [bentoDeckGateOn, setBentoDeckGateOn] = useState(() => isBentoDeckEnabled());
  useEffect(() => subscribeDesignCanvasEnabled(() => setDesignCanvasGateOn(isDesignCanvasEnabled())), []);
  useEffect(() => subscribeHtmlStudioEnabled(() => setHtmlStudioGateOn(isHtmlStudioEnabled())), []);
  useEffect(() => subscribeHfStudioEnabled(() => setHfStudioGateOn(isHfStudioEnabled())), []);
  useEffect(() => subscribeBentoDeckEnabled(() => setBentoDeckGateOn(isBentoDeckEnabled())), []);

  const editSurface = useMemo(
    () => resolveEditAdapter({
      contract: context.contract,
      fileName,
      apiPath,
      siblings: context.siblings,
    }),
    [apiPath, context.contract, context.siblings, fileName],
  );

  const initialMode: SuperPreviewMode =
    editSurface === 'bentoDeck' && initialBentoStudioMode === 'edit'
      ? 'edit'
      : editSurface === 'hyperframesStudio' && initialHfStudioMode === 'edit'
      ? 'edit'
      : editSurface === 'htmlStudio' && initialHtmlStudioMode === 'edit'
        ? 'edit'
        : editSurface === 'designCanvas' && initialDesignCanvasMode === 'edit'
          ? 'edit'
          : 'view';

  const [previewMode, setPreviewMode] = useState<SuperPreviewMode>(initialMode);
  const [htmlStudioDirty, setHtmlStudioDirty] = useState(false);
  const [hfStudioDirty, setHfStudioDirty] = useState(false);
  const [bentoDeckDirty, setBentoDeckDirty] = useState(false);
  const [bentoWebFallback, setBentoWebFallback] = useState(false);
  useEffect(() => {
    setPreviewMode(initialMode);
  }, [apiPath, initialMode]);
  useEffect(() => {
    setHtmlStudioDirty(false);
    setHfStudioDirty(false);
    setBentoDeckDirty(false);
    setBentoWebFallback(false);
  }, [apiPath]);
  useEffect(() => {
    if (bentoWebFallback && previewMode === 'edit') {
      setPreviewMode('view');
    }
  }, [bentoWebFallback, previewMode]);

  const canToggleCanvas =
    designCanvasGateOn &&
    editSurface === 'designCanvas' &&
    supportsDesignCanvasEditContract(context.contract, fileName);
  const canToggleBentoDeck =
    bentoDeckGateOn &&
    editSurface === 'bentoDeck' &&
    supportsBentoDeckEditContract(context.contract, fileName, apiPath) &&
    !bentoWebFallback;
  const canToggleHtmlStudio =
    htmlStudioGateOn &&
    editSurface === 'htmlStudio' &&
    supportsHtmlStudioEditContract(context.contract, fileName, apiPath);
  const canToggleHfStudio =
    hfStudioGateOn &&
    editSurface === 'hyperframesStudio' &&
    supportsHyperframesStudioEditContract(context.contract, fileName, apiPath, context.siblings);
  const canEditInline = canEnterEditModeForAdapter(editSurface, requestedSurface);
  const editDisabled = !canEditInline && !onEditDockRequest;
  const useDesignCanvas = previewMode === 'edit' && canToggleCanvas && canEditInline;
  const useBentoStudio =
    bentoDeckGateOn &&
    editSurface === 'bentoDeck' &&
    supportsBentoDeckEditContract(context.contract, fileName, apiPath);
  const wantsBentoEdit =
    initialBentoStudioMode === 'edit'
    && useBentoStudio
    && canEditInline;
  const useBentoDeck = (previewMode === 'edit' || wantsBentoEdit) && useBentoStudio && canEditInline;
  const useHtmlStudio = previewMode === 'edit' && canToggleHtmlStudio && canEditInline;
  const useHyperframesStudio = previewMode === 'edit' && canToggleHfStudio && canEditInline;
  const useHfView =
    editSurface === 'hyperframesStudio'
    && supportsHyperframesStudioView(fileName, apiPath, context.siblings)
    && !useHyperframesStudio;

  const handlePreviewModeChange = useCallback((mode: SuperPreviewMode) => {
    if (mode === 'edit' && !canEditInline) {
      if (onEditDockRequest) {
        onEditDockRequest();
        return;
      }
      return;
    }
    if (
      mode === 'view' &&
      previewMode === 'edit' &&
      ((htmlStudioDirty && useHtmlStudio) || (hfStudioDirty && useHyperframesStudio) || (bentoDeckDirty && useBentoDeck))
    ) {
      const confirmed = window.confirm(
        t(
          useHyperframesStudio ? 'hfStudio.unsavedConfirm' : useBentoDeck ? 'bentoDeck.unsavedConfirm' : 'htmlStudio.unsavedConfirm',
          { defaultValue: '有未保存的修改，确定放弃吗？' },
        ) as string,
      );
      if (!confirmed) return;
      setHtmlStudioDirty(false);
      setHfStudioDirty(false);
      setBentoDeckDirty(false);
    }
    setPreviewMode(mode);
  }, [
    canEditInline,
    htmlStudioDirty,
    hfStudioDirty,
    onEditDockRequest,
    previewMode,
    t,
    useHtmlStudio,
    useHyperframesStudio,
    useBentoDeck,
  ]);

  useEffect(() => {
    if (!htmlStudioDirty && !hfStudioDirty && !bentoDeckDirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [htmlStudioDirty, hfStudioDirty, bentoDeckDirty]);

  const renderWebPreview = () => (
    <WebPreviewEmbedded
      previewUrl={previewUrl}
      fileName={fileName}
      apiPath={apiPath}
      onRegisterToolbar={setHeaderActions}
      onRegisterRefresh={setRefreshAction}
    />
  );

  const panelTrailing = useMemo(() => {
    if (!refreshAction) return null;
    return (
      <PreviewChromeGroup aria-label="面板">
        {refreshAction}
      </PreviewChromeGroup>
    );
  }, [refreshAction]);

  const ext = extension(fileName);
  const adapter = useMemo(() => {
    if (useDesignCanvas) return 'designCanvas' as const;
    if (useBentoDeck) return 'bentoDeck' as const;
    if (useHtmlStudio) return 'htmlStudio' as const;
    if (useHyperframesStudio || useHfView) return 'hyperframesStudio' as const;
    // PD-SAAS-FORK: source files (json/js/jsonl/…) always render as read-only code,
    // even when sibling slide-manifest would otherwise route to PPT workbench.
    if (isCodePreviewFile(fileName, kind)) return 'codeText' as const;
    if (context.contract.carrierScope === 'design_canvas_board') {
      if ((context.contract.exportHints.bundleImagePaths?.length ?? 0) > 1) return 'collection' as const;
      return 'image' as const;
    }
    if (context.contract.carrierScope === 'bento_deck') {
      return 'bentoDeck' as const;
    }
    if (
      (context.contract.carrierScope === 'slide_deck_png' || context.contract.carrierScope === 'slide_deck_html')
      && !isCodePreviewFile(fileName, kind)
      && !isPptxFile(fileName)
    ) {
      return 'ppt' as const;
    }
    if (context.adapter !== 'fallback') {
      if (isHtmlPreviewFile(fileName) && context.adapter === 'markdownText') return 'web';
      return context.adapter;
    }
    if (isHtmlPreviewFile(fileName)) return 'web';
    if (isMarkdownEditorFile(fileName) || isTextPreviewFile(fileName)) return 'markdownText';
    if (isImageFile(fileName)) return 'image';
    if (isAudioFile(fileName) || isVideoFile(fileName)) return 'media';
    if (supportsInlineSpreadsheetPreview(fileName)) return 'spreadsheet';
    return context.adapter;
  }, [context.adapter, context.contract, context.siblings, fileName, kind, useBentoDeck, useDesignCanvas, useHfView, useHtmlStudio, useHyperframesStudio]);

  const usesDocumentCanvasInBody =
    adapter === 'pdf' ||
    adapter === 'word' ||
    (adapter === 'ppt' && isPptxFile(fileName));
  const usesPptDeckWorkbench =
    adapter === 'ppt' && context.contract.pages.length > 0 && !isPptxFile(fileName);
  const usesUnifiedDocToolbar = usesDocumentCanvasInBody || usesPptDeckWorkbench;
  const hideUnifiedHeader = useUnifiedChrome && usesUnifiedDocToolbar;
  const sidebarDocTrailing = hideUnifiedHeader ? (
    <>
      {previewChromeActions}
      <PreviewChromeDivider />
      <PreviewChromeGroup>
        <SuperPreviewReferenceButton
          artifactScope={context.artifactScope}
          siblings={context.siblings}
        />
      </PreviewChromeGroup>
      {panelTrailing ? (
        <>
          <PreviewChromeDivider />
          {panelTrailing}
        </>
      ) : null}
    </>
  ) : undefined;
  const sidebarDocPinnedTrailing = hideUnifiedHeader ? previewChromeTrailing : undefined;

  const renderDocumentCanvas = () => (
    <DocumentCanvasPreview
      projectName={projectName}
      apiPath={apiPath}
      fileName={fileName}
      variant={documentCanvasVariantEffective}
      fallbackPreviewUrl={previewUrl}
      toolbarTrailing={sidebarDocTrailing}
      toolbarPinnedTrailing={sidebarDocPinnedTrailing}
      toolbarTitle={hideUnifiedHeader ? context.contract.title : undefined}
      previewSessionKey={previewSessionKey}
    />
  );

  const body = () => {
    if (useDesignCanvas) {
      return (
        <Suspense fallback={<LoadingSurface />}>
          <DesignCanvasAdapter
            projectName={projectName}
            projectRoot={projectRoot}
            contract={context.contract}
            activePath={context.artifactScope.activePath || apiPath}
            seedActiveAsset
          />
        </Suspense>
      );
    }
    if (useBentoStudio) {
      return (
        <BentoDeckAdapter
          projectName={projectName}
          projectRoot={projectRoot}
          apiPath={apiPath}
          fileName={fileName}
          contract={context.contract}
          mode={useBentoDeck ? 'edit' : 'view'}
          hintDir={hintDir}
          onRegisterToolbar={embedInUnifiedChrome ? setHeaderActions : undefined}
          onRegisterRefresh={embedInUnifiedChrome ? setRefreshAction : undefined}
          onDirtyChange={setBentoDeckDirty}
          onFallbackChange={setBentoWebFallback}
        />
      );
    }
    if (useHyperframesStudio || useHfView) {
      return (
        <Suspense fallback={<LoadingSurface />}>
          <HyperframesStudioAdapter
            projectName={projectName}
            projectRoot={projectRoot}
            apiPath={apiPath}
            fileName={fileName}
            contract={context.contract}
            mode={useHyperframesStudio ? 'edit' : 'view'}
            hintDir={hintDir}
            siblings={context.siblings}
            onRegisterToolbar={embedInUnifiedChrome ? setHeaderActions : undefined}
            onDirtyChange={setHfStudioDirty}
          />
        </Suspense>
      );
    }
    if (useHtmlStudio) {
      const visualMode =
        import.meta.env.VITE_HTML_STUDIO_VISUAL === '1'
        && context.contract.carrierScope !== 'report_html';
      return (
        <HtmlStudioAdapter
          projectName={projectName}
          projectRoot={projectRoot}
          apiPath={apiPath}
          fileName={fileName}
          contract={context.contract}
          visualMode={visualMode}
          onRegisterToolbar={embedInUnifiedChrome ? setHeaderActions : undefined}
          onDirtyChange={setHtmlStudioDirty}
        />
      );
    }
    if (context.loading && adapter === 'ppt' && context.contract.pages.length === 0) return <LoadingSurface />;
    if (adapter === 'ppt') {
      if (context.contract.pages.length > 0) {
        return (
          <PptDeckWorkbench
            projectName={projectName}
            projectRoot={projectRoot}
            contract={context.contract}
            activePath={context.artifactScope.activePath}
            toolbarTrailing={hideUnifiedHeader ? sidebarDocTrailing : undefined}
            toolbarPinnedTrailing={hideUnifiedHeader ? sidebarDocPinnedTrailing : undefined}
            toolbarTitle={hideUnifiedHeader ? context.contract.title : undefined}
          />
        );
      }
      if (context.loading) return <LoadingSurface />;
      if (isPptxFile(fileName)) {
        return renderDocumentCanvas();
      }
      if (isImageFile(fileName)) {
        return (
          <ImagePreviewAdapter
            previewUrl={previewUrl}
            fileName={fileName}
            projectName={projectName}
            apiPath={apiPath}
            projectRoot={projectRoot}
            embedInChrome={embedInUnifiedChrome}
            onRegisterToolbar={embedInUnifiedChrome ? setHeaderActions : undefined}
          />
        );
      }
      if (isHtmlPreviewFile(fileName)) return renderWebPreview();
      return <FallbackPreviewAdapter message="该 PPT 产物暂未提供可编辑页面清单。" />;
    }
    if (adapter === 'pdf' || adapter === 'word') {
      if (isPdfFile(fileName) || isDocxFile(fileName) || isPptxFile(fileName)) {
        return renderDocumentCanvas();
      }
      if (isHtmlPreviewFile(fileName)) return renderWebPreview();
      return <ProjectMarkdownPreview projectName={projectName} apiPath={apiPath} projectRoot={projectRoot} hintDir={hintDir} />;
    }
    if (adapter === 'bentoDeck' && !useBentoStudio) return renderWebPreview();
    if (adapter === 'web') return renderWebPreview();
    if (adapter === 'markdownText') {
      if (isHtmlPreviewFile(fileName)) return renderWebPreview();
      if (isMarkdownEditorFile(fileName)) {
        return <ProjectMarkdownPreview projectName={projectName} apiPath={apiPath} projectRoot={projectRoot} hintDir={hintDir} />;
      }
      return <TextPreviewAdapter projectName={projectName} apiPath={apiPath} projectRoot={projectRoot} title={fileName} embedInChrome={embedInUnifiedChrome} />;
    }
    if (adapter === 'codeText') {
      return (
        <CodePreviewAdapter
          projectName={projectName}
          apiPath={apiPath}
          projectRoot={projectRoot}
          fileName={fileName}
          embedInChrome={embedInUnifiedChrome}
        />
      );
    }
    if (adapter === 'image') {
      return (
        <ImagePreviewAdapter
          previewUrl={previewUrl}
          fileName={fileName}
          projectName={projectName}
          apiPath={apiPath}
          projectRoot={projectRoot}
          embedInChrome={embedInUnifiedChrome}
          onRegisterToolbar={embedInUnifiedChrome ? setHeaderActions : undefined}
        />
      );
    }
    if (adapter === 'media') {
      return (
        <MediaPreviewAdapter
          projectName={projectName}
          apiPath={apiPath}
          previewUrl={previewUrl}
          fileName={fileName}
          projectRoot={projectRoot}
          hintDir={hintDir}
        />
      );
    }
    if (adapter === 'spreadsheet') {
      return <SpreadsheetPreviewAdapter projectName={projectName} apiPath={apiPath} fileName={fileName} projectRoot={projectRoot} />;
    }
    if (adapter === 'collection') {
      return context.siblings.length > 0 ? (
        <CollectionPreviewAdapter
          projectName={projectName}
          projectRoot={projectRoot}
          paths={context.siblings}
          activePath={context.artifactScope.activePath || apiPath}
        />
      ) : (
        <FallbackPreviewAdapter message="该合集尚未提供可展示的入口文件。" />
      );
    }
    if (adapter === 'designCanvas') {
      return (
        <Suspense fallback={<LoadingSurface />}>
          <DesignCanvasAdapter
            projectName={projectName}
            projectRoot={projectRoot}
            contract={context.contract}
            activePath={context.artifactScope.activePath || apiPath}
            seedActiveAsset={isImageFile(fileName)}
          />
        </Suspense>
      );
    }
    if (ext === 'pdf' || ext === 'docx' || ext === 'pptx') {
      return renderDocumentCanvas();
    }
    return <FallbackPreviewAdapter />;
  };

  return (
    <SuperPreviewShell
      contract={context.contract}
      adapter={adapter}
      loading={context.loading}
      error={context.error}
      className={className}
      showModeToggle={canToggleCanvas || canToggleBentoDeck || canToggleHtmlStudio || canToggleHfStudio}
      previewMode={previewMode}
      onPreviewModeChange={handlePreviewModeChange}
      editModeDisabled={editDisabled}
      editModeDisabledReason={
        editDisabled
          ? isMobilePreviewSurface()
            ? (t('htmlStudio.mobileReadonly', {
                defaultValue: '请在桌面端右栏编辑，或发送到对话修改',
              }) as string)
            : '请在右栏分屏中编辑'
          : undefined
      }
      artifactScope={hideUnifiedHeader ? undefined : context.artifactScope}
      referenceSiblings={context.siblings}
      compact={compact}
      headerActions={headerActions}
      chromeActions={useUnifiedChrome && !hideUnifiedHeader ? previewChromeActions : undefined}
      endActions={!hideUnifiedHeader ? panelTrailing ?? undefined : undefined}
      pinnedEndActions={!hideUnifiedHeader ? previewChromeTrailing : undefined}
      hideHeader={hideUnifiedHeader}
    >
      {body()}
    </SuperPreviewShell>
  );
}
