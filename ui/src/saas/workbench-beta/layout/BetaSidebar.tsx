// PD-SAAS-FORK: Demo chrome on SidebarV2 — inject「＋ 新对话」/ tool-row / account pill (no SidebarV2 rewrite)

import { useEffect, type ReactNode } from 'react';
import { subscribeRuntimeFeatureFlags } from '../../../shared/runtimeFeatureFlags';

const TOOL_SVGS: Record<string, string> = {
  settings:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  usage:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-4"/><path d="M12 15V8"/><path d="M16 15v-6"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  plans:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

function clickTopTabByLabels(root: Element, labels: string[]): boolean {
  const tabs = root.querySelectorAll('header [role="tab"], header button[role="tab"]');
  for (const tab of tabs) {
    if (!(tab instanceof HTMLElement)) continue;
    const text = `${tab.textContent || ''} ${tab.getAttribute('aria-label') || ''}`;
    if (labels.some((l) => text.includes(l))) {
      tab.click();
      return true;
    }
  }
  return false;
}

function openSidebarSettings(aside: HTMLElement): void {
  const accountBtn = aside.querySelector(
    '[data-testid="saas-sidebar-account"] button[aria-haspopup="menu"]',
  );
  if (!(accountBtn instanceof HTMLElement)) return;
  accountBtn.click();
  window.setTimeout(() => {
    const items = aside.querySelectorAll('[data-testid="saas-sidebar-account"] [role="menuitem"]');
    for (const item of items) {
      if (!(item instanceof HTMLElement)) continue;
      if (/设置|Settings/i.test(item.textContent || '')) {
        item.click();
        return;
      }
    }
  }, 40);
}

function ensureToolRow(aside: HTMLElement, root: Element): void {
  if (aside.querySelector('.wb-beta-tool-row')) {
    return;
  }
  const account = aside.querySelector('[data-testid="saas-sidebar-account"]');
  if (!(account instanceof HTMLElement)) return;

  const foot = document.createElement('div');
  foot.className = 'wb-beta-sidebar-foot';
  foot.setAttribute('data-testid', 'wb-beta-sidebar-foot');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'wb-beta-sess-search';
  searchWrap.hidden = true;
  searchWrap.setAttribute('data-testid', 'wb-beta-sess-search');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = '搜索对话…';
  searchInput.autocomplete = 'off';
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const rows = aside.querySelectorAll('[class*="group/session"], button[data-session-id]');
    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const hit = !q || (row.textContent || '').toLowerCase().includes(q);
      row.classList.toggle('wb-beta-session-dim', !hit);
    });
  });
  searchWrap.appendChild(searchInput);

  const row = document.createElement('div');
  row.className = 'wb-beta-tool-row';
  row.setAttribute('aria-label', '快捷入口');
  row.setAttribute('data-testid', 'wb-beta-tool-row');

  const tools: Array<{ id: string; title: string; onClick: () => void }> = [
    {
      id: 'settings',
      title: '设置',
      onClick: () => openSidebarSettings(aside),
    },
    {
      id: 'usage',
      title: '用量',
      onClick: () => {
        clickTopTabByLabels(root, ['用量', 'Usage', 'Dashboard']);
      },
    },
    {
      id: 'search',
      title: '搜索对话',
      onClick: () => {
        searchWrap.hidden = !searchWrap.hidden;
        if (!searchWrap.hidden) searchInput.focus();
      },
    },
    {
      id: 'plans',
      title: '计划任务',
      onClick: () => {
        clickTopTabByLabels(root, ['计划任务', '计划', 'Always', '常驻']);
      },
    },
  ];

  for (const tool of tools) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wb-beta-tool-sq';
    btn.title = tool.title;
    btn.setAttribute('aria-label', tool.title);
    btn.dataset.tool = tool.id;
    btn.innerHTML = TOOL_SVGS[tool.id] || '';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      tool.onClick();
    });
    row.appendChild(btn);
  }

  foot.appendChild(searchWrap);
  foot.appendChild(row);
  account.parentElement?.insertBefore(foot, account);
}

function ensureAdminBadge(account: HTMLElement): void {
  const pill = account.querySelector('button[aria-haspopup="menu"]');
  if (!(pill instanceof HTMLElement)) return;
  pill.classList.add('wb-beta-account-pill');
  if (pill.querySelector('.wb-beta-admin-badge')) return;
  const adminEntry = account.querySelector('[data-testid="saas-admin-entry"]');
  if (!adminEntry) return;
  const badge = document.createElement('span');
  badge.className = 'wb-beta-admin-badge';
  badge.textContent = 'ADMIN';
  pill.appendChild(badge);
}

