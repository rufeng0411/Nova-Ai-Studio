import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import type { DeliverableItem } from './collectDeliverables';
import { clearDeliverableValidationCacheForTests } from './deliverableValidationCache';
import { clearAllLedgersForTests } from './deliverableValidationLedger';
import { DeliverableValidationSessionProvider } from './DeliverableValidationSessionContext';
import { useValidatedDeliverables } from './useValidatedDeliverables';

const fetchCachedMock = vi.hoisted(() => vi.fn());

vi.mock('./deliverableValidationCache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./deliverableValidationCache')>();
  return {
    ...actual,
    fetchDeliverableValidationCached: (...args: Parameters<typeof actual.fetchDeliverableValidationCached>) =>
      fetchCachedMock(...args),
  };
});

const textItem: DeliverableItem = {
  id: 'missing-html',
  path: 'visibility-report.html',
  apiPath: 'visibility-report.html',
  kind: 'html',
  source: 'text',
};

const toolItem: DeliverableItem = {
  id: 'tool-html',
  path: 'index.html',
  apiPath: 'index.html',
  kind: 'html',
  source: 'tool',
};

function Probe({ items }: { items: DeliverableItem[] }) {
  const validated = useValidatedDeliverables('general', items, 'artifacts/razer');
  return <div data-testid="count">{validated.length}</div>;
}

function EngineTrustProbe({ items }: { items: DeliverableItem[] }) {
  const validated = useValidatedDeliverables('general', items, 'artifacts/razer');
  return (
    <>
      <div data-testid="count">{validated.length}</div>
      <div data-testid="status">{validated[0]?.validationStatus ?? 'none'}</div>
    </>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  clearDeliverableValidationCacheForTests();
  clearAllLedgersForTests();
  fetchCachedMock.mockReset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useValidatedDeliverables', () => {
  it('hides text-only phantoms after server marks them broken', async () => {
    fetchCachedMock.mockResolvedValue([
      { ...textItem, validationStatus: 'broken' as const },
    ]);

    render(<Probe items={[textItem]} />);

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('0');
    });
    expect(fetchCachedMock).toHaveBeenCalledWith('general', [textItem], 'artifacts/razer');
  });

  it('keeps tool deliverables visible when server resolves a disk path', async () => {
    fetchCachedMock.mockResolvedValue([
      {
        ...toolItem,
        validationStatus: 'softVerified' as const,
        resolvedPath: 'artifacts/razer/index.html',
        apiPath: 'artifacts/razer/index.html',
        path: 'artifacts/razer/index.html',
      },
    ]);

    render(<Probe items={[toolItem]} />);

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });
    expect(fetchCachedMock).toHaveBeenCalled();
  });

  it('fd7c166c: soft-settles artifact paths when Bridge validate hangs', async () => {
    fetchCachedMock.mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve([{
            id: 'od-index',
            path: 'artifacts/task-razer/index.html',
            apiPath: 'artifacts/task-razer/index.html',
            kind: 'html' as const,
            source: 'tool' as const,
            resolvedPath: 'artifacts/task-razer/index.html',
            validationStatus: 'verified' as const,
          }]);
        }, 10_000);
      }),
    );
    const artifactItem: DeliverableItem = {
      id: 'od-index',
      path: 'artifacts/task-razer/index.html',
      apiPath: 'artifacts/task-razer/index.html',
      kind: 'html',
      source: 'tool',
      resolvedPath: 'artifacts/task-razer/index.html',
    };

    render(<EngineTrustProbe items={[artifactItem]} />);
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });
    expect(screen.getByTestId('status').textContent).toBe('pending');

    await waitFor(
      () => {
        expect(screen.getByTestId('status').textContent).toBe('softVerified');
      },
      { timeout: 5_000 },
    );
  });

  it('trusts engine acceptance meta and skips Bridge validate fetch (P0-4)', async () => {
    const messages: ChatMessage[] = [{
      type: 'assistant',
      id: 'msg-passed',
      timestamp: Date.now(),
      content: '交付完成',
      turnAcceptanceMeta: {
        acceptanceStatus: 'passed',
        verifiedPaths: ['artifacts/razer/index.html'],
        missingPaths: [],
        brokenPaths: [],
      },
    }];

    render(
      <DeliverableValidationSessionProvider
        sessionId="web-s_engine-trust"
        projectName="general"
        latest={{ messageId: 'msg-passed', turnIndex: 0 }}
        chatMessages={messages}
      >
        <EngineTrustProbe items={[toolItem]} />
      </DeliverableValidationSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('verified');
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(fetchCachedMock).not.toHaveBeenCalled();
  });
});
