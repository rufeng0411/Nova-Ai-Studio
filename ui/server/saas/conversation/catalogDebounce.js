/**
 * PD-SAAS-FORK: Debounced catalog shadow writes (30s per session).
 */
const pending = new Map();

/**
 * @param {string} key
 * @param {() => Promise<void>} fn
 * @param {number} [delayMs]
 */
export function debounceCatalogWrite(key, fn, delayMs = 30_000) {
  const existing = pending.get(key);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }
  const entry = {
    fn,
    timer: setTimeout(async () => {
      pending.delete(key);
      try {
        await fn();
      } catch (error) {
        console.warn('[conversation-catalog] debounced write failed:', error instanceof Error ? error.message : error);
      }
    }, delayMs),
  };
  pending.set(key, entry);
}

/**
 * Flush all pending debounced writes (tests / shutdown).
 */
export async function flushDebouncedCatalogWrites() {
  const entries = [...pending.values()];
  for (const entry of entries) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  pending.clear();
  await Promise.all(entries.map((entry) => entry.fn().catch(() => undefined)));
}
