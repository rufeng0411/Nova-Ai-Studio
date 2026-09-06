// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeliverableHistoricalFootnote from './DeliverableHistoricalFootnote';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string; count?: number; done?: number; total?: number }) => {
      if (key === 'deliverables.historicalTurnFootnote') {
        return `本回合曾交付 ${opts?.count ?? 0} 项 · 以底部成果清单为准`;
      }
      return opts?.defaultValue ?? key;
    },
    i18n: { language: 'zh-CN' },
  }),
  I18nextProvider: ({ children }: { children: unknown }) => children,
}));

afterEach(() => {
  cleanup();
});

describe('DeliverableHistoricalFootnote', () => {
  it('renders muted count footnote', async () => {
    render(<DeliverableHistoricalFootnote done={2} total={3} />);
    await waitFor(() => {
      expect(screen.getByTestId('deliverable-historical-footnote')).toBeTruthy();
    });
    expect(screen.getByText(/本回合曾交付 3 项/)).toBeTruthy();
    expect(screen.getByTestId('deliverable-historical-footnote').className).toMatch(/text-\[11px\]/);
  });

  it('renders empty-state footnote when no count', async () => {
    render(<DeliverableHistoricalFootnote done={0} total={0} />);
    await waitFor(() => {
      expect(screen.getByText(/本回合曾有成果记录/)).toBeTruthy();
    });
  });
});
