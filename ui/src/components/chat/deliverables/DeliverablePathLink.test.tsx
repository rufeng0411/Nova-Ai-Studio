// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { MarkdownInteractionContext } from '../view/subcomponents/MarkdownInteractionContext';
import { resolveDeliverablePath } from '../../../shared/resolveDeliverablePath';
import DeliverablePathLink from './DeliverablePathLink';

vi.mock('../../../shared/resolveDeliverablePath', () => ({
  resolveDeliverablePath: vi.fn(async () => ({
    relativePath: 'artifacts/razer-blade-2026-geo/content/zhihu-article.md',
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DeliverablePathLink', () => {
  it('opens bare markdown deliverable with turn hint and resolved canonical path', async () => {
    const onFileOpen = vi.fn();

    renderWithProviders(
      <MarkdownInteractionContext.Provider
        value={{
          selectedProject: { name: '雷蛇项目', path: '/workspace' } as any,
          projectRoot: '/workspace',
          turnArtifactDir: 'artifacts/razer-blade-2026-geo',
          onFileOpen,
        }}
      >
        <DeliverablePathLink path="zhihu-article.md">知乎成稿</DeliverablePathLink>
      </MarkdownInteractionContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '知乎成稿' }));

    await waitFor(() => {
      expect(resolveDeliverablePath).toHaveBeenCalledWith({
        projectName: '雷蛇项目',
        path: 'zhihu-article.md',
        turnArtifactDir: 'artifacts/razer-blade-2026-geo',
        projectRoot: '/workspace',
      });
      expect(onFileOpen).toHaveBeenCalledWith(
        'artifacts/razer-blade-2026-geo/content/zhihu-article.md',
        expect.objectContaining({
          initialPreview: true,
          hintDir: 'artifacts/razer-blade-2026-geo',
        }),
      );
    });
  });
});
