// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeliverableTurnPointer from './DeliverableTurnPointer';

vi.mock('lucide-react', () => ({
  ChevronUp: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; done?: number; total?: number }) => {
      let text = opts?.defaultValue ?? _key;
      if (opts?.done !== undefined) text = text.replace('{{done}}', String(opts.done));
      if (opts?.total !== undefined) text = text.replace('{{total}}', String(opts.total));
      return text;
    },
    i18n: { language: 'zh-CN' },
  }),
  I18nextProvider: ({ children }: { children: unknown }) => children,
}));

afterEach(() => {
  cleanup();
});

describe('DeliverableTurnPointer', () => {
  it('renders session pointer link for latest turn', async () => {
    const onScroll = vi.fn();
    render(
      <DeliverableTurnPointer done={2} total={4} onScrollToSummary={onScroll} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('deliverable-turn-pointer')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('deliverable-turn-pointer-link'));
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it('marks historical snapshot without pointer link', async () => {
    render(
      <DeliverableTurnPointer done={1} total={3} historical />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('deliverable-turn-pointer')).toBeTruthy();
    });
    expect(screen.getByTestId('deliverable-turn-pointer').dataset.historical).toBe('true');
    expect(screen.queryByTestId('deliverable-turn-pointer-link')).toBeNull();
  });
});
