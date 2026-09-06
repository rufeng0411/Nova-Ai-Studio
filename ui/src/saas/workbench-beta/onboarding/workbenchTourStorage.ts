// PD-SAAS-FORK: tour local anti-flash + optional prefs sync

export const TOUR_LOCAL_KEY = 'wb-tour-v1-local';

export function isTourLocallyCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_LOCAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTourLocallyCompleted(skipped: boolean): void {
  try {
    localStorage.setItem(TOUR_LOCAL_KEY, '1');
    localStorage.setItem(`${TOUR_LOCAL_KEY}:skipped`, skipped ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function clearTourLocal(): void {
  try {
    localStorage.removeItem(TOUR_LOCAL_KEY);
    localStorage.removeItem(`${TOUR_LOCAL_KEY}:skipped`);
  } catch {
    /* ignore */
  }
}
