/**
 * PD-SAAS-FORK: Coordinates capability-hub search between MobileHeader (icon)
 * and CapabilityHub (query state) without prop-drilling through MainContent.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type HubSearchApi = {
  query: string;
  setQuery: (q: string) => void;
};

type MobileHubSearchContextValue = {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;
  hubSearch: HubSearchApi | null;
  registerHubSearch: (api: HubSearchApi | null) => void;
};

const MobileHubSearchContext = createContext<MobileHubSearchContextValue | null>(null);

type MobileHubSearchProviderProps = {
  children: ReactNode;
  enabled: boolean;
};

export function MobileHubSearchProvider({ children, enabled }: MobileHubSearchProviderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [hubSearch, setHubSearch] = useState<HubSearchApi | null>(null);

  const registerHubSearch = useCallback((api: HubSearchApi | null) => {
    setHubSearch(api);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSearchOpen(false);
    }
  }, [enabled]);

  const value = useMemo<MobileHubSearchContextValue>(
    () => ({
      searchOpen: enabled ? searchOpen : false,
      setSearchOpen,
      toggleSearch,
      hubSearch: enabled ? hubSearch : null,
      registerHubSearch: enabled ? registerHubSearch : () => {},
    }),
    [enabled, searchOpen, hubSearch, registerHubSearch, toggleSearch],
  );

  return (
    <MobileHubSearchContext.Provider value={value}>{children}</MobileHubSearchContext.Provider>
  );
}

export function useMobileHubSearch(): MobileHubSearchContextValue | null {
  return useContext(MobileHubSearchContext);
}
