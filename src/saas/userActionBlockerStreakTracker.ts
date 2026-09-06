// PD-SAAS-FORK: consecutive identical user-action blockers (三确同错再停)

export const USER_ACTION_BLOCKER_CONFIRM_THRESHOLD = 3;

export class UserActionBlockerStreakTracker {
  private lastFingerprint: string | null = null;
  private lastContextKey: string | null = null;
  private streak = 0;

  record(fingerprint: string): number {
    const fp = fingerprint.trim();
    if (!fp) {
      this.reset();
      return 0;
    }
    if (this.lastFingerprint === fp) {
      this.streak += 1;
    } else {
      this.lastFingerprint = fp;
      this.streak = 1;
    }
    return this.streak;
  }

  recordForContext(fingerprint: string, context: {
    userGoal?: string;
    capabilitySlug?: string;
    turnBoundary?: string;
  } = {}): number {
    const contextKey = buildUserActionBlockerContextKey(context);
    if (contextKey && this.lastContextKey && this.lastContextKey !== contextKey) {
      this.reset();
    }
    this.lastContextKey = contextKey || this.lastContextKey;
    return this.record(fingerprint);
  }

  currentStreak(): number {
    return this.streak;
  }

  lastFingerprintValue(): string | null {
    return this.lastFingerprint;
  }

  isConfirmed(): boolean {
    return this.streak >= USER_ACTION_BLOCKER_CONFIRM_THRESHOLD;
  }

  reset(fingerprint?: string): void {
    if (fingerprint && this.lastFingerprint !== fingerprint.trim()) {
      return;
    }
    this.lastFingerprint = null;
    this.lastContextKey = null;
    this.streak = 0;
  }
}

export function buildUserActionBlockerContextKey(context: {
  userGoal?: string;
  capabilitySlug?: string;
  /**
   * PD-SAAS-FORK: accepted for call-site compatibility but intentionally excluded
   * from the key. Auto-continue mints a fresh turnId every turn; folding it into the
   * context key reset the streak each turn, so a hard blocker (missing key/attachment/
   * permission) could never reach the 3-strike fast-stop and would retry forever. The
   * streak is anchored on goal + capability so the same blocker accumulates across
   * turns, while a genuine goal/capability change still resets it.
   */
  turnBoundary?: string;
}): string {
  const goal = String(context.userGoal ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const capability = String(context.capabilitySlug ?? "").trim();
  return [goal, capability].filter(Boolean).join("|");
}

const sessionTrackers = new Map<string, UserActionBlockerStreakTracker>();

export function getUserActionBlockerTracker(sessionId: string): UserActionBlockerStreakTracker {
  const key = sessionId.trim();
  if (!key) return new UserActionBlockerStreakTracker();
  let tracker = sessionTrackers.get(key);
  if (!tracker) {
    tracker = new UserActionBlockerStreakTracker();
    sessionTrackers.set(key, tracker);
  }
  return tracker;
}

export function isUserActionBlockerResetText(text: string): boolean {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return /^(已配置|配置好了|已设置|已上传|上传好了|已授权|授权好了)[，,\s]*(继续|继续做|继续执行)?$/.test(normalized)
    || /^(configured|uploaded|authorized|fixed|done)[,\s]*(continue|resume|go on)?$/.test(normalized);
}

/** @internal test helper */
export function _clearUserActionBlockerTrackersForTests(): void {
  sessionTrackers.clear();
}
