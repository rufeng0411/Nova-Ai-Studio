// PD-SAAS-FORK: recent folder paths for path picker quick access
const STORAGE_KEY = 'nova-path-picker-recent';
const MAX_RECENT = 5;

export function readRecentPaths(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function rememberRecentPath(folderPath: string): void {
  const normalized = folderPath.trim();
  if (!normalized) return;
  const existing = readRecentPaths().filter((item) => item !== normalized);
  const next = [normalized, ...existing].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}
