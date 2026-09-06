import { describe, expect, it } from 'vitest';
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { sessionDeliverableSummaryBarPropsEqual } from './sessionDeliverableSummaryBarPropsEqual';

describe('sessionDeliverableSummaryBarPropsEqual', () => {
  const baseRow: DeliverableDockRow = {
    id: 'a',
    label: 'Brief',
    path: 'artifacts/task/brief.md',
    status: 'delivered',
    linkable: true,
    previewable: true,
  };

  it('treats identical visible row state as equal', () => {
    const prev = { rows: [baseRow], contractHash: 'h1', validationSettled: true };
    const next = { rows: [{ ...baseRow }], contractHash: 'h1', validationSettled: true };
    expect(sessionDeliverableSummaryBarPropsEqual(prev, next)).toBe(true);
  });

  it('detects status changes', () => {
    const prev = { rows: [baseRow] };
    const next = { rows: [{ ...baseRow, status: 'missing' }] };
    expect(sessionDeliverableSummaryBarPropsEqual(prev, next)).toBe(false);
  });
});
