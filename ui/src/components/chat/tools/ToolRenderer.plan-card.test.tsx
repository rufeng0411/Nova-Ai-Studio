// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { ToolRenderer } from './ToolRenderer';
import { planApprovedCardHasContent } from './components/ContentRenderers/PlanApprovedCard';

afterEach(() => {
  cleanup();
});

describe('planApprovedCardHasContent', () => {
  it('returns false when summary and file path are empty', () => {
    expect(planApprovedCardHasContent('', '')).toBe(false);
    expect(planApprovedCardHasContent('   ', '')).toBe(false);
  });

  it('returns true when file path or summary is present', () => {
    expect(planApprovedCardHasContent('', 'artifacts/plan.md')).toBe(true);
    expect(planApprovedCardHasContent('Step one', '')).toBe(true);
  });
});

describe('ToolRenderer exit_plan_mode plan-card', () => {
  it('renders nothing for empty plan result', () => {
    const { container } = renderWithProviders(
      <ToolRenderer
        toolName="exit_plan_mode"
        toolInput={{}}
        toolResult={{ planTitle: 'Implementation Plan' }}
        mode="result"
      />,
    );
    expect(container.textContent?.trim()).toBe('');
    expect(screen.queryByText(/查看计划|View Plan/i)).toBeNull();
  });

  it('renders card when plan file path is present', () => {
    renderWithProviders(
      <ToolRenderer
        toolName="exit_plan_mode"
        toolInput={{}}
        toolResult={{
          planTitle: 'Implementation Plan',
          planFilePath: 'artifacts/campaign/plan.md',
        }}
        mode="result"
        onFileOpen={vi.fn()}
      />,
    );
    expect(screen.getByText(/查看计划|View Plan/i)).toBeTruthy();
  });
});
