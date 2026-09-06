import { describe, it, expect } from 'vitest';
import {
  sortProjectsByRecency,
  sortSessionsByRecency,
} from './sidebarRecencySort';
import type { Project, ProjectSession } from '../types/app';

describe('sidebarRecencySort', () => {
  it('sorts sessions newest first', () => {
    const sessions: ProjectSession[] = [
      { id: 'a', lastActivity: '2026-01-01T00:00:00.000Z' },
      { id: 'b', lastActivity: '2026-06-01T00:00:00.000Z' },
      { id: 'c', updated_at: '2026-03-01T00:00:00.000Z' },
    ];
    expect(sortSessionsByRecency(sessions).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts projects by newest session activity', () => {
    const projects: Project[] = [
      { name: 'old', displayName: 'old', fullPath: '/old', sessions: [{ id: '1', lastActivity: '2026-01-01T00:00:00.000Z' }] },
      { name: 'new', displayName: 'new', fullPath: '/new', sessions: [{ id: '2', lastActivity: '2026-06-01T00:00:00.000Z' }] },
    ];
    expect(sortProjectsByRecency(projects).map((p) => p.name)).toEqual(['new', 'old']);
  });
});
