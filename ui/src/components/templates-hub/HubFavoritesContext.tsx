// PD-SAAS-FORK: user capability + workflow favorites (synced to control DB preferences_json)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IS_SAAS_MODE } from '../../constants/config';
import { saasApi } from '../../saas/api/saasApi';
import {
  emptyHubFavorites,
  HUB_FAVORITES_STORAGE_KEY,
  isHubFavoriteId,
  normalizeHubFavorites,
  toggleHubFavoriteId,
  type HubFavorites,
} from '../../shared/hubFavorites';

type HubFavoritesContextValue = {
  ready: boolean;
  capabilitySlugs: string[];
  templateIds: string[];
  isCapabilityFavorite: (slug: string) => boolean;
  isTemplateFavorite: (id: string) => boolean;
  toggleCapabilityFavorite: (slug: string) => void;
  toggleTemplateFavorite: (id: string) => void;
};

const HubFavoritesContext = createContext<HubFavoritesContextValue | null>(null);

function readLocalHubFavorites(): HubFavorites {
  if (typeof window === 'undefined') return emptyHubFavorites();
  try {
    const raw = localStorage.getItem(HUB_FAVORITES_STORAGE_KEY);
    if (!raw) return emptyHubFavorites();
    return normalizeHubFavorites(JSON.parse(raw));
  } catch {
    return emptyHubFavorites();
  }
}

function writeLocalHubFavorites(next: HubFavorites) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HUB_FAVORITES_STORAGE_KEY, JSON.stringify(next));
}

async function persistHubFavoritesToServer(next: HubFavorites): Promise<void> {
  if (!IS_SAAS_MODE) return;
  try {
    await saasApi.updatePreferences({ hubFavorites: next });
  } catch {
    // localStorage remains usable offline / transient errors
  }
}

export function HubFavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<HubFavorites>(() => readLocalHubFavorites());
  const [ready, setReady] = useState(!IS_SAAS_MODE);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!IS_SAAS_MODE) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const hydrate = async () => {
      try {
        const res = await saasApi.getPreferences();
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { preferences?: { hubFavorites?: unknown } };
        const serverFavorites = normalizeHubFavorites(data.preferences?.hubFavorites);
        setFavorites(serverFavorites);
        writeLocalHubFavorites(serverFavorites);
      } catch {
        // keep local cache
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const schedulePersist = useCallback((next: HubFavorites) => {
    writeLocalHubFavorites(next);
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      void persistHubFavoritesToServer(next);
    }, 250);
  }, []);

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const applyToggle = useCallback(
    (kind: 'capabilities' | 'templates', id: string) => {
      setFavorites((prev) => {
        const nextList = toggleHubFavoriteId(prev[kind], id);
        const next: HubFavorites = {
          ...prev,
          [kind]: nextList,
        };
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const value = useMemo<HubFavoritesContextValue>(
    () => ({
      ready,
      capabilitySlugs: favorites.capabilities,
      templateIds: favorites.templates,
      isCapabilityFavorite: (slug) => isHubFavoriteId(favorites.capabilities, slug),
      isTemplateFavorite: (id) => isHubFavoriteId(favorites.templates, id),
      toggleCapabilityFavorite: (slug) => applyToggle('capabilities', slug),
      toggleTemplateFavorite: (id) => applyToggle('templates', id),
    }),
    [applyToggle, favorites.capabilities, favorites.templates, ready],
  );

  return <HubFavoritesContext.Provider value={value}>{children}</HubFavoritesContext.Provider>;
}

export function useHubFavorites(): HubFavoritesContextValue {
  const ctx = useContext(HubFavoritesContext);
  if (!ctx) {
    throw new Error('useHubFavorites must be used within HubFavoritesProvider');
  }
  return ctx;
}

export function useHubFavoritesOptional(): HubFavoritesContextValue | null {
  return useContext(HubFavoritesContext);
}
