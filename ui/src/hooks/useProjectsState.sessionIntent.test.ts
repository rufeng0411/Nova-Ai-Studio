import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Project } from '../types/app';

describe('pendingSessionIntent merge', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
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
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepends placeholder when server list lacks optimistic session', async () => {
    const { mergePendingSessionIntentIntoProjects } = await import('../shared/pendingSessionIntent');
    const projects: Project[] = [{
      name: 'general',
      displayName: 'general',
      fullPath: '/tmp/general',
      sessions: [],
    }];
    localStorage.setItem('pilotdeck:pendingSessionIntents', JSON.stringify([{
      optimisticId: 'new-session-abc',
      projectKey: 'general',
      projectName: 'general',
      firstPrompt: '写方案',
      ts: Date.now(),
    }]));
    const merged = mergePendingSessionIntentIntoProjects(projects);
    expect(merged[0].sessions?.[0]?.id).toBe('new-session-abc');
  });
});
