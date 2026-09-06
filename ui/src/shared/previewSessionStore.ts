import { useCallback, useSyncExternalStore } from 'react';
import type { DocumentRailMode } from '../components/document-canvas/DocumentPageRail';
import type { ZoomMode } from '../components/document-canvas/types';

export type PreviewSessionState = {
  pageIndex: number;
  zoomMode: ZoomMode;
  railMode: DocumentRailMode;
};

export type PreviewSessionPatch = Partial<PreviewSessionState>;

const DEFAULT_PREVIEW_SESSION: PreviewSessionState = {
  pageIndex: 0,
  zoomMode: 'fitPage',
  railMode: 'strip',
};

const sessions = new Map<string, PreviewSessionState>();
const listeners = new Map<string, Set<() => void>>();

function notifyPreviewSession(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

export function getPreviewSessionState(key?: string | null): PreviewSessionState {
  if (!key) return DEFAULT_PREVIEW_SESSION;
  return sessions.get(key) ?? DEFAULT_PREVIEW_SESSION;
}

export function setPreviewSessionState(key: string | null | undefined, patch: PreviewSessionPatch): void {
  if (!key) return;
  const current = getPreviewSessionState(key);
  const next = { ...current, ...patch };
  if (
    current.pageIndex === next.pageIndex &&
    current.zoomMode === next.zoomMode &&
    current.railMode === next.railMode
  ) {
    return;
  }
  sessions.set(key, next);
  notifyPreviewSession(key);
}

export function subscribePreviewSession(key: string | null | undefined, listener: () => void): () => void {
  if (!key) return () => {};
  const set = listeners.get(key) ?? new Set<() => void>();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

export function usePreviewSession(key: string | null | undefined) {
  const state = useSyncExternalStore(
    (listener) => subscribePreviewSession(key, listener),
    () => getPreviewSessionState(key),
    () => getPreviewSessionState(key),
  );
  const update = useCallback((patch: PreviewSessionPatch) => {
    setPreviewSessionState(key, patch);
  }, [key]);
  return { state, update };
}
