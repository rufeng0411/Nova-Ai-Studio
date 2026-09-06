import { useEffect, useState } from 'react';
import { normalizeProjectForSettings, type SettingsProject } from '../../../lib/projectSettings';
import type { Project } from '../../../types/app';
import { authenticatedFetch } from '../../../utils/api';

export function useAdminSettingsProjects() {
  const [projects, setProjects] = useState<SettingsProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await authenticatedFetch('/api/projects');
        if (!response.ok) return;
        const data = (await response.json()) as Project[];
        if (!cancelled && Array.isArray(data)) {
          setProjects(data.map(normalizeProjectForSettings));
        }
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, loading };
}
