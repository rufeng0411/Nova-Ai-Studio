import type { DeliverableItem } from './collectDeliverables';

function canonicalDeliverableKey(item: DeliverableItem): string {
  return `${item.kind}:${String(item.apiPath || item.path).replace(/\\/g, '/').toLowerCase()}`;
}

export function mergeDeliverablesByCanonicalPath(
  primaryItems: DeliverableItem[],
  fallbackItems: DeliverableItem[],
): DeliverableItem[] {
  if (primaryItems.length === 0) return fallbackItems;
  if (fallbackItems.length === 0) return primaryItems;

  const merged = new Map<string, DeliverableItem>();
  for (const item of primaryItems) {
    const key = canonicalDeliverableKey(item);
    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values());
}
