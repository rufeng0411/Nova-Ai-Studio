// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import DeliverableSessionDock from './DeliverableSessionDock';

afterEach(() => {
  cleanup();
});

describe('DeliverableSessionDock quality status', () => {
  it('shows the same certificate-backed status as the summary table', () => {
    renderWithProviders(
      <DeliverableSessionDock
        rows={[{
          id: 'report',
          label: '报告',
          path: 'artifacts/report.md',
          resolvedPath: 'artifacts/report.md',
          status: 'delivered',
          previewable: true,
          linkable: true,
        }]}
        qualityStatus={{
          completionState: 'accepted_partial',
          partialReason: 'official_media_degraded',
          qualityCompletion: 'degraded_acceptable',
        }}
      />,
    );

    expect(screen.getByTestId('deliverable-quality-status').textContent)
      .toContain('已接受部分成果 · 官方素材已降级');
  });
});
