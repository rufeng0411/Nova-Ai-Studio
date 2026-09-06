import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, ProtectedRoute } from './components/auth';
import { TaskMasterProvider } from './contexts/TaskMasterContext';
import { TasksSettingsProvider } from './contexts/TasksSettingsContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { PluginsProvider } from './contexts/PluginsContext';
import ErrorBoundary from './components/main-content/view/ErrorBoundary';
import i18n from './i18n/config.js';
import { IS_SAAS_MODE } from './constants/config';
import SaasProtectedRoute from './saas/guards/SaasProtectedRoute';
import { StorageSyncProvider } from './saas/storage/StorageSyncContext';
import { useAuth } from './components/auth/context/AuthContext';
// PD-SAAS-FORK: login page imports only auth UI — not admin routes or main shell.
import SaasAuthPage from './saas/auth/SaasAuthPage';
import MobileBrowserRedirect from './mobile/MobileBrowserRedirect';
import { useDeviceSettings } from './hooks/useDeviceSettings';
import {
  MOBILE_SHELL_BREAKPOINT_PX,
  isMobileRoutePath,
  stripMobileRoutePrefix,
} from './mobile/mobileRoute';
import { AppShellV2Lazy, preloadWorkspaceShell } from './saas/bootstrap/workspacePreload';
import WorkspaceSyncScreen from './saas/bootstrap/WorkspaceSyncScreen';
import NovaLoadingScreen from './saas/brand/NovaLoadingScreen';
import { fetchRuntimeFeatureFlags } from './shared/runtimeFeatureFlags';
import { resolvePostLoginPath } from './saas/marketing/marketingRedirects';
import {
  hydrateMarketingSiteFlagFromBridge,
  isMarketingSiteUiEnabled,
} from './saas/marketing/sanitizeMarketingNext';
import { isWorkbenchBetaPath } from './saas/workbench-beta/betaRoute';
import { isWorkbenchBeta11Enabled } from './saas/workbench-beta/flags/workbenchBetaFlags';

// PD-SAAS-FORK: post-login chunks — preload starts on /login; same promise as lazy().
const AppShellV2 = AppShellV2Lazy;
// PD-SAAS-FORK: parallel Beta workbench — not preloaded on login
const WorkbenchBetaShellLazy = lazy(() => import('./saas/workbench-beta/WorkbenchBetaShell'));
const SaasAdminRoutes = lazy(() =>
  import('./saas/routes').then((module) => ({ default: module.SaasAdminRoutes })),
);
const MarkdownSharePage = lazy(() => import('./pages/MarkdownSharePage'));
const PublicShareHandoffPage = lazy(() => import('./pages/PublicShareHandoffPage'));
const MdBrowserPage = lazy(() => import('./pages/MdBrowserPage'));
const N2BotToolPage = lazy(() => import('./pages/N2BotToolPage'));

function AppShellFallback() {
  const { t } = useTranslation('common');
  if (IS_SAAS_MODE) {
    return <WorkspaceSyncScreen />;
  }
  return (
    <NovaLoadingScreen
      label={t('boot.entering')}
      ariaLabel={t('boot.entering')}
    />
  );
}

/** WebSocket / plugins / tasks — only needed after login, not on auth pages. */
/** PD-SAAS-FORK: 登录后拉取 Bridge 运行时 flag，覆盖 Vite 构建默认值 */
function RuntimeFeatureFlagsLoader() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    void fetchRuntimeFeatureFlags();
  }, [isLoading, user]);

  return null;
}

function SaasAppProviders({ children }: { children: ReactNode }) {
  return (
    <WebSocketProvider>
      <PluginsProvider>
        <TasksSettingsProvider>
          <TaskMasterProvider>
            <RuntimeFeatureFlagsLoader />
            {children}
          </TaskMasterProvider>
        </TasksSettingsProvider>
      </PluginsProvider>
    </WebSocketProvider>
  );
}

