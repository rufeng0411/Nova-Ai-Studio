import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../components/auth/context/AuthContext';
import AuthLoadingScreen from '../../components/auth/view/AuthLoadingScreen';
// PD-SAAS-FORK: unauthenticated visitors — marketing site prefer full-page `/?next=` when flag on.
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { MOBILE_SHELL_BREAKPOINT_PX } from '../../mobile/mobileRoute';
import { resolveUnauthRedirect } from '../marketing/marketingRedirects';
import { getRuntimeFeatureFlags } from '../../shared/runtimeFeatureFlags';
import {
  hydrateMarketingSiteFlagFromBridge,
  isMarketingSiteUiEnabled,
  sanitizeMarketingNext,
} from '../marketing/sanitizeMarketingNext';

type SaasProtectedRouteProps = {
  children: ReactNode;
};

function readMarketingFlag(): boolean {
  if (getRuntimeFeatureFlags()?.marketingSite === true) return true;
  return isMarketingSiteUiEnabled();
}

/** SPA is handling `/` → Bridge marketing HTML is NOT being served (typical Vite :8081). */
function isSpaAtRootPath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

function buildSpaRootLoginTarget(search: string): string {
  const q = new URLSearchParams({ from: 'site' });
  try {
    const fromQuery = new URLSearchParams(search || '').get('next');
    const safe = sanitizeMarketingNext(fromQuery);
    if (safe) q.set('next', safe);
  } catch {
    /* ignore */
  }
  return `/login?${q.toString()}`;
}

export default function SaasProtectedRoute({ children }: SaasProtectedRouteProps) {
  const { user, isLoading, needsSetup } = useAuth();
  const location = useLocation();
  const { isMobile } = useDeviceSettings({
    mobileBreakpoint: MOBILE_SHELL_BREAKPOINT_PX,
    trackPWA: false,
  });
  const [marketingOn, setMarketingOn] = useState(readMarketingFlag);
  const [flagReady, setFlagReady] = useState(
    () => isMarketingSiteUiEnabled() || getRuntimeFeatureFlags() != null,
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateMarketingSiteFlagFromBridge().then((on) => {
      if (cancelled) return;
      setMarketingOn(on || readMarketingFlag());
      setFlagReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const spaAtRoot = isSpaAtRootPath(location.pathname);
  const unauthTarget = resolveUnauthRedirect({
    marketingEnabled: marketingOn,
    isMobile,
    fromPath: location.pathname,
    search: location.search,
  });

  // Full page hop to static marketing HTML (Bridge-served `/`), not SPA Navigate.
  useEffect(() => {
    if (!flagReady || isLoading || user || needsSetup || !marketingOn) return;
    if (typeof window === 'undefined') return;

    // Vite (and any host where SPA owns `/`): never wait on marketing HTML that isn't there.
    if (spaAtRoot) {
      const loginTarget = buildSpaRootLoginTarget(location.search);
      if (`${window.location.pathname}${window.location.search}` !== loginTarget) {
        window.location.replace(loginTarget);
      }
      return;
    }

    // Bridge: SPA routes like `/app` → marketing `/?next=/app`
    if (unauthTarget === '/' || unauthTarget.startsWith('/?')) {
      window.location.replace(unauthTarget);
    }
  }, [
    flagReady,
    isLoading,
    user,
    needsSetup,
    marketingOn,
    spaAtRoot,
    unauthTarget,
    location.search,
  ]);

  if (isLoading || (!user && !flagReady && !needsSetup)) {
    return <AuthLoadingScreen />;
  }

  if (needsSetup) {
    const setupLogin = isMobile ? '/m/login' : '/login';
    return <Navigate to={setupLogin} replace state={{ from: location }} />;
  }

  if (!user) {
    if (marketingOn) {
      // SPA at `/` (Vite): hard-Navigate to login — AuthLoadingScreen alone caused infinite wait.
      if (spaAtRoot) {
        return <Navigate to={buildSpaRootLoginTarget(location.search)} replace />;
      }
      return <AuthLoadingScreen />;
    }
    const loginPath = isMobile ? '/m/login' : '/login';
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  // PD-SAAS-FORK: 平台托管模型池，SaaS 成员不走 OSS 填 Key 引导
  return <>{children}</>;
}
