// PD-SAAS-FORK: cross-turn same tool+input failure tracker

type FailureKey = string;

export class CrossTurnToolFailureTracker {
  private counts = new Map<FailureKey, number>();

  record(toolName: string, inputHash: string): number {
    const key = `${toolName}:${inputHash}`;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  shouldTerminal(toolName: string, inputHash: string, threshold = 2): boolean {
    const key = `${toolName}:${inputHash}`;
    return (this.counts.get(key) ?? 0) >= threshold;
  }

  resetSession(): void {
    this.counts.clear();
  }
}

const sessionTrackers = new Map<string, CrossTurnToolFailureTracker>();

export function getCrossTurnToolFailureTracker(sessionId: string): CrossTurnToolFailureTracker {
  const key = sessionId.trim();
  if (!key) return new CrossTurnToolFailureTracker();
  let tracker = sessionTrackers.get(key);
  if (!tracker) {
    tracker = new CrossTurnToolFailureTracker();
    sessionTrackers.set(key, tracker);
  }
  return tracker;
}

/** @internal */
export function _clearCrossTurnToolFailureTrackersForTests(): void {
  sessionTrackers.clear();
}

export function hashToolInput(input: unknown): string {
  try {
    return JSON.stringify(input ?? {}).slice(0, 200);
  } catch {
    return String(input ?? "");
  }
}
