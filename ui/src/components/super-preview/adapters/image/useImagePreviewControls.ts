import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { triggerAuthFileDownload } from '../../../../utils/triggerAuthFileDownload';

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;

export type ImagePreviewControls = {
  scale: number;
  scaleLabel: string;
  darkBackground: boolean;
  canPan: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  toggleBackground: () => void;
  saveImage: () => Promise<void>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  transformStyle: { transform: string };
};

type UseImagePreviewControlsOptions = {
  projectName?: string;
  apiPath?: string;
  fileName: string;
  previewUrl?: string;
};

export function useImagePreviewControls({
  projectName,
  apiPath,
  fileName,
  previewUrl,
}: UseImagePreviewControlsOptions): ImagePreviewControls {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [darkBackground, setDarkBackground] = useState(true);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);

  const clampScale = useCallback((value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)), []);

  const zoomIn = useCallback(() => {
    setScale((current) => clampScale(Number((current * ZOOM_STEP).toFixed(3))));
  }, [clampScale]);

  const zoomOut = useCallback(() => {
    setScale((current) => clampScale(Number((current / ZOOM_STEP).toFixed(3))));
  }, [clampScale]);

  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const toggleBackground = useCallback(() => {
    setDarkBackground((current) => !current);
  }, []);

  const saveImage = useCallback(async () => {
    if (projectName && apiPath) {
      const result = await triggerAuthFileDownload(projectName, apiPath);
      if (result.ok) return;
    }
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  }, [apiPath, fileName, previewUrl, projectName]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pan.x, pan.y]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.panX + event.clientX - drag.x,
      y: drag.panY + event.clientY - drag.y,
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    setScale((current) => clampScale(Number((current * delta).toFixed(3))));
  }, [clampScale]);

  return {
    scale,
    scaleLabel: `${Math.round(scale * 100)}%`,
    darkBackground,
    canPan: scale > 1 || pan.x !== 0 || pan.y !== 0,
    zoomIn,
    zoomOut,
    resetView,
    toggleBackground,
    saveImage,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    transformStyle: {
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    },
  };
}
