/**
 * Vitest global setup: block until i18n is ready; disable suspense in jsdom.
 */
import i18n from '../i18n/config.js';

await new Promise<void>((resolve) => {
  if (i18n.isInitialized) {
    resolve();
    return;
  }
  i18n.on('initialized', () => resolve());
});

if (i18n.options.react) {
  i18n.options.react.useSuspense = false;
}

// jsdom localStorage for capability try / prompt injection unit tests
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
  } as unknown as typeof DOMMatrix;
}
