import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  persistSessionCapability,
  readSessionCapability,
  clearSessionCapability,
  resolveCapabilityContextForSend,
} from './capabilitySessionBinding';

describe('capabilitySessionBinding', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
  });

  it('persist and read binding', () => {
    persistSessionCapability('sess-1', {
      slug: 'anth-pptx',
      displayName: 'PPT',
      majorCategory: 'creation',
    });
    const read = readSessionCapability('sess-1');
    expect(read?.slug).toBe('anth-pptx');
    expect(read?.majorCategory).toBe('creation');
  });

  it('resolve prefers pending then stored', () => {
    persistSessionCapability('sess-2', {
      slug: 'old-skill',
      displayName: 'Old',
    });
    const resolved = resolveCapabilityContextForSend('sess-2', {
      slug: 'anth-pptx',
      displayName: 'New',
    });
    expect(resolved?.slug).toBe('anth-pptx');
    expect(readSessionCapability('sess-2')?.slug).toBe('anth-pptx');
  });

  it('clear removes binding', () => {
    persistSessionCapability('sess-3', { slug: 'x', displayName: 'X' });
    clearSessionCapability('sess-3');
    expect(readSessionCapability('sess-3')).toBeNull();
  });

  it('hub pending is marked source hub and not overwritten by inferred text', () => {
    const resolved = resolveCapabilityContextForSend(
      'sess-4',
      { slug: 'anth-pptx', displayName: 'PPT', source: 'hub' },
      '为青盏交付获客官网单页，使用能力官网落地页。须交付：index.html。',
    );
    expect(resolved?.slug).toBe('anth-pptx');
    expect(resolved?.source).toBe('hub');
  });
});
