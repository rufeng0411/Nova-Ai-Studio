// PD-SAAS-FORK: parallel workbench shell at /app-1.1-beta — wraps AppShellV2 + Beta surface/tour

import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { isWorkbenchBeta11Enabled } from './flags/workbenchBetaFlags';
import { WorkbenchBetaSurfaceProvider } from './surface/WorkbenchBetaSurface';
import WorkbenchTour, { requestWorkbenchTourReplay } from './onboarding/WorkbenchTour';
import { emitBetaEvent } from './telemetry/workbenchBetaTelemetry';
import { applyBetaPwaMeta, restoreBetaPwaMeta } from './pwa/betaPwaMeta';
import { isMobileRoutePath } from '../../mobile/mobileRoute';
import WorkbenchBetaRoutes from './WorkbenchBetaRoutes';
import './theme/workbenchBetaTokens.css';

const AppShellV2 = lazy(() => import('../../components/app-shell/AppShellV2'));

export default function WorkbenchBetaShell() {
  const { t } = useTranslation('common');
  const location = useLocation();
  const theme = useTheme() as { theme?: string } | null;
  const [tourForce, setTourForce] = useState(0);
  const enabled = isWorkbenchBeta11Enabled();

  useEffect(() => {
    if (!enabled) return;
    emitBetaEvent('beta_shell_mount', {
      path: location.pathname,
      mobile: isMobileRoutePath(location.pathname),
    });
    const dark =
      theme?.theme === 'dark'
      || document.documentElement.classList.contains('dark')
      || document.documentElement.getAttribute('data-theme') === 'dark';
    applyBetaPwaMeta(!!dark);
    return () => restoreBetaPwaMeta();
  }, [enabled, location.pathname, theme?.theme]);

  useEffect(() => {
    const onReplay = () => setTourForce((n) => n + 1);
    window.addEventListener('pilotdeck:workbench-beta-tour-replay', onReplay);
    (window as unknown as { __wbBetaReplayTour?: () => void }).__wbBetaReplayTour =
      requestWorkbenchTourReplay;
    return () => {
      window.removeEventListener('pilotdeck:workbench-beta-tour-replay', onReplay);
      delete (window as unknown as { __wbBetaReplayTour?: () => void }).__wbBetaReplayTour;
    };
  }, []);

  if (!enabled) {
    return <Navigate to={isMobileRoutePath(location.pathname) ? '/m' : '/app'} replace />;
  }

  return (
    <div
      data-workbench-beta="1"
      data-palette="lavender"
      data-testid="wb-beta-shell"
      className="wb-beta-root h-full"
    >
      <div className="wb-beta-shell-banner" data-testid="wb-beta-banner">
        <span>{t('workbenchBeta.shell.title', '工作台 1.1 Beta')}</span>
        <button
          type="button"
          data-testid="wb-beta-replay-tour"
          onClick={() => requestWorkbenchTourReplay()}
        >
          {t('workbenchBeta.tour.replay', '重播新手引导')}
        </button>
      </div>
      <div className="wb-beta-shell-body">
        <WorkbenchBetaSurfaceProvider active>
          <WorkbenchBetaRoutes>
            <Suspense fallback={null}>
              <AppShellV2 />
            </Suspense>
          </WorkbenchBetaRoutes>
          <WorkbenchTour key={tourForce} forceOpen={tourForce > 0} />
        </WorkbenchBetaSurfaceProvider>
      </div>
    </div>
  );
}
