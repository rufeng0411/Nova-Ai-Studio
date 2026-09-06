import { describe, expect, it } from "vitest";
import {
  countSyntheticStreakSinceLastRealUser,
  evaluateSessionSyntheticBudget,
  isSessionSyntheticBudgetEnabled,
} from "./sessionSyntheticTurnBudget.js";

describe("sessionSyntheticTurnBudget", () => {
  it("counts synthetic streak since last real user", () => {
    const messages = [
      { role: "user", content: "make ppt" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "continue", metadata: { synthetic: true, purpose: "auto_continue" } },
      { role: "user", content: "continue", metadata: { synthetic: true, purpose: "deliverable_repair" } },
    ];
    expect(countSyntheticStreakSinceLastRealUser(messages)).toBe(2);
  });

  it("exhausts when streak >= limit and verified unchanged", () => {
    const prev = process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET;
    process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET = "1";
    process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT = "2";
    try {
      expect(isSessionSyntheticBudgetEnabled()).toBe(true);
      const messages = [
        { role: "user", content: "goal" },
        { role: "user", content: "c1", metadata: { synthetic: true } },
        { role: "user", content: "c2", metadata: { synthetic: true } },
      ];
      const evalResult = evaluateSessionSyntheticBudget(messages, { verified: [], missing: ["a"], broken: [] });
      expect(evalResult.exhausted).toBe(true);
    } finally {
      if (prev == null) delete process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET;
      else process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET = prev;
      delete process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT;
    }
  });

  it("does not exhaust when missing shrinks despite synthetic streak", () => {
    const prev = process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET;
    process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET = "1";
    process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT = "2";
    try {
      const messages = [
        { role: "user", content: "goal" },
        { role: "assistant", metadata: { missingPaths: ["a.md", "b.md"] } },
        { role: "user", content: "c1", metadata: { synthetic: true } },
        { role: "user", content: "c2", metadata: { synthetic: true } },
      ];
      const evalResult = evaluateSessionSyntheticBudget(messages, {
        verified: ["a.md"],
        missing: ["b.md"],
        broken: [],
      });
      expect(evalResult.exhausted).toBe(false);
    } finally {
      if (prev == null) delete process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET;
      else process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET = prev;
      delete process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT;
    }
  });
});
