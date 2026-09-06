import { describe, expect, it } from 'vitest';
import type { Project, ProjectSession } from '../types/app';
import { applySelectProjectAndSession, resetProjectSessionPreviewForSwitch } from './applySelectProjectAndSession';
import { SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT } from './sidebarSessionPreviewLimit';

function makeSession(id: string): ProjectSession {
  return {
    id,
    title: id,
    created_at: '2026-07-20T00:00:00.000Z',
    updated_at: '2026-07-20T00:00:00.000Z',
  };
}

function makeProject(name: string, sessionCount: number): Project {
  return {
    name,
    displayName: name,
    fullPath: `/tmp/${name}`,
    sessions: Array.from({ length: sessionCount }, (_, i) => makeSession(`web:s_${name}_${i}`)),
    sessionMeta: { total: sessionCount, hasMore: sessionCount > SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT },
  };
}

describe('applySelectProjectAndSession', () => {
  it('keeps session selected and navigates to session route', () => {
    const projectB = makeProject('beta', 2);
    const session = projectB.sessions![0]!;
    const result = applySelectProjectAndSession(
      { project: projectB, session, previousProjectName: 'alpha' },
      { projects: [makeProject('alpha', 2), projectB], activeTab: 'chat' },
    );

    expect(result.selectedSession.id).toBe(session.id);
    expect(result.selectedSession).not.toBeNull();
    expect(result.navigateTo).toBe(`/session/${session.id}`);
    expect(result.navigateTo).not.toBe('/');
  });

  it('caps preview sessions per project', () => {
    const big = makeProject('big', 15);
    const session = big.sessions![0]!;
    const result = applySelectProjectAndSession(
      { project: big, session },
      { projects: [big], activeTab: 'chat' },
    );

    for (const project of result.projects) {
      expect((project.sessions ?? []).length).toBeLessThanOrEqual(SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT);
    }
  });

  it('pins selected session when rank > preview limit', () => {
    const big = makeProject('PS5pro', 15);
    const session = big.sessions![12]!;
    const result = applySelectProjectAndSession(
      { project: big, session },
      { projects: [big], activeTab: 'chat' },
    );
    const ids = (result.selectedProject.sessions ?? []).map((s) => s.id);
    expect(ids).toContain(session.id);
  });

  it('switches chat tab when on tasks or preview', () => {
    const project = makeProject('alpha', 1);
    const session = project.sessions![0]!;
    const onTasks = applySelectProjectAndSession(
      { project, session },
      { projects: [project], activeTab: 'tasks' },
    );
    expect(onTasks.shouldSwitchChatTab).toBe(true);

    const onChat = applySelectProjectAndSession(
      { project, session },
      { projects: [project], activeTab: 'chat' },
    );
    expect(onChat.shouldSwitchChatTab).toBe(false);
  });
});

describe('resetProjectSessionPreviewForSwitch', () => {
  it('leaves small lists unchanged', () => {
    const project = makeProject('small', 3);
    expect(resetProjectSessionPreviewForSwitch(project).sessions?.length).toBe(3);
  });

  it('keeps optimistic new-session rows when trimming preview', () => {
    const sessions = Array.from({ length: 15 }, (_, i) => makeSession(`web:s_${i}`));
    sessions.unshift({
      id: 'new-session-xyz',
      title: 'Queued new session',
      created_at: '2026-07-22T00:00:00.000Z',
      updated_at: '2026-07-22T00:00:00.000Z',
      executionStatus: 'queued',
    });
    const project: Project = {
      name: 'big',
      displayName: 'big',
      fullPath: '/tmp/big',
      sessions,
      sessionMeta: { total: sessions.length, hasMore: true },
    };

    const preview = resetProjectSessionPreviewForSwitch(project).sessions ?? [];
    expect(preview.some((s) => s.id === 'new-session-xyz')).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT + 1);
  });
});
