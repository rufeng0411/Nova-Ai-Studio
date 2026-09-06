// PD-SAAS-FORK: optional SuperPreview design canvas feature gate
const STORAGE_KEY = 'pilotdeck-design-canvas-enabled';
const CHANGE_EVENT = 'pilotdeck:design-canvas-enabled-changed';

export function isDesignCanvasBuildDisabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PILOTDECK_DESIGN_CANVAS === '0') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.PILOTDECK_DESIGN_CANVAS === '0') {
    return true;
  }
  return false;
}

export function isDesignCanvasEnabled(): boolean {
  if (isDesignCanvasBuildDisabled()) return false;
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function setDesignCanvasEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled } }));
}

export function subscribeDesignCanvasEnabled(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
