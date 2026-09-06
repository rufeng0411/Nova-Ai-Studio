import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessTimeline } from './ProcessTimeline';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('ProcessTimeline', () => {
  it('renders tool-like process steps as one-line localized tool copy', () => {
    render(
      <ProcessTimeline
        mode="live"
        steps={[
          {
            id: 'stage-1',
            title: '正在准备对话',
            kind: 'activity',
            phase: 'tool',
            state: 'running',
          },
        ]}
        expanded
        onExpandedChange={() => {}}
      />,
    );

    expect(screen.getByText('使用工具：正在准备对话')).toBeTruthy();
  });

  it('does not render internal process keys as detail text', () => {
    render(
      <ProcessTimeline
        mode="live"
        steps={[
          {
            id: 'stage-1',
            title: '正在准备对话',
            detail: 'session_prepare',
            kind: 'activity',
            phase: 'tool',
            state: 'running',
          },
        ]}
        expanded
        onExpandedChange={() => {}}
      />,
    );

    expect(screen.getByText('使用工具：正在准备对话')).toBeTruthy();
    expect(screen.queryByText('session_prepare')).toBeNull();
  });

  it('suppresses duplicate live header when embedded in the sticky dock', () => {
    render(
      <ProcessTimeline
        mode="live"
        steps={[
          { id: 's1', title: '正在准备对话', kind: 'activity', phase: 'tool', state: 'running' },
        ]}
        isRunning
        suppressLiveHeader
        expanded={false}
        onExpandedChange={() => {}}
      />,
    );

    expect(screen.queryByText('思考与制作中…')).toBeNull();
    expect(screen.getByText('使用工具：正在准备对话')).toBeTruthy();
  });

  it('does not render ordered step numbers in the process list', () => {
    render(
      <ProcessTimeline
        mode="live"
        steps={[
          { id: 's1', title: '正在准备对话', kind: 'activity', phase: 'tool', state: 'completed' },
          { id: 's2', title: '正在读取相关记忆', kind: 'activity', phase: 'tool', state: 'running' },
        ]}
        expanded
        onExpandedChange={() => {}}
      />,
    );

    const list = screen.getByTestId('process-timeline').querySelector('[data-process-step-list]');
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll('li')).toHaveLength(2);
    expect(screen.queryByText(/^1\.$/)).toBeNull();
    expect(screen.queryByText(/^2\.$/)).toBeNull();
  });

  it('uses live scroll viewport and keeps full step list in DOM', () => {
    const steps = Array.from({ length: 12 }, (_, index) => ({
      id: `step-${index}`,
      title: `步骤 ${index + 1}`,
      kind: 'activity' as const,
      phase: 'tool',
      state: index === 11 ? 'running' as const : 'completed' as const,
    }));

    const { container } = render(
      <ProcessTimeline
        mode="live"
        steps={steps}
        maxVisibleSteps={8}
        isRunning
        expanded={false}
        onExpandedChange={() => {}}
      />,
    );

    const root = within(container);
    expect(root.getByTestId('process-timeline-live-viewport')).toBeTruthy();
    expect(root.getAllByText(/使用工具：步骤 \d+/)).toHaveLength(12);
    expect(root.getByText('使用工具：步骤 12')).toBeTruthy();
    expect(root.getByText('使用工具：步骤 1')).toBeTruthy();
  });

  it('shows top and bottom collapse controls when live expanded inline after turn completes', () => {
    const onExpandedChange = vi.fn();
    render(
      <ProcessTimeline
        mode="live"
        steps={Array.from({ length: 12 }, (_, index) => ({
          id: `step-${index}`,
          title: `步骤 ${index + 1}`,
          kind: 'activity' as const,
          phase: 'tool',
        }))}
        maxVisibleSteps={8}
        expanded
        isRunning={false}
        showLiveCollapseTop
        showLiveCollapseBottom
        onExpandedChange={onExpandedChange}
      />,
    );

    expect(screen.getByText('全部过程')).toBeTruthy();
    const collapseButtons = screen.getAllByText('收起过程');
    expect(collapseButtons.length).toBeGreaterThanOrEqual(2);
    collapseButtons[0]?.click();
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('hides collapse controls while live process is still running', () => {
    render(
      <ProcessTimeline
        mode="live"
        steps={[
          { id: 's1', title: '正在准备对话', kind: 'activity', phase: 'tool', state: 'running' },
        ]}
        expanded
        isRunning
        showLiveCollapseTop
        showLiveCollapseBottom
        onExpandedChange={() => {}}
      />,
    );

    expect(screen.getByText('全部过程')).toBeTruthy();
    expect(screen.queryByText('收起过程')).toBeNull();
  });

  it('does not use live scroll viewport when expanded', () => {
    const { container } = render(
      <ProcessTimeline
        mode="live"
        steps={Array.from({ length: 12 }, (_, index) => ({
          id: `step-${index}`,
          title: `步骤 ${index + 1}`,
          kind: 'activity',
          phase: 'tool',
        }))}
        maxVisibleSteps={8}
        expanded
        onExpandedChange={() => {}}
      />,
    );

    expect(within(container).queryByTestId('process-timeline-live-viewport')).toBeNull();
  });
});
