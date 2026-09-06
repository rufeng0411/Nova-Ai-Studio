import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildCapabilityHubFingerprint,
  clearCapabilityHubCache,
  readCapabilityHubCache,
  writeCapabilityHubCache,
} from './capabilityHubCache';

function installMemorySessionStorage() {
  const store = new Map<string, string>();
  const memory = {
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
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: memory,
  });
}

describe('capabilityHubCache', () => {
  beforeEach(() => {
    installMemorySessionStorage();
    clearCapabilityHubCache();
  });

  it('builds stable fingerprint from catalog and skills revision', () => {
    const a = buildCapabilityHubFingerprint({
      catalog_generated_at: '2026-06-11T08:00:00.000Z',
      skills_revision: 'abc123',
      locale: 'zh-CN',
    });
    const b = buildCapabilityHubFingerprint({
      catalog_generated_at: '2026-06-11T08:00:00.000Z',
      skills_revision: 'abc123',
      locale: 'zh-CN',
    });
    expect(a).toBe(b);
    expect(a).toContain('abc123');
  });

  it('reads and writes cache scoped by locale and project path', () => {
    writeCapabilityHubCache({
      fingerprint: 'fp-1',
      locale: 'zh-CN',
      projectPath: '/projects/general',
      payload: {
        stages: [],
        capabilities: [{ slug: 'demo-skill' }],
      },
    });
    expect(readCapabilityHubCache('zh-CN', '/projects/general')?.fingerprint).toBe('fp-1');
    expect(readCapabilityHubCache('en', '/projects/general')).toBeNull();
    expect(readCapabilityHubCache('zh-CN', '/other')).toBeNull();
  });
});
