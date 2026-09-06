// PD-SAAS-FORK: prefetch chat workspace shell on login + shared progress for WorkspaceSyncScreen
import { lazy, type ComponentType } from 'react';

type ProgressListener = (progress: number) => void;

/** Chat-first shell transfer budget (AppShell + ChatInterface + eager tabs, brotli). */
const SHELL_BYTES_ESTIMATE = 1_200_000;
const listeners = new Set<ProgressListener>();
let progress = 0;
let done = false;
let shellPromise: Promise<{ default: ComponentType<unknown> }> | null = null;
let creepTimer: ReturnType<typeof setInterval> | null = null;
let resourceObserver: PerformanceObserver | null = null;

function setProgress(next: number) {
  const clamped = Math.min(100, Math.max(progress, next));
  if (clamped === progress) return;
  progress = clamped;
  for (const listener of listeners) listener(progress);
}

function startProgressTracking() {
  const t0 = performance.now();
  creepTimer = window.setInterval(() => {
    if (done) return;
    const elapsed = performance.now() - t0;
    const creep = 6 + (1 - Math.exp(-elapsed / 14_000)) * 48;
    setProgress(creep);
  }, 180);

  if (typeof PerformanceObserver === 'undefined') return;
  try {
    resourceObserver = new PerformanceObserver((list) => {
      let bytes = 0;
      for (const entry of list.getEntries()) {
        if (!entry.name.includes('/assets/')) continue;
        const timing = entry as PerformanceResourceTiming;
        bytes += timing.encodedBodySize || timing.transferSize || 0;
      }
      if (bytes > 0) {
        setProgress(55 + Math.min(40, (bytes / SHELL_BYTES_ESTIMATE) * 40));
      }
    });
    resourceObserver.observe({ type: 'resource', buffered: true });
  } catch {
    resourceObserver = null;
  }
}

function stopProgressTracking() {
  if (creepTimer) {
    clearInterval(creepTimer);
    creepTimer = null;
  }
  resourceObserver?.disconnect();
  resourceObserver = null;
}

/**
 * Pull the chat-first workspace bundle on login (not full secondary tabs).
 * Parallel hints help the browser fetch chat/files/discover chunks early.
 */
function loadChatWorkspaceMinimal(): Promise<{ default: ComponentType<unknown> }> {
  return Promise.all([
    import('../../components/app-shell/AppShellV2'),
    import('../../components/chat-v2/ChatInterfaceV2'),
    import('../../components/main-content-v2/FilesV2'),
    import('../../components/templates-hub/TemplatesHubPanel'),
  ]).then(([shell]) => shell);
}

/** Start downloading the workspace shell (idempotent). Call on /login mount. */
export function preloadWorkspaceShell(): Promise<{ default: ComponentType<unknown> }> {
  if (shellPromise) return shellPromise;

  setProgress(4);
  startProgressTracking();

  shellPromise = loadChatWorkspaceMinimal()
    .then((mod) => {
      done = true;
      stopProgressTracking();
      setProgress(100);
      return mod;
    })
    .catch((err) => {
      stopProgressTracking();
      shellPromise = null;
      done = false;
      progress = 0;
      throw err;
    });

  return shellPromise;
}

export const AppShellV2Lazy = lazy(() => preloadWorkspaceShell());

export function subscribeWorkspacePreloadProgress(listener: ProgressListener): () => void {
  listeners.add(listener);
  listener(progress);
  return () => listeners.delete(listener);
}

export function isWorkspacePreloadDone(): boolean {
  return done;
}