function SaasLoginRoute() {
  const { user, isLoading } = useAuth();
  const { isMobile } = useDeviceSettings({ mobileBreakpoint: MOBILE_SHELL_BREAKPOINT_PX, trackPWA: false });

  useEffect(() => {
    preloadWorkspaceShell();
    void hydrateMarketingSiteFlagFromBridge();
  }, []);

  // PD-SAAS-FORK: render login immediately; redirect only after auth check confirms a session.
  // When marketing site is on, desktop home is `/app` (static `/` is the product site).
  if (!isLoading && user) {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const home = resolvePostLoginPath({
      marketingEnabled: isMarketingSiteUiEnabled(),
      isMobile,
      nextRaw: params.get('next'),
    });
    return <Navigate to={home} replace />;
  }
  return <SaasAuthPage />;
}

function SaasMarkdownShareRoute() {
  return (
    <SaasAppProviders>
      <SaasProtectedRoute>
        <Suspense fallback={<AppShellFallback />}>
          <MarkdownSharePage />
        </Suspense>
      </SaasProtectedRoute>
    </SaasAppProviders>
  );
}

function SaasMdBrowserRoute() {
  return (
    <SaasAppProviders>
      <SaasProtectedRoute>
        <Suspense fallback={<AppShellFallback />}>
          <MdBrowserPage />
        </Suspense>
      </SaasProtectedRoute>
    </SaasAppProviders>
  );
}

function SaasN2BotRoute() {
  return (
    <SaasAppProviders>
      <SaasProtectedRoute>
        <Suspense fallback={<AppShellFallback />}>
          <N2BotToolPage />
        </Suspense>
      </SaasProtectedRoute>
    </SaasAppProviders>
  );
}

/** PD-SAAS-FORK: /app-1.1-beta → Beta shell; else unchanged AppShellV2 */
function WorkspaceShellSwitch() {
  const location = useLocation();
  const canonical = stripMobileRoutePrefix(location.pathname);
  if (isWorkbenchBetaPath(canonical) && isWorkbenchBeta11Enabled()) {
    return (
      <Suspense fallback={<AppShellFallback />}>
        <WorkbenchBetaShellLazy />
      </Suspense>
    );
  }
  if (isWorkbenchBetaPath(canonical) && !isWorkbenchBeta11Enabled()) {
    // PD-SAAS-FORK: flag off → leave beta URL; preserve /m shell
    return (
      <Navigate
        to={isMobileRoutePath(location.pathname) ? '/m' : '/app'}
        replace
      />
    );
  }
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShellV2 />
    </Suspense>
  );
}

function SaasAppShellRoute() {
  return (
    <SaasAppProviders>
      <SaasProtectedRoute>
        <StorageSyncProvider>
          <ErrorBoundary showDetails>
            <WorkspaceShellSwitch />
          </ErrorBoundary>
        </StorageSyncProvider>
      </SaasProtectedRoute>
    </SaasAppProviders>
  );
}

function SaasAdminRoute() {
  return (
    <SaasAppProviders>
      <Suspense fallback={<AppShellFallback />}>
        <SaasAdminRoutes />
      </Suspense>
    </SaasAppProviders>
  );
}

function SaasRouterTree() {
  return (
    <Router basename={window.__ROUTER_BASENAME__ || ''}>
      <Routes>
        <Route
          path="/login"
          element={(
            <>
              <MobileBrowserRedirect />
              <SaasLoginRoute />
            </>
          )}
        />
        <Route
          path="/m/login"
          element={(
            <>
              <MobileBrowserRedirect />
              <SaasLoginRoute />
            </>
          )}
        />
        <Route path="/admin/*" element={<SaasAdminRoute />} />
        <Route path="/m/admin/*" element={<SaasAdminRoute />} />
        <Route path="/share/markdown" element={<SaasMarkdownShareRoute />} />
        <Route path="/m/share/markdown" element={<SaasMarkdownShareRoute />} />
        {/* PD-SAAS-FORK: public markdown share SSR — never enter AppShell */}
        <Route
          path="/s/*"
          element={(
            <Suspense fallback={null}>
              <PublicShareHandoffPage />
            </Suspense>
          )}
        />
        {/* PD-SAAS-FORK: Cherry Markdown Core 独立工具（Hub 插件新窗外开） */}
        <Route path="/tools/md-browser" element={<SaasMdBrowserRoute />} />
        <Route path="/m/tools/md-browser" element={<SaasMdBrowserRoute />} />
        {/* PD-SAAS-FORK: N2 Bot β HUD popout / mobile full page */}
        <Route path="/tools/n2-bot" element={<SaasN2BotRoute />} />
        <Route path="/m/tools/n2-bot" element={<SaasN2BotRoute />} />
        {/* PD-SAAS-FORK: parallel Beta workbench (before /app so paths do not collide) */}
        <Route
          path="/app-1.1-beta/*"
          element={(
            <>
              <MobileBrowserRedirect />
              <SaasAppShellRoute />
            </>
          )}
        />
        {/* PD-SAAS-FORK: `/app` is the desktop workspace entry when marketing site owns `/` */}
        <Route
          path="/app/*"
          element={(
            <>
              <MobileBrowserRedirect />
              <SaasAppShellRoute />
            </>
          )}
        />
        <Route
          path="/m/*"
          element={(
            <>
              <MobileBrowserRedirect />
              <SaasAppShellRoute />
            </>
          )}
        />
        <Route
          path="*"
          element={(
            <>
              <MobileBrowserRedirect />
              <SaasAppShellRoute />
            </>
          )}
        />
      </Routes>
    </Router>
  );
}

