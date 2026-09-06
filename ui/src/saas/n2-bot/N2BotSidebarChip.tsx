// PD-SAAS-FORK: N2 Bot β chip — official /app and Beta share SidebarV2 left-bottom.
import { useEffect, useRef, useState } from 'react';
import { isN2BotHudEnabled, subscribeRuntimeFeatureFlags } from '../../shared/runtimeFeatureFlags';
import { selectN2ChipAttention, type ChipCatalogRow } from '../../../../src/saas/n2Bot/selectN2ChipAttention';
import { authenticatedFetch } from '../../utils/api';
import { openN2Bot } from './n2BotOpen';
import './n2BotChip.css';

function collectChipRows(root: HTMLElement): ChipCatalogRow[] {
  const rows: ChipCatalogRow[] = [];
  root.querySelectorAll('[data-session-id], button[data-session-id]').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const sessionId = el.getAttribute('data-session-id');
    if (!sessionId) return;
    rows.push({
      sessionId,
      executionStatus: el.getAttribute('data-execution-status'),
      needsYou: el.getAttribute('data-needs-you') === '1',
    });
  });
  return rows;
}

export default function N2BotSidebarChip() {
  const [enabled, setEnabled] = useState(() => isN2BotHudEnabled());
  const [attention, setAttention] = useState<'idle' | 'active' | 'needs_you'>('idle');
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const prefetched = useRef(false);

  useEffect(() => subscribeRuntimeFeatureFlags(() => setEnabled(isN2BotHudEnabled())), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const sync = () => {
      const aside = rootRef.current?.closest('aside');
      if (!(aside instanceof HTMLElement)) return;
      setAttention(selectN2ChipAttention(collectChipRows(aside)));
    };
    sync();
    const aside = rootRef.current?.closest('aside');
    if (!(aside instanceof HTMLElement)) return undefined;
    const obs = new MutationObserver(() => {
      window.requestAnimationFrame(sync);
    });
    obs.observe(aside, { childList: true, subtree: true, attributes: true });
    return () => obs.disconnect();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="px-2 pt-2" data-n2-bot-chip-wrap="1">
      <button
        ref={rootRef}
        type="button"
        className="n2b-chip"
        data-testid="n2-bot-sidebar-entry"
        aria-label="N2 Bot"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            if (window.location.pathname.includes('/m')) {
              window.location.href = '/m/tools/n2-bot';
              return;
            }
            openN2Bot();
          } catch {
            window.dispatchEvent(new CustomEvent('n2-bot:overlay-open'));
          }
        }}
        onMouseEnter={() => {
          if (prefetched.current) return;
          prefetched.current = true;
          void import('./N2BotHudPage');
          void import('./n2BotGreetingCache').then((mod) => {
            void mod.prefetchNovaVoice('我是 Nova。要做啥直接说。');
          });
          void authenticatedFetch('/api/saas/n2-bot/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
        }}
      >
        <span
          className={`n2b-chip-orb${attention === 'active' ? ' is-active' : ''}${
            attention === 'needs_you' ? ' is-needs_you' : ''
          }`}
          data-n2-chip-orb
        />
        <span>N2 Bot</span>
        <span className="n2b-chip-beta">β</span>
      </button>
    </div>
  );
}
