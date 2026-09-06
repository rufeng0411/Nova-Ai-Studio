// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import DeliverableSummaryTable from './DeliverableSummaryTable';

afterEach(() => {
  cleanup();
});

describe('DeliverableSummaryTable contract columns', () => {
  it('renders four canonical column headers via i18n', () => {
    renderWithProviders(
      <DeliverableSummaryTable
        items={[]}
        expectedManifest={[{ id: 'a', label: '报告', kind: 'markdown', path: 'artifacts/a.md' }]}
        forceShow
        validationSettled
      />,
    );

    expect(screen.getByText('成果清单')).toBeTruthy();
    expect(screen.getByText('成果名称')).toBeTruthy();
    expect(screen.getByText('文件类型')).toBeTruthy();
    expect(screen.getByText('状态')).toBeTruthy();
    expect(screen.getByText('文件链接')).toBeTruthy();
    expect(screen.getByTestId('deliverable-summary-table')).toBeTruthy();
  });
});
