import { describe, expect, it } from 'vitest';
import { shouldSkipDeliverablePathResolve } from './deliverablePreviewFastPath';

describe('shouldSkipDeliverablePathResolve', () => {
  it('skips for full artifact paths', () => {
    expect(shouldSkipDeliverablePathResolve('artifacts/task-1/report.md')).toBe(true);
  });

  it('skips bare basename when hintDir scopes artifacts', () => {
    expect(shouldSkipDeliverablePathResolve('index.html', 'artifacts/task-a')).toBe(true);
  });

  it('does not skip ambiguous bare basename without hint', () => {
    expect(shouldSkipDeliverablePathResolve('index.html')).toBe(false);
  });

  it('does not skip cross-task deck.bento.html when hintDir scopes another task', () => {
    expect(
      shouldSkipDeliverablePathResolve(
        'artifacts/task-20260728-41dd1371/deck.bento.html',
        'artifacts/task-20260728-a1b2c3d4',
      ),
    ).toBe(false);
  });
});
