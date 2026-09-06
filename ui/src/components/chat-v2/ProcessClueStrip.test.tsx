import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessClueStrip } from './ProcessClueStrip';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => ({
      'process.recovery.autoContinue': '继续推进',
      'process.recovery.toolRecovery': '自动调整',
    }[key] ?? opts?.defaultValue ?? key),
  }),
}));

describe('ProcessClueStrip', () => {
  it('shows 继续推进 for auto_continue recovery', () => {
    render(
      <ProcessClueStrip
        clues={[
          {
            id: 'r1',
            kind: 'recovery',
            label: 'auto_continue',
            recoveryReason: 'auto_continue',
          },
        ]}
      />,
    );
    expect(screen.getByText(/继续推进/)).toBeTruthy();
  });

  it('shows 自动调整 for tool_recovery', () => {
    render(
      <ProcessClueStrip
        clues={[
          {
            id: 'r2',
            kind: 'recovery',
            label: 'tool_recovery',
            recoveryReason: 'tool_recovery',
          },
        ]}
      />,
    );
    expect(screen.getByText(/自动调整/)).toBeTruthy();
  });
});
