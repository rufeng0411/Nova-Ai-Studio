import { describe, expect, it } from 'vitest';

import { resolveDeliverableSlotFromToolPath } from './resolveDeliverableSlotFromToolPath';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';

const manifest: SessionDeliverableManifestUi = {
  manifestVersion: 1,
  goalVersion: 1,
  sessionGoalAnchor: 'test',
  slots: [
    {
      id: 's1',
      label: '市场调研',
      pathHint: 'market-research.md',
      status: 'active',
    },
    {
      id: 's2',
      label: '定位定价',
      pathHint: 'positioning-pricing.md',
      status: 'pending',
    },
  ],
};

describe('resolveDeliverableSlotFromToolPath', () => {
  it('maps write path to slot index and basename', () => {
    const hint = resolveDeliverableSlotFromToolPath(
      'artifacts/task-x/market-research.md',
      manifest,
    );
    expect(hint).toEqual({
      slotIndex: 1,
      slotTotal: 2,
      label: '市场调研',
      basename: 'market-research.md',
    });
  });

  it('returns null when path does not match manifest', () => {
    expect(resolveDeliverableSlotFromToolPath('readme.md', manifest)).toBeNull();
  });
});
