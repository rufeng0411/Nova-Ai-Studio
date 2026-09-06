import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import InformalProcessStack from './InformalProcessStack';
import type { ProcessAttachment } from './processGrouping';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; count?: number; duration?: string }) => {
      if (opts?.defaultValue) {
        return opts.defaultValue
          .replace('{{count}}', String(opts.count ?? ''))
          .replace('{{duration}}', String(opts.duration ?? ''));
      }
      return _key;
    },
  }),
}));

function attachment(id: string): ProcessAttachment {
  return {
    id,
    processSummary: {
      id: `summary-${id}`,
      type: 'assistant',
      content: '',
      timestamp: '2026-06-12T00:00:00.000Z',
      toolCallCount: 2,
      exploredFileCount: 1,
      state: 'completed',
    },
    processDetailMessages: [],
    startIndex: 0,
    endIndex: 1,
    inlineImages: [],
  };
}

describe('InformalProcessStack', () => {
  it('renders collapsed trigger without step count', () => {
    render(
      <InformalProcessStack
        attachments={[attachment('a1')]}
        runMeta={{ durationMs: 45000, stepCount: 3 }}
        expanded={false}
        onExpandedChange={() => {}}
      />,
    );

    expect(screen.getByTestId('informal-process-stack')).toBeTruthy();
    expect(screen.getByText(/已完成 ·/)).toBeTruthy();
    expect(screen.queryByText(/3 步/)).toBeNull();
  });

  it('expands step list on click', () => {
    const onExpandedChange = vi.fn();

    render(
      <InformalProcessStack
        attachments={[attachment('a1')]}
        runMeta={{ durationMs: 1000, stepCount: 1 }}
        expanded={false}
        onExpandedChange={onExpandedChange}
        renderDetail={() => <span data-testid="process-detail">detail</span>}
      />,
    );

    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('hides chevron in minimal mode when deliverables exist', () => {
    render(
      <InformalProcessStack
        attachments={[attachment('a1')]}
        runMeta={{ durationMs: 1000, stepCount: 2 }}
        expanded={false}
        onExpandedChange={() => {}}
        processDetailLevel="minimal"
        hasDeliverables
      />,
    );

    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });
});
