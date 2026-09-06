import { describe, expect, it } from 'vitest';
import { shouldShowDeliverableComposerChrome } from './deliverableDockPolicy';

describe('deliverableDockPolicy', () => {
  it('shows chrome when rows exist', () => {
    expect(shouldShowDeliverableComposerChrome({
      rowCount: 2,
      hasSessionManifest: false,
      hasFolderPath: false,
      isDeliverableTask: false,
    })).toBe(true);
  });

  it('shows chrome for deliverable task without rows yet', () => {
    expect(shouldShowDeliverableComposerChrome({
      rowCount: 0,
      hasSessionManifest: false,
      hasFolderPath: false,
      isDeliverableTask: true,
    })).toBe(true);
  });

  it('hides chrome for empty non-deliverable chat', () => {
    expect(shouldShowDeliverableComposerChrome({
      rowCount: 0,
      hasSessionManifest: false,
      hasFolderPath: false,
      isDeliverableTask: false,
    })).toBe(false);
  });
});
