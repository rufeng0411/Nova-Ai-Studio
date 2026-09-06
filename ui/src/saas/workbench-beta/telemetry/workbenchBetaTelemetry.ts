// PD-SAAS-FORK: beta UX telemetry — append-only local JSONL; never block UI

export type BetaTelemetryEvent =
  | 'beta_shell_mount'
  | 'beta_tour_step'
  | 'beta_turn_footer_copy'
  | 'beta_turn_footer_impression'
  | 'beta_next_impression'
  | 'beta_next_click'
  | 'beta_next_dismiss';

const STORAGE_KEY = 'wb-beta-11-telemetry-buffer';

export function emitBetaEvent(
  event: BetaTelemetryEvent,
  payload: Record<string, unknown> = {},
): void {
  try {
    const row = {
      ts: new Date().toISOString(),
      event,
      ...payload,
    };
    if (typeof window === 'undefined') return;
    const prev = window.sessionStorage.getItem(STORAGE_KEY);
    const list: unknown[] = prev ? (JSON.parse(prev) as unknown[]) : [];
    list.push(row);
    while (list.length > 200) list.shift();
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[workbench-beta]', event, payload);
    }
  } catch {
    /* ignore */
  }
}

export function readBetaTelemetryBuffer(): unknown[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown[]) : [];
  } catch {
    return [];
  }
}