/** Stamp Demo-like full-width new-chat, tool-row, account pill under Beta. */
export function useBetaSidebarAnchors(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.querySelector('[data-workbench-beta="1"]');
    if (!root) return;

    const stamp = () => {
      const aside = root.querySelector('[data-sidebar-v2-root]');
      if (!(aside instanceof HTMLElement)) return;
      aside.setAttribute('data-beta-sidebar', '1');

      const natives = aside.querySelectorAll('button');
      natives.forEach((btn) => {
        if (
          btn.classList.contains('wb-beta-new-chat-full')
          || btn.classList.contains('wb-beta-new-project-full')
        ) {
          return;
        }
        const label = `${btn.getAttribute('aria-label') || ''} ${btn.getAttribute('title') || ''}`;
        if (/新对话|New\s*Chat/i.test(label)) {
          btn.setAttribute('data-wb-beta-native-newchat', '1');
          if (!btn.getAttribute('data-testid')) {
            btn.setAttribute('data-testid', 'wb-beta-new-chat-native');
          }
        }
        if (/新建项目|New\s*Project/i.test(label)) {
          btn.setAttribute('data-wb-beta-native-newproject', '1');
          if (!btn.getAttribute('data-testid')) {
            btn.setAttribute('data-testid', 'wb-beta-new-project-native');
          }
        }
      });

      const tablist = aside.querySelector('[role="tablist"]');
      const host = tablist?.parentElement;
      const projectsTabOn = Boolean(
        aside.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.match(/项目|Projects/i),
      );

      if (host && !aside.querySelector('.wb-beta-new-chat-full')) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wb-beta-new-chat-full';
        btn.id = 'beta-new-chat';
        btn.setAttribute('data-testid', 'wb-beta-new-chat');
        btn.textContent = '＋ 新对话';
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          // Native icon is display:none under Beta — React onClick won't fire via .click().
          window.dispatchEvent(new CustomEvent('pilotdeck:workbench-beta-new-chat'));
        });
        host.insertAdjacentElement('afterend', btn);
      }

      // Demo chrome hid the in-list header row (incl. +新建项目) — restore via full-width control.
      const newChatEl = aside.querySelector('.wb-beta-new-chat-full');
      let newProjectEl = aside.querySelector('.wb-beta-new-project-full');
      if (projectsTabOn) {
        if (!newProjectEl && newChatEl) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'wb-beta-new-project-full';
          btn.id = 'beta-new-project';
          btn.setAttribute('data-testid', 'wb-beta-new-project');
          btn.textContent = '＋ 新建项目';
          btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent('pilotdeck:workbench-beta-new-project'));
          });
          newChatEl.insertAdjacentElement('afterend', btn);
          newProjectEl = btn;
        }
      } else if (newProjectEl) {
        newProjectEl.remove();
      }

      const scroll = aside.querySelector('.scrollbar-thin');
      const sectionLabelText = projectsTabOn ? '项目' : '最近对话';
      let sectionLabel = aside.querySelector('.wb-beta-section-label');
      if (scroll instanceof HTMLElement && !sectionLabel) {
        sectionLabel = document.createElement('div');
        sectionLabel.className = 'wb-beta-section-label';
        scroll.insertAdjacentElement('beforebegin', sectionLabel);
      }
      if (sectionLabel instanceof HTMLElement) {
        sectionLabel.textContent = sectionLabelText;
      }

      ensureToolRow(aside, root);

      const account = aside.querySelector('[data-testid="saas-sidebar-account"]');
      if (account instanceof HTMLElement) {
        account.setAttribute('data-beta-account-pill', '1');
        ensureAdminBadge(account);
      }
    };

    stamp();
    const unsubFlags = subscribeRuntimeFeatureFlags(() => stamp());
    const obs = new MutationObserver(() => {
      // Debounce via rAF so React re-renders don't thrash.
      window.requestAnimationFrame(stamp);
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => {
      unsubFlags();
      obs.disconnect();
      root.querySelectorAll('.wb-beta-section-label').forEach((n) => n.remove());
      root.querySelectorAll('.wb-beta-new-chat-full').forEach((n) => n.remove());
      root.querySelectorAll('.wb-beta-new-project-full').forEach((n) => n.remove());
      root.querySelectorAll('.wb-beta-sidebar-foot').forEach((n) => n.remove());
      root.querySelectorAll('.wb-beta-admin-badge').forEach((n) => n.remove());
    };
  }, [enabled]);
}

export default function BetaSidebar({ children }: { children?: ReactNode }) {
  useBetaSidebarAnchors(true);
  return (
    <div data-testid="wb-beta-sidebar" data-beta-sidebar="1" className="contents">
      {children}
    </div>
  );
}
