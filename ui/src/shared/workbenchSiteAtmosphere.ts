/**
 * PD-SAAS-FORK: preview overlay of marketing homepage hero-glow / hero-grid on workbench.
 * Instant rollback (no rebuild):
 *   localStorage.setItem('pilotdeck.workbenchSiteAtmosphere', '0'); location.reload()
 * Or URL: ?siteAtmosphere=0
 * Re-enable: localStorage '1' / ?siteAtmosphere=1
 */
const STORAGE_KEY = 'pilotdeck.workbenchSiteAtmosphere';
const CHANGE_EVENT = 'pilotdeck:workbench-site-atmosphere-changed';

function parseTriState(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = String(raw).trim().toLowerCase();
  if (value === '0' || value === 'false' || value === 'off') return false;
  if (value === '1' || value === 'true' || value === 'on') return true;
  return null;
}

export function isWorkbenchSiteAtmosphereEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const query = parseTriState(new URLSearchParams(window.location.search).get('siteAtmosphere'));
      if (query !== null) return query;
    } catch {
      // ignore malformed URL
    }
    try {
      const stored = parseTriState(window.localStorage.getItem(STORAGE_KEY));
      if (stored !== null) return stored;
    } catch {
      // ignore private mode
    }
  }

  const vite = parseTriState(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WORKBENCH_SITE_ATMOSPHERE : undefined,
  );
  if (vite !== null) return vite;

  // Default OFF — homepage atmosphere preview rolled back.
  return false;
}

export function setWorkbenchSiteAtmosphereEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { enabled } }));
}

export function subscribeWorkbenchSiteAtmosphere(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function installWorkbenchSiteAtmosphereDevHelpers(): void {
  if (typeof window === 'undefined') return;
  const host = window as Window & {
    __novaWorkbenchAtmosphere?: {
      enable: () => void;
      disable: () => void;
      toggle: () => void;
      isEnabled: () => boolean;
    };
  };
  host.__novaWorkbenchAtmosphere = {
    enable: () => {
      setWorkbenchSiteAtmosphereEnabled(true);
      window.location.reload();
    },
    disable: () => {
      setWorkbenchSiteAtmosphereEnabled(false);
      window.location.reload();
    },
    toggle: () => {
      setWorkbenchSiteAtmosphereEnabled(!isWorkbenchSiteAtmosphereEnabled());
      window.location.reload();
    },
    isEnabled: () => isWorkbenchSiteAtmosphereEnabled(),
  };
}
