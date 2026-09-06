import { describe, expect, it, beforeEach } from 'vitest';
import type { Project } from '../types/app';
import {
  resetProjectListTombstonesForTests,
  tombstoneDeletedSession,
} from './projectListTombstones';
import { preserveLoadedSessions } from '../hooks/useProjectsState';

function makeProject(name: string, overrides: Partial<Project> = {}): Project {
  return {
    name,
    displayName: name,
    fullPath: `/tmp/${name}`,
    sessions: [],
    ...overrides,
  };
}

describe('projectListTombstones + preserveLoadedSessions', () => {
  beforeEach(() => {
    resetProjectListTombstonesForTests();
  });

  it('does not resurrect a tombstoned session when server preview is shorter', () => {
    const sessions = Array.from({ length: 8 }, (_, index) => ({
      id: `web:s_${index}`,
      title: `Session ${index}`,
      created_at: '2026-05-28T00:00:00.000Z',
      updated_at: '2026-05-28T00:00:00.000Z',
    }));
    tombstoneDeletedSession('web:s_7');

    const prev = [
      makeProject('alpha', {
        sessions,
        sessionMeta: { total: 8, hasMore: false },
      }),
    ];
    const next = [
      makeProject('alpha', {
        sessions: sessions.slice(0, 5),
        sessionMeta: { total: 7, hasMore: true },
      }),
    ];

    const merged = preserveLoadedSessions(prev, next);
    const ids = merged[0]?.sessions?.map((session) => session.id) ?? [];

    expect(ids).not.toContain('web:s_7');
    expect(ids).toContain('web:s_6');
    expect(ids.length).toBe(7);
  });
});
