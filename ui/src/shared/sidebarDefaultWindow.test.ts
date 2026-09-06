import { describe, it, expect } from 'vitest';
import { filterSessionsForSidebarWindow, resolveSidebarDefaultSinceMs } from './sidebarDefaultWindow';
import type { ProjectSession } from '../types/app';

describe('sidebarDefaultWindow', () => {
  it('filters sessions older than default window', () => {
    const sinceMs = resolveSidebarDefaultSinceMs(false)!;
    const recent: ProjectSession = {
      id: 'recent',
      lastActivity: new Date(sinceMs + 86_400_000).toISOString(),
    };
    const old: ProjectSession = {
      id: 'old',
      lastActivity: new Date(sinceMs - 86_400_000).toISOString(),
    };
    expect(filterSessionsForSidebarWindow([old, recent], false).map((s) => s.id)).toEqual(['recent']);
  });

  it('hides n2_bot steward sessions from the sidebar window', () => {
    const worker: ProjectSession = {
      id: 'recent',
      lastActivity: new Date().toISOString(),
    };
    const steward: ProjectSession = {
      id: 'n2',
      lastActivity: new Date().toISOString(),
      sessionKind: 'n2_bot',
    };
    expect(filterSessionsForSidebarWindow([worker, steward], true).map((s) => s.id)).toEqual(['recent']);
  });
});
