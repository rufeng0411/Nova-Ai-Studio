import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecoveryGuidanceCard } from './RecoveryGuidanceCard';

describe('RecoveryGuidanceCard', () => {
  it('shows formal stop copy when budget exhausted', () => {
    render(<RecoveryGuidanceCard budgetRemaining={0} category="network" />);
    expect(screen.getByTestId('recovery-guidance-card')).toBeTruthy();
    expect(screen.getByText(/暂时未能自动完成|Could not finish automatically/)).toBeTruthy();
  });

  it('hides when budget remains', () => {
    const { container } = render(<RecoveryGuidanceCard budgetRemaining={3} />);
    expect(container.firstChild).toBeNull();
  });
});
