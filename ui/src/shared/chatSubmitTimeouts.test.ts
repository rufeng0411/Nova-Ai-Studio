import { describe, expect, it } from 'vitest';

import { createSubmitFirstFrameTracker } from './chatSubmitTimeouts';

describe('createSubmitFirstFrameTracker', () => {
  it('keeps first-frame timeout disabled after any response frame arrives', () => {
    const tracker = createSubmitFirstFrameTracker({
      messages: 1,
      activities: 0,
      hasStatus: false,
    });

    expect(tracker.shouldTimeout()).toBe(true);

    tracker.observe({
      messages: 1,
      activities: 1,
      hasStatus: false,
    });

    expect(tracker.shouldTimeout()).toBe(false);

    tracker.observe({
      messages: 1,
      activities: 1,
      hasStatus: false,
    });

    expect(tracker.shouldTimeout()).toBe(false);
  });
});
