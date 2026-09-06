// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeliverableDockRow } from '../../../shared/buildDeliverableDockRows';
import { normalizeConversationSummaryProgress } from '../../../shared/normalizeConversationSummaryProgress';
import SessionDeliverableSummaryBar from './SessionDeliverableSummaryBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: {
      defaultValue?: string;
      done?: number;
      total?: number;
      label?: string;
      generated?: number;
      accepted?: number;
    }) => {
      let text = opts?.defaultValue ?? _key;
      if (opts?.done !== undefined) text = text.replace('{{done}}', String(opts.done));
      if (opts?.total !== undefined) text = text.replace('{{total}}', String(opts.total));
      if (opts?.label !== undefined) text = text.replace('{{label}}', String(opts.label));
      if (opts?.generated !== undefined) text = text.replace('{{generated}}', String(opts.generated));
      if (opts?.accepted !== undefined) text = text.replace('{{accepted}}', String(opts.accepted));
      return text;
    },
    i18n: { language: 'zh-CN' },
  }),
  I18nextProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('lucide-react', () => ({
  ChevronUp: () => null,
  ListChecks: () => null,
  ChevronDown: () => null,
  CheckCircle2: () => null,
  FileText: () => null,
}));

vi.mock('./DeliverableSummaryTable', () => ({
  default: function MockDeliverableSummaryTable() {
    return null;
  },
}));

afterEach(() => {
  cleanup();
});

describe('SessionDeliverableSummaryBar', () => {
  const rows: DeliverableDockRow[] = [
    {
      id: 'a',
      label: 'Brief',
      path: 'artifacts/task/brief.md',
      resolvedPath: 'artifacts/task/brief.md',
      status: 'delivered',
      linkable: true,
      previewable: true,
    },
    {
      id: 'b',
      label: 'Poster',
      path: 'artifacts/task/poster.png',
      status: 'missing',
      linkable: false,
      previewable: false,
    },
  ];

  it('aggregates progress from dock rows', () => {
    expect(normalizeConversationSummaryProgress(rows)).toEqual({
      done: 1,
      generated: 1,
      accepted: 1,
      total: 2,
    });
  });

  it('counts generated path without treating it as accepted', () => {
    const mixed: DeliverableDockRow[] = [
      { ...rows[0], status: 'checking', resolvedPath: 'artifacts/task/brief.md' },
      { ...rows[1], status: 'missing' },
    ];
    expect(normalizeConversationSummaryProgress(mixed)).toEqual({
      done: 0,
      generated: 1,
      accepted: 0,
      total: 2,
    });
  });

  it('renders collapsed bar with contract hash', async () => {
    render(
      <SessionDeliverableSummaryBar rows={rows} contractHash="hash-1" validationSettled />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-deliverable-summary-bar')).toBeTruthy();
    });
    const bar = screen.getByTestId('session-deliverable-summary-bar');
    expect(bar.getAttribute('data-contract-hash')).toBe('hash-1');
    expect(bar.getAttribute('data-expanded')).toBe('false');
    expect(screen.getByTestId('session-summary-generated').textContent).toContain('1');
    expect(screen.getByTestId('session-summary-accepted').textContent).toContain('1');
    expect(screen.getByTestId('session-summary-total').textContent).toContain('/2');
    expect(screen.queryByText('已生成')).toBeNull();
    expect(screen.queryByText('已验收')).toBeNull();
    expect(screen.getByTestId('deliverable-summary-bar-badge')).toBeTruthy();
  });

  it('shows persistent badge and pulse when done count increases', async () => {
    const partial: DeliverableDockRow[] = [
      { ...rows[0], status: 'delivered' },
      { ...rows[1], status: 'missing' },
    ];
    const { rerender } = render(
      <SessionDeliverableSummaryBar rows={partial} validationSettled />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('session-deliverable-summary-bar')).toBeTruthy();
    });
    expect(screen.getByTestId('deliverable-summary-bar-badge')).toBeTruthy();
    expect(screen.getByTestId('deliverable-summary-bar-badge').getAttribute('data-pulse-active')).not.toBe('true');

    rerender(
      <SessionDeliverableSummaryBar
        rows={[
          { ...rows[0], status: 'delivered' },
          { ...rows[1], status: 'delivered' },
        ]}
        validationSettled
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('deliverable-summary-bar-badge').getAttribute('data-pulse-active')).toBe('true');
    });
  });

  it('expands to table shell on desktop toggle', async () => {
    render(
      <SessionDeliverableSummaryBar rows={rows} contractHash="hash-1" validationSettled isMobile={false} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-deliverable-summary-bar-toggle')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('session-deliverable-summary-bar-toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('session-deliverable-summary-expanded')).toBeTruthy();
    });
  });

  it('opens mobile sheet instead of inline expand', async () => {
    const onOpenMobileSheet = vi.fn();
    render(
      <SessionDeliverableSummaryBar rows={rows} contractHash="hash-1" isMobile onOpenMobileSheet={onOpenMobileSheet} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-deliverable-summary-bar-toggle')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('session-deliverable-summary-bar-toggle'));
    expect(onOpenMobileSheet).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('session-deliverable-summary-expanded')).toBeNull();
  });
});
