/** PD-SAAS-FORK: weak toast for ambiguous deliverable paths (no red error bar). */
export const GENTLE_TOAST_EVENT = 'nova:gentle-toast';

export type GentleToastDetail = {
  text: string;
  kind?: 'info' | 'success';
};

export function showGentleToast(text: string, kind: GentleToastDetail['kind'] = 'info'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GENTLE_TOAST_EVENT, { detail: { text, kind } }));
}
