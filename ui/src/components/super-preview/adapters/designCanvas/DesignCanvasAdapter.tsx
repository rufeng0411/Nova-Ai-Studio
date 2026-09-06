// PD-SAAS-FORK: infinite design canvas adapter (tldraw + manifest sync)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tldraw/tldraw';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { loadProjectTextContent } from '../../../../shared/loadProjectTextContent';
import type { ArtifactContract } from '../../../../shared/artifactContract';
import {
  createEmptyCanvasManifest,
  parseCanvasManifest,
  resolveCanvasNodePath,
  seedActiveAssetOnCanvas,
  serializeCanvasManifest,
  type DesignCanvasManifest,
  type DesignCanvasNode,
} from '../../../../shared/designCanvasManifest';
import { resolveCanvasBoardEditContext } from '../../../../shared/ensureCanvasBoardDir';
import {
  buildCanvasEditPrompt,
  dispatchDesignCanvasPrefill,
  subscribeCanvasAssetAdded,
} from '../../../../shared/designCanvasBridge';
import { getArtifactFileName, normalizeArtifactPath } from '../../../../shared/artifactPaths';
import { api } from '../../../../utils/api';
import { isImageFile } from '../../../code-editor/utils/binaryFile';
import { cn } from '../../../../lib/utils';
import { useTheme } from '../../../../contexts/ThemeContext';
import DesignCanvasGrid from './DesignCanvasGrid';
import DesignCanvasTldrawSurface from './DesignCanvasTldrawSurface';
import DesignCanvasMaskBrush from './DesignCanvasMaskBrush';
import {
  designCanvasToolbarButtonActiveClass,
  designCanvasToolbarButtonClass,
  designCanvasToolbarIconButtonClass,
} from './designCanvasToolbar';
import {
  extractManifestFromEditor,
  parseMaskRegionFromMeta,
  sanitizeTldrawSnapshot,
  snapshotContainsBlob,
  syncManifestNodesToEditor,
  nodeIdToShapeId,
} from './tldrawCanvasSync';

type DesignCanvasAdapterProps = {
  projectName: string;
  projectRoot?: string;
  contract: ArtifactContract;
  activePath: string;
  seedActiveAsset?: boolean;
};


async function probeImageSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
        return;
      }
      resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function copyAssetIntoBoard(
  projectName: string,
  boardDir: string,
  sourcePath: string,
  relativePath: string,
): Promise<boolean> {
  const response = await api.readFileBlob(projectName, sourcePath);
  if (!response.ok) return false;
  const blob = await response.blob();
  const fileName = relativePath.split('/').pop() || 'asset.png';
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  const formData = new FormData();
  formData.append('files', file);
  formData.append('targetPath', `${boardDir}/assets`);
  const upload = await api.uploadFiles(projectName, formData);
  return upload.ok;
}

