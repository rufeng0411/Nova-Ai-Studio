import { describe, expect, it } from 'vitest';
import type { Project, ProjectSession } from '../types/app';
import {
  buildSidebarMultiSelectKey,
  collectSidebarSessionRefs,
  filterBatchCompleteSessions,
  filterBatchPauseSessions,
  partitionBatchDeletableSessions,
} from './sidebarSessionMultiSelect';
import { setSessionSidebarLocked } from '../lib/sessionSidebarState';

function project(name: string, sessions: ProjectSession[]): Project {
  return { name, displayName: name, sessions } as Project;
}

function session(id: string, overrides: Partial<ProjectSession> = {}): ProjectSession {
  return { id, title: id, ...overrides };
}

describe('sidebarSessionMultiSelect', () => {
  it('builds stable multi-select keys', () => {
    expect(buildSidebarMultiSelectKey('general', 'web-s_abc')).toBe('general::web-s_abc');
  });

  it('collects selected session refs across projects', () => {
    const projects = [
      project('general', [session('web-s_a'), session('web-s_b')]),
    ];
    const keys = new Set([buildSidebarMultiSelectKey('general', 'web-s_a')]);
    const refs = collectSidebarSessionRefs(projects, keys, (p) =>
      (p.sessions ?? []).map((row) => ({ session: row, sessionId: row.id })),
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]?.sessionId).toBe('web-s_a');
  });

  it('skips locked sessions for batch delete', () => {
    setSessionSidebarLocked('web-s_locked', true);
    const refs = [{ project: project('p', []), session: session('web-s_locked'), sessionId: 'web-s_locked' }];
    const { deletable, lockedCount } = partitionBatchDeletableSessions(refs);
    expect(deletable).toHaveLength(0);
    expect(lockedCount).toBe(1);
    setSessionSidebarLocked('web-s_locked', false);
  });

  it('filters pause targets from execution status', () => {
    const refs = [{
      project: project('p', []),
      session: session('web-s_run', { executionStatus: 'running' }),
      sessionId: 'web-s_run',
    }];
    expect(filterBatchPauseSessions(refs)).toHaveLength(1);
    expect(filterBatchCompleteSessions(refs)).toHaveLength(1);
  });
});