function LegacyRouterTree() {
  return (
    <ProtectedRoute>
      <Router basename={window.__ROUTER_BASENAME__ || ''}>
        <Routes>
          <Route
            path="/share/markdown"
            element={(
              <ErrorBoundary showDetails>
                <Suspense fallback={<AppShellFallback />}>
                  <MarkdownSharePage />
                </Suspense>
              </ErrorBoundary>
            )}
          />
          <Route
            path="/m/share/markdown"
            element={(
              <ErrorBoundary showDetails>
                <Suspense fallback={<AppShellFallback />}>
                  <MarkdownSharePage />
                </Suspense>
              </ErrorBoundary>
            )}
          />
          <Route
            path="/tools/md-browser"
            element={(
              <ErrorBoundary showDetails>
                <Suspense fallback={<AppShellFallback />}>
                  <MdBrowserPage />
                </Suspense>
              </ErrorBoundary>
            )}
          />
          <Route
            path="/m/tools/md-browser"
            element={(
              <ErrorBoundary showDetails>
                <Suspense fallback={<AppShellFallback />}>
                  <MdBrowserPage />
                </Suspense>
              </ErrorBoundary>
            )}
          />
          <Route
            path="/tools/n2-bot"
            element={(
              <ErrorBoundary showDetails>
                <Suspense fallback={<AppShellFallback />}>
                  <N2BotToolPage />
                </Suspense>
              </ErrorBoundary>
            )}
          />
          <Route
            path="/m/tools/n2-bot"
            element={(
              <ErrorBoundary showDetails>
                <Suspense fallback={<AppShellFallback />}>
                  <N2BotToolPage />
                </Suspense>
              </ErrorBoundary>
            )}
          />
          <Route
            path="/app-1.1-beta/*"
            element={(
              <>
                <MobileBrowserRedirect />
                <ErrorBoundary showDetails>
                  <WorkspaceShellSwitch />
                </ErrorBoundary>
              </>
            )}
          />
          <Route
            path="/m/*"
            element={(
              <>
                <MobileBrowserRedirect />
                <ErrorBoundary showDetails>
                  <WorkspaceShellSwitch />
                </ErrorBoundary>
              </>
            )}
          />
          <Route
            path="*"
            element={(
              <>
                <MobileBrowserRedirect />
                <ErrorBoundary showDetails>
                  <WorkspaceShellSwitch />
                </ErrorBoundary>
              </>
            )}
          />
        </Routes>
      </Router>
    </ProtectedRoute>
  );
}

function LegacyAppProviders({ children }: { children: ReactNode }) {
  return (
    <WebSocketProvider>
      <PluginsProvider>
        <TasksSettingsProvider>
          <TaskMasterProvider>
            <RuntimeFeatureFlagsLoader />
            {children}
          </TaskMasterProvider>
        </TasksSettingsProvider>
      </PluginsProvider>
    </WebSocketProvider>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          {IS_SAAS_MODE ? (
            <SaasRouterTree />
          ) : (
            <LegacyAppProviders>
              <LegacyRouterTree />
            </LegacyAppProviders>
          )}
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
