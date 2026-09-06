// PD-SAAS-FORK: consecutive hard-fail classifications (auth/billing/gateway)
import type { ErrorClassification } from "./errorClassifier.js";
import { shouldFastFailClassification } from "./errorClassifier.js";

export class HardFailStreakTracker {
  private lastClass: ErrorClassification | null = null;
  private streak = 0;

  record(classification: ErrorClassification): number {
    if (!shouldFastFailClassification(classification)) {
      this.lastClass = null;
      this.streak = 0;
      return 0;
    }
    if (this.lastClass === classification) {
      this.streak += 1;
    } else {
      this.lastClass = classification;
      this.streak = 1;
    }
    return this.streak;
  }

  currentStreak(): number {
    return this.streak;
  }

  lastClassification(): ErrorClassification | null {
    return this.lastClass;
  }

  reset(): void {
    this.lastClass = null;
    this.streak = 0;
  }
}
