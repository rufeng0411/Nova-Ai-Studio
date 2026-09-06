import { describe, expect, it } from 'vitest';
import type { Project } from '../types/app';
import {
  applyProjectsSocketUpdate,
  createProjectsFetchCoalescer,
  mergeProjectsWithServerList,
  preserveLoadedSessions,
  projectsHaveChanges,
} from './useProjectsState';

function makeProject(name: string, overrides: Partial<Project> = {}): Project {
  return {
    name,
    displayName: name,
    fullPath: `/tmp/${name}`,
    sessions: [
      {
        id: 'web:s_1',
        title: 'Session 1',
        created_at: '2026-05-28T00:00:00.000Z',
        updated_at: '2026-05-28T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('createProjectsFetchCoalescer', () => {
  it('merges parallel callers onto one in-flight request', async () => {
    let calls = 0;
    const coalescer = createProjectsFetchCoalescer(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [makeProject('alpha')];
    });

    const [a, b] = await Promise.all([coalescer(false), coalescer(false)]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
  });

  it('queues a force refresh after in-flight instead of parallel HTTP', async () => {
    const callFlags: boolean[] = [];
    let releaseFirst: (() => void) | null = null;
    const coalescer = createProjectsFetchCoalescer(async (forceFresh) => {
      callFlags.push(forceFresh);
      if (callFlags.length === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return [makeProject(`p-${callFlags.length}`)];
    });

    const first = coalescer(false);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = coalescer(true);
    releaseFirst?.();
    const [resultA, resultB] = await Promise.all([first, second]);

    expect(callFlags).toEqual([false, true]);
    expect(resultA[0]?.name).toBe('p-2');
    expect(resultB[0]?.name).toBe('p-2');
  });
});

describe('applyProjectsSocketUpdate', () => {
  it('returns the same array reference when the socket payload is unchanged', () => {
    const prev = [makeProject('alpha')];
    const next = [makeProject('alpha')];

    const mergedOnce = applyProjectsSocketUpdate(prev, next);
    const mergedTwice = applyProjectsSocketUpdate(mergedOnce, next);

    expect(mergedTwice).toBe(prev);
  });

  it('returns a new reference when a project field changes', () => {
    const prev = [makeProject('alpha')];
    const next = [
      makeProject('alpha', {
        sessions: [
          {
            id: 'web:s_1',
            title: 'Session 1',
            created_at: '2026-05-28T00:00:00.000Z',
            updated_at: '2026-05-29T12:00:00.000Z',
          },
        ],
      }),
    ];

    const merged = applyProjectsSocketUpdate(prev, next);

    expect(merged).not.toBe(prev);
    expect(merged[0]?.sessions?.[0]?.updated_at).toBe('2026-05-29T12:00:00.000Z');
  });

  it('preserves optimistic new-session placeholders across updates', () => {
    const prev = [
      makeProject('alpha', {
        sessions: [
          {
            id: 'new-session-123',
            title: 'New session',
            created_at: '2026-05-28T00:00:00.000Z',
            updated_at: '2026-05-28T00:00:00.000Z',
          },
        ],
      }),
    ];
    const next = [makeProject('alpha')];

    const merged = applyProjectsSocketUpdate(prev, next);
    const placeholder = merged[0]?.sessions?.find((s) => s.id === 'new-session-123');

    expect(placeholder?.title).toBe('New session');
  });
});

describe('mergeProjectsWithServerList', () => {
  it('keeps optimistic create rows when server list is still stale', () => {
    const prev = [
      makeProject('general'),
      makeProject('workspaces-0619', {
        displayName: '0619',
        sidebarSyncPending: true,
        sessions: [],
      }),
    ];
    const server = [makeProject('general')];

    const merged = mergeProjectsWithServerList(prev, server);

    expect(merged).toHaveLength(2);
    expect(merged.some((project) => project.name === 'workspaces-0619')).toBe(true);
  });

  it('drops sidebarSyncPending once server includes the new project', () => {
    const prev = [
      makeProject('general'),
      makeProject('workspaces-0619', {
        displayName: '0619',
        sidebarSyncPending: true,
        sessions: [],
      }),
    ];
    const server = [
      makeProject('general'),
      makeProject('workspaces-0619', { displayName: '0619', sessions: [] }),
    ];

    const merged = mergeProjectsWithServerList(prev, server);

    expect(merged).toHaveLength(2);
    expect(merged.find((project) => project.name === 'workspaces-0619')?.sidebarSyncPending).toBeUndefined();
  });
});

describe('projectsHaveChanges', () => {
  it('detects no changes for structurally equal projects', () => {
    const a = [makeProject('alpha')];
    const b = [makeProject('alpha')];
    expect(projectsHaveChanges(a, b, true)).toBe(false);
  });
});

describe('preserveLoadedSessions', () => {
  it('keeps loaded sessions when the server preview is shorter', () => {
    const prev = [
      makeProject('alpha', {
        sessions: Array.from({ length: 8 }, (_, index) => ({
          id: `web:s_${index}`,
          title: `Session ${index}`,
          created_at: '2026-05-28T00:00:00.000Z',
          updated_at: '2026-05-28T00:00:00.000Z',
        })),
        sessionMeta: { total: 8, hasMore: false },
      }),
    ];
    const next = [
      makeProject('alpha', {
        sessions: prev[0].sessions?.slice(0, 5),
        sessionMeta: { total: 8, hasMore: true, includeOlderLoaded: true },
      }),
    ];

    const merged = preserveLoadedSessions(prev, next);

    expect(merged[0]?.sessions?.length).toBe(8);
  });

  it('preserves queued real session until server catalog lists it', () => {
    const prev = [
      makeProject('alpha', {
        sessions: [
          {
            id: 'web-s_queued',
            title: 'Queued task',
            created_at: '2026-05-28T00:00:00.000Z',
            updated_at: '2026-05-28T00:00:00.000Z',
            executionStatus: 'queued',
          },
        ],
      }),
    ];
    const next = [makeProject('alpha', { sessions: [] })];

    const merged = preserveLoadedSessions(prev, next);

    expect(merged[0]?.sessions?.some((s) => s.id === 'web-s_queued')).toBe(true);
  });

  it('preserves optimistic and queued rows when includeOlderLoaded is true', () => {
    const prev = [
      makeProject('alpha', {
        sessions: [
          {
            id: 'new-session-abc',
            title: 'New session',
            created_at: '2026-05-28T00:00:00.000Z',
            updated_at: '2026-05-28T00:00:00.000Z',
          },
          {
            id: 'web-s_queued',
            title: 'Queued task',
            created_at: '2026-05-28T00:00:00.000Z',
            updated_at: '2026-05-28T00:00:00.000Z',
            executionStatus: 'queued',
          },
        ],
        sessionMeta: { total: 12, hasMore: true, includeOlderLoaded: true },
      }),
    ];
    const next = [
      makeProject('alpha', {
        sessions: Array.from({ length: 5 }, (_, index) => ({
          id: `web:s_${index}`,
          title: `Session ${index}`,
          created_at: '2026-05-28T00:00:00.000Z',
          updated_at: '2026-05-28T00:00:00.000Z',
        })),
        sessionMeta: { total: 12, hasMore: true, includeOlderLoaded: true },
      }),
    ];

    const merged = preserveLoadedSessions(prev, next);
    const ids = (merged[0]?.sessions ?? []).map((s) => s.id);

    expect(ids).toContain('new-session-abc');
    expect(ids).toContain('web-s_queued');
  });
});
