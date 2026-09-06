// PD-SAAS-FORK: optional SuperPreview HTML Studio feature gate
const STORAGE_KEY = 'pilotdeck-html-studio-enabled';
const CHANGE_EVENT = 'pilotdeck:html-studio-enabled-changed';

export function isHtmlStudioBuildDisabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PILOTDECK_HTML_STUDIO === '0') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.PILOTDECK_HTML_STUDIO === '0') {
    return true;
  }
  return false;
}

export function isHtmlStudioEnabled(): boolean {
  if (isHtmlStudioBuildDisabled()) return false;
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function setHtmlStudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled } }));
}

export function subscribeHtmlStudioEnabled(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
