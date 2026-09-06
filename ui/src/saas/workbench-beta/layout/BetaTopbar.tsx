// PD-SAAS-FORK: Beta topbar marker — stamps tab testids under Beta surface
import { useEffect, type ReactNode } from 'react';

const TAB_HINTS: Array<{ testid: string; match: RegExp }> = [
  { testid: 'wb-beta-tab-chat', match: /对话|chat/i },
  // Match 能力中心 only — never welcome mode-toggle「能力」
  { testid: 'wb-beta-tab-discover', match: /发现|discover|能力中心/i },
  { testid: 'wb-beta-tab-files', match: /文件|files/i },
  { testid: 'wb-beta-tab-dashboard', match: /用量|usage|dashboard/i },
  { testid: 'wb-beta-tab-memory', match: /记忆|memory/i },
  { testid: 'wb-beta-tab-always-on', match: /计划|always|常驻/i },
];

export function useBetaTopbarAnchors(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.querySelector('[data-workbench-beta="1"]');
    if (!root) return;

    const stamp = () => {
      // Only stamp AppShell header tabs — never welcome mode-toggle / sidebar / composer.
      const header = root.querySelector('header');
      if (!(header instanceof HTMLElement)) return;
      const tabs = header.querySelectorAll('[role="tab"], nav a, button');
      tabs.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const existing = node.getAttribute('data-testid') || '';
        if (existing.startsWith('wb-beta-')) return;
        const label = `${node.getAttribute('aria-label') || ''} ${node.textContent || ''}`.trim();
        for (const hint of TAB_HINTS) {
          if (hint.match.test(label)) {
            node.setAttribute('data-testid', hint.testid);
            break;
          }
        }
      });
    };

    stamp();
    const obs = new MutationObserver(stamp);
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [enabled]);
}

export default function BetaTopbar({ children }: { children?: ReactNode }) {
  useBetaTopbarAnchors(true);
  return (
    <div data-testid="wb-beta-topbar" className="contents">
      {children}
    </div>
  );
}