export default function DesignCanvasAdapter({
  projectName,
  projectRoot,
  contract,
  activePath,
  seedActiveAsset = false,
}: DesignCanvasAdapterProps) {
  const normalizedActive = normalizeArtifactPath(activePath);
  const activeFileName = getArtifactFileName(normalizedActive || activePath);
  const boardContext = useMemo(
    () =>
      resolveCanvasBoardEditContext({
        activePath: normalizedActive,
        hintDir: contract.sourcePaths[0],
        contractManifestPath: contract.sourcePaths.find((p) => /canvas-manifest\.json$/i.test(p)),
      }),
    [contract.sourcePaths, normalizedActive],
  );
  const boardDir = boardContext?.boardDir ?? '';
  const manifestPath = boardContext?.manifestPath ?? '';
  const [manifest, setManifest] = useState<DesignCanvasManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [syncHint, setSyncHint] = useState('');
  const [editorReady, setEditorReady] = useState(0);
  const editorRef = useRef<Editor | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const manifestRef = useRef<DesignCanvasManifest | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const syncGenerationRef = useRef(0);
  const lastSyncedBootstrapSeqRef = useRef(0);
  const [bootstrapSeq, setBootstrapSeq] = useState(0);
  const [maskBrushActive, setMaskBrushActive] = useState(false);
  const [maskBrushNodeId, setMaskBrushNodeId] = useState<string | null>(null);
  const [gridViewport, setGridViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const { isDarkMode } = useTheme() as { isDarkMode: boolean };

  manifestRef.current = manifest;

  useEffect(() => {
    if (!editor) return undefined;
    const syncGrid = () => {
      const origin = editor.pageToScreen({ x: 0, y: 0 });
      setGridViewport({ x: origin.x, y: origin.y, zoom: editor.getZoomLevel() });
    };
    syncGrid();
    return editor.store.listen(syncGrid, { scope: 'session' });
  }, [editor]);

  const resolveImageAsset = useCallback(
    async (absolutePath: string, fallbacks: string[] = []) => {
      const candidates = [...new Set([absolutePath, ...fallbacks, normalizedActive].filter(Boolean))];
      for (const candidate of candidates) {
        const relativeSrc = api.fileContentUrl(projectName, candidate, projectRoot || '');
        const src =
          typeof window !== 'undefined'
            ? new URL(relativeSrc, window.location.origin).href
            : relativeSrc;
        const size = await probeImageSize(src);
        if (size) {
          return { src, ...size };
        }
      }
      return null;
    },
    [normalizedActive, projectName, projectRoot],
  );

  const writeManifest = useCallback(
    async (next: DesignCanvasManifest, options?: { updateState?: boolean; showHint?: boolean }) => {
      manifestRef.current = next;
      if (options?.updateState !== false) {
        setManifest(next);
      }
      setSaveError(false);
      setSaving(true);
      try {
        const payload = serializeCanvasManifest(next);
        const response = await api.saveFile(projectName, manifestPath, payload);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (options?.showHint !== false) {
          setSyncHint('已同步到任务文件夹');
          window.setTimeout(() => setSyncHint(''), 2500);
        }
      } catch {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    },
    [manifestPath, projectName],
  );

  const persistManifest = useCallback(
    (next: DesignCanvasManifest) => writeManifest(next, { updateState: true }),
    [writeManifest],
  );

  const schedulePersistFromEditor = useCallback(
    (editor: Editor) => {
      if (!boardDir) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        const base = manifestRef.current;
        if (!base || !boardDir) return;
        const next = extractManifestFromEditor(editor, base, boardDir);
        void writeManifest(next, { updateState: false, showHint: false });
      }, 900);
    },
    [boardDir, writeManifest],
  );

  const bootstrapBoard = useCallback(async () => {
    if (!boardContext) {
      setLoading(false);
      return;
    }
    const isRefresh = manifestRef.current !== null;
    if (!isRefresh) setLoading(true);
    syncGenerationRef.current += 1;
    try {
      if (boardContext.needsAssetCopy && normalizedActive) {
        await copyAssetIntoBoard(
          projectName,
          boardContext.boardDir,
          normalizedActive,
          boardContext.activeAssetRelative,
        );
      }
      let parsed: DesignCanvasManifest | null = null;
      try {
        const raw = await loadProjectTextContent(projectName, manifestPath, projectRoot);
        parsed = parseCanvasManifest(JSON.parse(raw));
      } catch {
        parsed = null;
      }
      if (!parsed) {
        const boardId = boardContext.boardDir.split('/').pop() || 'board';
        parsed = createEmptyCanvasManifest(boardId, contract.title || boardId);
      }
      if (parsed.tldraw_snapshot) {
        const hadBlob = snapshotContainsBlob(parsed.tldraw_snapshot);
        const sanitized = sanitizeTldrawSnapshot(parsed.tldraw_snapshot) ?? {};
        parsed = { ...parsed, tldraw_snapshot: sanitized };
        if (hadBlob) await persistManifest(parsed);
      }
      if (seedActiveAsset && normalizedActive && isImageFile(activeFileName)) {
        const seedPath = boardContext.needsAssetCopy
          ? `${boardContext.boardDir}/${boardContext.activeAssetRelative}`
          : normalizedActive;
        const { manifest: seeded, didSeed } = seedActiveAssetOnCanvas(
          parsed,
          seedPath,
          boardContext.boardDir,
          { title: contract.title || activeFileName, focusViewport: true },
        );
        parsed = seeded;
        if (didSeed) await persistManifest(parsed);
      }
      setManifest(parsed);
      manifestRef.current = parsed;
      setBootstrapSeq((value) => value + 1);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [
    activeFileName,
    boardContext,
    contract.title,
    manifestPath,
    normalizedActive,
    persistManifest,
    projectName,
    projectRoot,
    seedActiveAsset,
  ]);

  useEffect(() => {
    void bootstrapBoard();
  }, [bootstrapBoard]);

  useEffect(() => {
    if (!manifestPath) return undefined;
    return subscribeCanvasAssetAdded((detail) => {
      if (normalizeArtifactPath(detail.boardPath) !== normalizeArtifactPath(manifestPath)) return;
      void bootstrapBoard();
    });
  }, [bootstrapBoard, manifestPath]);

  const handleEditorMount = useCallback((nextEditor: Editor) => {
    editorRef.current = nextEditor;
    setEditor(nextEditor);
    setEditorReady((value) => value + 1);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const base = manifestRef.current;
    if (!editor || !base || loading || !boardDir || editorReady === 0 || bootstrapSeq === 0) {
      return undefined;
    }
    if (lastSyncedBootstrapSeqRef.current === bootstrapSeq) {
      return undefined;
    }
    lastSyncedBootstrapSeqRef.current = bootstrapSeq;
    const generation = syncGenerationRef.current;
    let cancelled = false;
    void (async () => {
      const placed = await syncManifestNodesToEditor(editor, base, boardDir, resolveImageAsset);
      if (cancelled || generation !== syncGenerationRef.current) return;
      if (placed === 0 && base.nodes.some((node) => node.type === 'image')) {
        setSyncHint('图片加载失败，请检查文件路径或刷新重试');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardDir, bootstrapSeq, editorReady, loading, resolveImageAsset]);

  const adjustZoom = (factor: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.setCamera({ ...editor.getCamera(), z: Math.min(4, Math.max(0.15, editor.getZoomLevel() * factor)) });
  };

  const selectedImageNodes = (): DesignCanvasNode[] => {
    const editor = editorRef.current;
    const base = manifestRef.current;
    if (!editor || !base) return [];
    return editor
      .getSelectedShapeIds()
      .map((shapeId) => base.nodes.find((node) => nodeIdToShapeId(node.id) === shapeId))
      .filter((node): node is DesignCanvasNode => Boolean(node && node.type === 'image'));
  };

  const sendSelectedToComposer = () => {
    const base = manifestRef.current;
    if (!base) return;
    const selected = selectedImageNodes();
    const paths = selected
      .map((node) => resolveCanvasNodePath(boardDir, node.path))
      .filter(Boolean);
    if (paths.length === 0 && normalizedActive) paths.push(normalizedActive);
    const mask = parseMaskRegionFromMeta(selected[0]?.meta?.maskRegion);
    const region = mask ? `${mask.x},${mask.y},${mask.w},${mask.h}` : undefined;
    const maskPaintRelative =
      typeof selected[0]?.meta?.maskPaint === 'string' ? selected[0]?.meta?.maskPaint : undefined;
    const maskPaintPath = maskPaintRelative
      ? resolveCanvasNodePath(boardDir, maskPaintRelative)
      : undefined;
    dispatchDesignCanvasPrefill({
      boardPath: manifestPath,
      nodePaths: paths,
      prompt: buildCanvasEditPrompt(
        paths,
        '请基于选中的画布素材继续编辑（白色区域为需修图/重绘的遮罩）',
        region,
        maskPaintPath,
      ),
      force: true,
    });
  };

  const applyMaskRegion = () => {
    const editor = editorRef.current;
    const base = manifestRef.current;
    if (!editor || !base) return;
    let shapeId = editor.getOnlySelectedShapeId();
    if (!shapeId) {
      const selected = editor.getSelectedShapeIds();
      if (selected.length === 1) shapeId = selected[0];
    }
    if (!shapeId) {
      const imageNodes = base.nodes.filter((node) => node.type === 'image');
      if (imageNodes.length === 1) {
        shapeId = nodeIdToShapeId(imageNodes[0].id);
        editor.select(shapeId);
      }
    }
    if (!shapeId) return;
    const bounds = editor.getShapePageBounds(shapeId);
    if (!bounds) return;
    const nodeId = base.nodes.find((node) => nodeIdToShapeId(node.id) === shapeId)?.id;
    if (!nodeId) return;
    const maskRegion = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
    const nextNodes = base.nodes.map((node) =>
      node.id === nodeId ? { ...node, meta: { ...node.meta, maskRegion } } : node,
    );
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void persistManifest({ ...base, nodes: nextNodes });
  };

  const resolveMaskBrushNodeId = (): string | null => {
    const selected = selectedImageNodes();
    if (selected.length === 1) return selected[0].id;
    const base = manifestRef.current;
    const editor = editorRef.current;
    if (!base || !editor) return null;
    const imageNodes = base.nodes.filter((node) => node.type === 'image');
    if (imageNodes.length === 1) {
      editor.select(nodeIdToShapeId(imageNodes[0].id));
      return imageNodes[0].id;
    }
    return null;
  };

  const toggleMaskBrush = () => {
    if (maskBrushActive) {
      setMaskBrushActive(false);
      setMaskBrushNodeId(null);
      return;
    }
    const nodeId = resolveMaskBrushNodeId();
    if (!nodeId) {
      setSyncHint('请先选中一张图片再涂抹遮罩');
      window.setTimeout(() => setSyncHint(''), 2500);
      return;
    }
    setMaskBrushNodeId(nodeId);
    setMaskBrushActive(true);
  };

  const handleMaskPaintSaved = (nodeId: string, maskRelativePath: string) => {
    const base = manifestRef.current;
    if (!base) return;
    const nextNodes = base.nodes.map((node) =>
      node.id === nodeId ? { ...node, meta: { ...node.meta, maskPaint: maskRelativePath } } : node,
    );
    void persistManifest({ ...base, nodes: nextNodes });
    setMaskBrushActive(false);
    setMaskBrushNodeId(null);
    setSyncHint('涂抹遮罩已保存');
    window.setTimeout(() => setSyncHint(''), 2500);
  };

  const addDiagramPreset = (preset: 'flowchart' | 'mindmap') => {
    const base = manifestRef.current;
    if (!base) return;
    const node: DesignCanvasNode = {
      id: `n-${Date.now()}`,
      type: preset === 'flowchart' ? 'diagram_excalidraw' : 'diagram_mermaid',
      text: preset === 'flowchart' ? '流程图' : '脑图',
      x: 120 + base.nodes.length * 48,
      y: 120,
      w: 480,
      h: 320,
      path: preset === 'flowchart' ? 'diagrams/flow.excalidraw' : 'diagrams/mindmap.mmd',
      parent_id: null,
      meta: { preset },
    };
    void persistManifest({ ...base, nodes: [...base.nodes, node], board_mode: 'mixed' });
  };

  const blendSelected = () => {
    const base = manifestRef.current;
    if (!base) return;
    const selected = selectedImageNodes();
    if (selected.length < 2) return;
    const paths = selected.map((node) => resolveCanvasNodePath(boardDir, node.path)).filter(Boolean);
    dispatchDesignCanvasPrefill({
      boardPath: manifestPath,
      nodePaths: paths,
      prompt: buildCanvasEditPrompt(paths, '请将选中的多张素材融合为一个新变体，并保存到当前画板 assets/ 目录'),
      force: true,
    });
  };

  if (!boardContext || loading || !manifest) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  const maskBrushTarget = maskBrushNodeId
    ? manifest.nodes.find((node) => node.id === maskBrushNodeId)
    : null;
  const existingMaskPaint =
    typeof maskBrushTarget?.meta?.maskPaint === 'string' ? maskBrushTarget.meta.maskPaint : undefined;

  const statusLabel = saving
    ? '保存中…'
    : saveError
      ? '保存失败'
      : syncHint || (seedActiveAsset ? `正在编辑：${activeFileName}` : manifest.title);

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30" data-testid="design-canvas-adapter">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shadow-sm">
        <div className="min-w-0 truncate text-[11px] text-foreground/75" title={normalizedActive || manifest.title}>
          {statusLabel}
          {!saving && !saveError ? ` · ${manifest.nodes.length} 个节点` : null}
          {maskBrushActive ? ' · 涂抹模式' : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={designCanvasToolbarIconButtonClass}
            aria-label="缩小"
            onClick={() => adjustZoom(0.9)}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={designCanvasToolbarIconButtonClass}
            aria-label="放大"
            onClick={() => adjustZoom(1.1)}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={designCanvasToolbarButtonClass}
            data-testid="design-canvas-apply-mask"
            onClick={applyMaskRegion}
          >
            矩形遮罩
          </button>
          <button
            type="button"
            className={designCanvasToolbarButtonActiveClass(maskBrushActive)}
            data-testid="design-canvas-mask-brush-toggle"
            onClick={toggleMaskBrush}
          >
            涂抹遮罩
          </button>
          <button
            type="button"
            className={designCanvasToolbarButtonClass}
            data-testid="design-canvas-add-flowchart"
            onClick={() => addDiagramPreset('flowchart')}
          >
            流程图
          </button>
          <button
            type="button"
            className={designCanvasToolbarButtonClass}
            data-testid="design-canvas-add-mindmap"
            onClick={() => addDiagramPreset('mindmap')}
          >
            脑图
          </button>
          <button
            type="button"
            className={designCanvasToolbarButtonClass}
            data-testid="design-canvas-blend"
            onClick={blendSelected}
          >
            融合变体
          </button>
          <button
            type="button"
            className={cn(designCanvasToolbarButtonClass, 'border-primary/40 text-primary hover:bg-primary/10')}
            data-testid="design-canvas-send-composer"
            onClick={sendSelectedToComposer}
          >
            发送到对话
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1" data-testid="design-canvas-surface" ref={surfaceRef}>
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-0 overflow-hidden',
            isDarkMode ? 'bg-neutral-950' : 'bg-zinc-100',
          )}
          data-testid="design-canvas-grid-layer"
        >
          <DesignCanvasGrid viewport={gridViewport} dark={isDarkMode} />
        </div>
        <DesignCanvasTldrawSurface
          className="absolute inset-0 z-[1]"
          onEditorMount={handleEditorMount}
          onUserChange={schedulePersistFromEditor}
          maskBrushActive={maskBrushActive}
        />
        <DesignCanvasMaskBrush
          editor={editor}
          surfaceRef={surfaceRef}
          active={maskBrushActive}
          nodeId={maskBrushNodeId}
          boardDir={boardDir}
          projectName={projectName}
          projectRoot={projectRoot}
          existingMaskPath={existingMaskPaint}
          onSaved={handleMaskPaintSaved}
        />
        <div
          className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-card/90 px-2 py-1 text-[10px] text-foreground/70 shadow-sm"
          data-testid="design-canvas-active-node"
        >
          {maskBrushActive
            ? '在选中图片上涂抹需修图区域，完成后点「完成涂抹」'
            : '拖拽/缩放/多选 · 点阵网格已对齐画布'}
        </div>
      </div>
    </div>
  );
}
