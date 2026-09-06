// PD-SAAS-FORK: same-tab full HUD overlay when popout is blocked.
import { lazy, Suspense, useEffect, useState } from 'react';
import ErrorBoundary from '../../components/main-content/view/ErrorBoundary';
import { isN2BotHudEnabled, subscribeRuntimeFeatureFlags } from '../../shared/runtimeFeatureFlags';

const N2BotHudPage = lazy(() => import('./N2BotHudPage'));

export default function N2BotOverlayHost() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => isN2BotHudEnabled());

  useEffect(() => subscribeRuntimeFeatureFlags(() => setEnabled(isN2BotHudEnabled())), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onOffer = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string; title?: string }>).detail;
      const sessionId = detail?.sessionId;
      if (!sessionId) return;
      const composer = document.querySelector(
        'textarea, [data-testid="chat-composer"] textarea, [data-composer] textarea',
      );
      const busy = Boolean(
        (composer instanceof HTMLTextAreaElement && composer.value.trim())
        || document.querySelector('[data-loading="true"], [aria-busy="true"]'),
      );
      if (busy) {
        const aside = document.querySelector('[data-sidebar-v2-root]');
        if (aside instanceof HTMLElement) {
          let note = aside.querySelector('[data-testid="n2-bot-offer-open"]');
          if (!note) {
            note = document.createElement('div');
            note.setAttribute('data-testid', 'n2-bot-offer-open');
            note.style.cssText = 'font-size:11px;opacity:.55;padding:4px 8px';
            aside.appendChild(note);
          }
          note.textContent = `N2 Bot 想打开：${detail?.title || sessionId}`;
        }
        return;
      }
      const row = document.querySelector(`[data-session-id="${CSS.escape(sessionId)}"]`);
      if (row instanceof HTMLElement) row.click();
    };
    window.addEventListener('n2-bot:overlay-open', onOpen);
    window.addEventListener('keydown', onKey);
    window.addEventListener('n2-bot:offer-open', onOffer);
    return () => {
      window.removeEventListener('n2-bot:overlay-open', onOpen);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('n2-bot:offer-open', onOffer);
    };
  }, []);

  if (!enabled || !open) return null;
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <N2BotHudPage overlay onClose={() => setOpen(false)} />
      </Suspense>
    </ErrorBoundary>
  );
}
