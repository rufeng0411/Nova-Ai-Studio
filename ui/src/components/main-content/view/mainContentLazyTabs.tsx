// PD-SAAS-FORK: secondary main tabs — lazy chunks; chat/files/discover stay eager in MainContent.
import { lazy, Suspense, type ReactNode } from 'react';

export const LazyShellV2 = lazy(() => import('../../main-content-v2/ShellV2'));
export const LazyGitV2 = lazy(() => import('../../main-content-v2/GitV2'));
export const LazyAlwaysOnV2 = lazy(() => import('../../main-content-v2/AlwaysOnV2'));
export const LazyDashboardV2 = lazy(() => import('../../main-content-v2/DashboardV2'));
export const LazyMemoryPanel = lazy(() => import('./memory/MemoryPanel'));
export const LazyTasksV2 = lazy(() => import('../../main-content-v2/TasksV2'));
export const LazyPluginTabContent = lazy(() => import('../../plugins/view/PluginTabContent'));

/** Minimal fallback — secondary tabs prefetch on idle after chat mounts. */
export function MainTabSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

let secondaryPrefetchStarted = false;

/** Warm secondary tab chunks after first paint so tab switches feel instant. */
export function prefetchSecondaryMainTabs(): void {
  if (secondaryPrefetchStarted || typeof window === 'undefined') return;
  secondaryPrefetchStarted = true;

  const warm = () => {
    void import('../../main-content-v2/ShellV2');
    void import('../../main-content-v2/GitV2');
    void import('../../main-content-v2/AlwaysOnV2');
    void import('../../main-content-v2/DashboardV2');
    void import('./memory/MemoryPanel');
    void import('../../main-content-v2/TasksV2');
    void import('../../plugins/view/PluginTabContent');
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 8_000 });
  } else {
    globalThis.setTimeout(warm, 3_000);
  }
}
