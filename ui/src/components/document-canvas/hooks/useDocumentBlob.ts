// PD-SAAS-FORK: fetch project file as ArrayBuffer with in-memory cache
import { useEffect, useState } from 'react';
import { api } from '../../../utils/api';

const bufferCache = new Map<string, ArrayBuffer>();

function cacheKey(projectName: string, apiPath: string): string {
  return `${projectName}::${apiPath}`;
}

export function useDocumentBlob(projectName: string, apiPath: string, enabled: boolean) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [largeFileHint, setLargeFileHint] = useState(false);

  useEffect(() => {
    if (!enabled || !projectName || !apiPath) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const key = cacheKey(projectName, apiPath);
    const cached = bufferCache.get(key);
    if (cached) {
      setBuffer(cached);
      setLoading(false);
      setError(false);
      return undefined;
    }

    setLoading(true);
    setError(false);
    setLargeFileHint(false);

    api.readFileBlob(projectName, apiPath)
      .then((res: Response) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentLength = Number(res.headers.get('content-length') || 0);
        if (contentLength > 15 * 1024 * 1024) {
          setLargeFileHint(true);
        }
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (cancelled) return;
        bufferCache.set(key, arrayBuffer);
        setBuffer(arrayBuffer);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiPath, enabled, projectName]);

  return { buffer, loading, error, largeFileHint };
}
