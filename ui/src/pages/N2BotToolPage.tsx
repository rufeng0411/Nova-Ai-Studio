import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '../components/main-content/view/ErrorBoundary';
import {
  getRuntimeFeatureFlags,
  isN2BotHudEnabled,
  subscribeRuntimeFeatureFlags,
} from '../shared/runtimeFeatureFlags';
import '../saas/n2-bot/n2BotHud.css';

const N2BotHudPage = lazy(() => import('../saas/n2-bot/N2BotHudPage'));

export default function N2BotToolPage() {
  const [enabled, setEnabled] = useState(() => isN2BotHudEnabled());
  const [hydrated, setHydrated] = useState(() => getRuntimeFeatureFlags() != null);

  useEffect(() => subscribeRuntimeFeatureFlags(() => {
    setEnabled(isN2BotHudEnabled());
    setHydrated(true);
  }), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const prev = document.title;
    document.title = 'N2 Bot β';
    return () => {
      document.title = prev;
    };
  }, [enabled]);

  if (!hydrated) return null;
  if (!enabled) {
    return <Navigate to="/app" replace />;
  }
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <div className="n2b-page-shell">
          <N2BotHudPage />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
