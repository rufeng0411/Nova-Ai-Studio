// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import {
  applyDeliverableRowPresentationLock,
  readDeliverablePresentationLockStore,
} from './deliverableRowPresentationLock';

const deliveredRow = (id: string, path: string): DeliverableDockRow => ({
  id,
  label: id,
  path,
  resolvedPath: path,
  status: 'delivered',
  linkable: true,
  previewable: true,
});

describe('deliverableRowPresentationLock', () => {
  it('locks delivered rows when validation settles', () => {
    const rows: DeliverableDockRow[] = [
      deliveredRow('report', 'artifacts/task-a/report.md'),
      { id: 'poster', label: 'poster', path: 'artifacts/task-a/poster.png', status: 'missing', linkable: false, previewable: false },
    ];

    const first = applyDeliverableRowPresentationLock(rows, {
      sessionId: 's1',
      contractHash: 'hash-a',
      lockStore: {},
      validationSettled: true,
    });

    const regressed: DeliverableDockRow[] = [
      { ...rows[0], status: 'checking', linkable: false, previewable: false },
      rows[1],
    ];

    const second = applyDeliverableRowPresentationLock(regressed, {
      sessionId: 's1',
      contractHash: 'hash-a',
      lockStore: first.lockStore,
      validationSettled: true,
    });

    expect(second.rows[0].status).toBe('delivered');
    expect(second.rows[0].resolvedPath).toBe('artifacts/task-a/report.md');
  });

  it('allows downgrade when engine reports basename missing', () => {
    const rows: DeliverableDockRow[] = [
      deliveredRow('report', 'artifacts/task-a/report.md'),
    ];
    const locked = applyDeliverableRowPresentationLock(rows, {
      sessionId: 's1',
      contractHash: 'hash-a',
      lockStore: {},
      validationSettled: true,
    });

    const regressed: DeliverableDockRow[] = [
      { ...rows[0], status: 'missing', resolvedPath: undefined, linkable: false, previewable: false },
    ];

    const result = applyDeliverableRowPresentationLock(regressed, {
      sessionId: 's1',
      contractHash: 'hash-a',
      lockStore: locked.lockStore,
      validationSettled: true,
      engineMissingPaths: ['report.md'],
    });

    expect(result.rows[0].status).toBe('missing');
  });

  it('readDeliverablePresentationLockStore returns empty object for undefined', () => {
    expect(readDeliverablePresentationLockStore(undefined)).toEqual({});
  });
});
