// PD-SAAS-FORK: optional SuperPreview HyperFrames Studio feature gate
const STORAGE_KEY = 'pilotdeck-hf-studio-enabled';
const CHANGE_EVENT = 'pilotdeck:hf-studio-enabled-changed';

export function isHfStudioBuildDisabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PILOTDECK_HF_STUDIO === '0') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.PILOTDECK_HF_STUDIO === '0') {
    return true;
  }
  return false;
}

export function isHfStudioEnabled(): boolean {
  if (isHfStudioBuildDisabled()) return false;
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1';
  } catch {
    return true;
  }
}

export function setHfStudioEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled } }));
}

export function subscribeHfStudioEnabled(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
