// PD-SAAS-FORK: brush-painted inpainting mask overlay for design canvas
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Editor } from '@tldraw/tldraw';
import { api } from '../../../../utils/api';
import { resolveCanvasNodePath } from '../../../../shared/designCanvasManifest';
import { nodeIdToShapeId } from './tldrawCanvasSync';

type MaskTarget = {
  nodeId: string;
  shapeW: number;
  shapeH: number;
  screenLeft: number;
  screenTop: number;
  screenWidth: number;
  screenHeight: number;
};

type DesignCanvasMaskBrushProps = {
  editor: Editor | null;
  surfaceRef: RefObject<HTMLDivElement | null>;
  active: boolean;
  nodeId: string | null;
  boardDir: string;
  projectName: string;
  projectRoot?: string;
  existingMaskPath?: string;
  onSaved: (nodeId: string, maskRelativePath: string) => void;
};

const DEFAULT_BRUSH = 28;

function resolveMaskTarget(
  editor: Editor,
  nodeId: string,
  surfaceRef: RefObject<HTMLDivElement | null>,
): MaskTarget | null {
  const surface = surfaceRef.current;
  if (!surface) return null;
  const surfaceRect = surface.getBoundingClientRect();
  const shapeId = nodeIdToShapeId(nodeId);
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return null;
  const topLeft = editor.pageToScreen({ x: bounds.x, y: bounds.y });
  const bottomRight = editor.pageToScreen({ x: bounds.maxX, y: bounds.maxY });
  const screenLeft = topLeft.x - surfaceRect.left;
  const screenTop = topLeft.y - surfaceRect.top;
  const screenWidth = Math.max(1, bottomRight.x - topLeft.x);
  const screenHeight = Math.max(1, bottomRight.y - topLeft.y);
  return {
    nodeId,
    shapeW: bounds.w,
    shapeH: bounds.h,
    screenLeft,
    screenTop,
    screenWidth,
    screenHeight,
  };
}

async function loadMaskImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export default function DesignCanvasMaskBrush({
  editor,
  surfaceRef,
  active,
  nodeId,
  boardDir,
  projectName,
  projectRoot,
  existingMaskPath,
  onSaved,
}: DesignCanvasMaskBrushProps) {
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [target, setTarget] = useState<MaskTarget | null>(null);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH);
  const [saving, setSaving] = useState(false);

  const syncTarget = useCallback(() => {
    if (!editor || !active || !nodeId) {
      setTarget(null);
      return;
    }
    setTarget(resolveMaskTarget(editor, nodeId, surfaceRef));
  }, [active, editor, nodeId, surfaceRef]);

  useEffect(() => {
    syncTarget();
    if (!editor || !active) return undefined;
    return editor.store.listen(syncTarget, { scope: 'session' });
  }, [active, editor, syncTarget]);

  useEffect(() => {
    if (!active || !target) return;
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas) return;

    const pixelW = Math.max(1, Math.round(target.shapeW));
    const pixelH = Math.max(1, Math.round(target.shapeH));
    maskCanvas.width = pixelW;
    maskCanvas.height = pixelH;
    overlayCanvas.width = pixelW;
    overlayCanvas.height = pixelH;

    const maskCtx = maskCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!maskCtx || !overlayCtx) return;

    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, pixelW, pixelH);
    overlayCtx.clearRect(0, 0, pixelW, pixelH);

    if (!existingMaskPath) return;
    const absolute = resolveCanvasNodePath(boardDir, existingMaskPath);
    if (!absolute) return;
    const url = api.fileContentUrl(projectName, absolute, projectRoot || '');
    const href = typeof window !== 'undefined' ? new URL(url, window.location.origin).href : url;
    void loadMaskImage(href).then((img) => {
      if (!img) return;
      maskCtx.drawImage(img, 0, 0, pixelW, pixelH);
      overlayCtx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      overlayCtx.fillRect(0, 0, pixelW, pixelH);
      overlayCtx.globalCompositeOperation = 'destination-in';
      overlayCtx.drawImage(maskCanvas, 0, 0);
      overlayCtx.globalCompositeOperation = 'source-over';
    });
  }, [active, boardDir, existingMaskPath, projectName, projectRoot, target]);

  const toLocalPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const paintStroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas || !target) return;
    const maskCtx = maskCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!maskCtx || !overlayCtx) return;

    const scale = target.shapeW / Math.max(1, target.screenWidth);
    const lineWidth = Math.max(4, brushSize * scale);

    maskCtx.strokeStyle = '#ffffff';
    maskCtx.lineWidth = lineWidth;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.beginPath();
    maskCtx.moveTo(from.x, from.y);
    maskCtx.lineTo(to.x, to.y);
    maskCtx.stroke();

    overlayCtx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    overlayCtx.lineWidth = lineWidth;
    overlayCtx.lineCap = 'round';
    overlayCtx.lineJoin = 'round';
    overlayCtx.beginPath();
    overlayCtx.moveTo(from.x, from.y);
    overlayCtx.lineTo(to.x, to.y);
    overlayCtx.stroke();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || saving) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = toLocalPoint(event);
    if (!point) return;
    lastPointRef.current = point;
    paintStroke(point, point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !active || saving) return;
    const point = toLocalPoint(event);
    const last = lastPointRef.current;
    if (!point || !last) return;
    paintStroke(last, point);
    lastPointRef.current = point;
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!maskCanvas || !overlayCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!maskCtx || !overlayCtx) return;
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  };

  const saveMask = async () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas || !nodeId || saving) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        maskCanvas.toBlob((value) => resolve(value), 'image/png');
      });
      if (!blob) return;
      const fileName = `mask-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '')}.png`;
      const relativePath = `assets/${fileName}`;
      const formData = new FormData();
      formData.append('files', new File([blob], fileName, { type: 'image/png' }));
      formData.append('targetPath', `${boardDir}/assets`);
      const upload = await api.uploadFiles(projectName, formData);
      if (!upload.ok) return;
      onSaved(nodeId, relativePath);
    } finally {
      setSaving(false);
    }
  };

  if (!active || !target) return null;

  return (
    <div
      className="absolute z-[2]"
      data-testid="design-canvas-mask-brush"
      style={{
        left: target.screenLeft,
        top: target.screenTop,
        width: target.screenWidth,
        height: target.screenHeight,
      }}
    >
      <canvas ref={maskCanvasRef} className="hidden" aria-hidden="true" />
      <canvas
        ref={overlayCanvasRef}
        className="h-full w-full cursor-crosshair touch-none rounded-sm ring-2 ring-primary/40"
        data-testid="design-canvas-mask-brush-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      <div className="pointer-events-auto absolute -top-9 left-0 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 shadow-sm">
        <label className="flex items-center gap-1 text-[10px] text-foreground">
          笔刷
          <input
            type="range"
            min={8}
            max={96}
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
            className="h-3 w-16 accent-primary"
            data-testid="design-canvas-mask-brush-size"
          />
        </label>
        <button
          type="button"
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted"
          data-testid="design-canvas-mask-brush-clear"
          onClick={clearMask}
        >
          清除
        </button>
        <button
          type="button"
          className="rounded border border-primary/50 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/15"
          data-testid="design-canvas-mask-brush-save"
          disabled={saving}
          onClick={() => void saveMask()}
        >
          {saving ? '保存中…' : '完成涂抹'}
        </button>
      </div>
    </div>
  );
}
