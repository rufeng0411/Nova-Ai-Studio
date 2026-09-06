/** Stop the composer loading state when no first response frame arrives. */
export const SUBMIT_FIRST_FRAME_TIMEOUT_MS = 45_000;

export type SubmitFirstFrameSnapshot = {
  messages: number;
  activities: number;
  hasStatus: boolean;
};

export type SubmitFirstFrameTrackerOptions = {
  /** PD-SAAS-FORK: deliverable goals keep weak in-flight past first-frame timeout. */
  weakInFlightDeliverableGoal?: boolean;
};

export type SubmitFirstFrameTracker = {
  observe: (snapshot: SubmitFirstFrameSnapshot) => boolean;
  shouldTimeout: () => boolean;
  stop: () => void;
};

function hasResponseFrame(
  baseline: SubmitFirstFrameSnapshot,
  snapshot: SubmitFirstFrameSnapshot,
): boolean {
  return (
    snapshot.messages > baseline.messages
    || snapshot.activities > baseline.activities
    || (!baseline.hasStatus && snapshot.hasStatus)
  );
}

// PD-SAAS-FORK: first-frame timeout is a pre-response guard only. Long idle
// after a tool/status frame is handled by the stale-turn watchdog instead.
export function createSubmitFirstFrameTracker(
  baseline: SubmitFirstFrameSnapshot,
  options?: SubmitFirstFrameTrackerOptions,
): SubmitFirstFrameTracker {
  let satisfied = baseline.hasStatus;
  const weakInFlightDeliverableGoal = options?.weakInFlightDeliverableGoal === true;

  return {
    observe(snapshot) {
      if (satisfied) return false;
      if (!hasResponseFrame(baseline, snapshot)) return false;
      satisfied = true;
      return true;
    },
    shouldTimeout() {
      if (weakInFlightDeliverableGoal) return false;
      return !satisfied;
    },
    stop() {
      satisfied = true;
    },
  };
}
