import { describe, expect, it } from "vitest";

import {
  isAcceptanceSatisfied,
  shouldStopAutomaticContinuation,
} from "./deliverableCompletionState.js";

describe("deliverable completion state predicates", () => {
  it.each(["complete", "accepted_partial"] as const)(
    "treats %s as acceptance-satisfied",
    (state) => {
      expect(isAcceptanceSatisfied(state)).toBe(true);
    },
  );

  it.each(["incomplete", "blocked"] as const)(
    "does not treat %s as acceptance-satisfied",
    (state) => {
      expect(isAcceptanceSatisfied(state)).toBe(false);
    },
  );

  it.each(["complete", "accepted_partial", "blocked"] as const)(
    "stops automatic continuation for %s",
    (state) => {
      expect(shouldStopAutomaticContinuation(state)).toBe(true);
    },
  );

  it("keeps automatic continuation available for incomplete work", () => {
    expect(shouldStopAutomaticContinuation("incomplete")).toBe(false);
  });
});
