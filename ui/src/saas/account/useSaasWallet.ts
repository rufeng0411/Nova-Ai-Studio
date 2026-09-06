import { useCallback, useEffect, useState } from 'react';
import { saasApi, type SaasWallet } from '../api/saasApi';

export function useSaasWallet() {
  const [wallet, setWallet] = useState<SaasWallet | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await saasApi.billingWallet();
      if (response.ok) {
        setWallet(await response.json());
      }
    } catch {
      // optional UI chrome
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { wallet, loading, refresh };
}
