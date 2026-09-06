// PD-SAAS-FORK: open N2 Bot as named popout, else same-tab overlay. Never location.assign.

export const N2_BOT_WINDOW_NAME = 'n2-bot';

let namedPopout: Window | null = null;

export function buildN2BotHref(): string {
  const prefix = window.location.pathname.startsWith('/m') ? '/m' : '';
  return `${prefix}/tools/n2-bot`;
}

export type OpenN2BotResult = { mode: 'popout' | 'overlay' | 'focus' };

export function openN2BotWindow(): Window | null {
  const href = `${window.location.origin}${buildN2BotHref()}`;
  return window.open(href, N2_BOT_WINDOW_NAME, 'width=1280,height=800');
}

export function requestN2BotOverlay(): void {
  window.dispatchEvent(new CustomEvent('n2-bot:overlay-open'));
}

export function openN2Bot(): OpenN2BotResult {
  try {
    if (namedPopout && !namedPopout.closed) {
      try {
        namedPopout.focus();
      } catch {
        // ignore
      }
      return { mode: 'focus' };
    }
    const win = openN2BotWindow();
    if (win) {
      namedPopout = win;
      try {
        win.focus();
      } catch {
        // ignore
      }
      return { mode: 'popout' };
    }
    requestN2BotOverlay();
    return { mode: 'overlay' };
  } catch {
    requestN2BotOverlay();
    return { mode: 'overlay' };
  }
}

export function offerOpenWorkerSession(input: { sessionId: string; title: string }): void {
  window.dispatchEvent(new CustomEvent('n2-bot:offer-open', { detail: input }));
}
