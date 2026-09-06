import { useEffect, useState } from 'react';
import { resolveProjectApiPath } from '../resolveProjectApiPath';

export function useResolvedProjectApiPath(
  projectName: string | undefined,
  filePath: string | undefined,
  projectRoot?: string,
  options?: { hintDir?: string; skipResolve?: boolean },
) {
  const [resolvedApiPath, setResolvedApiPath] = useState(filePath || '');
  const [resolving, setResolving] = useState(Boolean(projectName && filePath && !options?.skipResolve));

  useEffect(() => {
    if (!projectName || !filePath) {
      setResolvedApiPath(filePath || '');
      setResolving(false);
      return undefined;
    }

    if (options?.skipResolve) {
      setResolvedApiPath(filePath);
      setResolving(false);
      return undefined;
    }

    let cancelled = false;
    setResolving(true);

    resolveProjectApiPath(projectName, filePath, projectRoot, options)
      .then((next) => {
        if (!cancelled) setResolvedApiPath(next);
      })
      .catch(() => {
        if (!cancelled) setResolvedApiPath(filePath);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectName, filePath, projectRoot, options?.hintDir, options?.skipResolve]);

  return { resolvedApiPath, resolving };
}
