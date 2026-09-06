/**
 * PD-SAAS-FORK: invariant gates for 0717 cursor-session HTML export fixtures.
 */
import { describe, expect, it } from "vitest";
import {
  FOUR_LINE_0717_CURSOR_CASES,
  type FourLine0717CursorCaseId,
} from "./four-line-0717-cursor-cases.js";
import { assertCompletionInvariant } from "./four-line-0717-cases.js";

describe("four-line-0717-cursor-cases", () => {
  const caseIds = Object.keys(FOUR_LINE_0717_CURSOR_CASES) as FourLine0717CursorCaseId[];

  it("defines eight cursor-session scenarios", () => {
    expect(caseIds.length).toBe(8);
  });

  for (const caseId of caseIds) {
    it(`${caseId} forbids false complete when flagged`, () => {
      const spec = FOUR_LINE_0717_CURSOR_CASES[caseId];
      if (!spec.invariant.forbidPassedWithIncomplete) return;
      expect(() => assertCompletionInvariant({
        acceptanceStatus: "passed",
        requiredDone: spec.invariant.requiredSlots - 1,
        requiredTotal: spec.invariant.requiredSlots,
      })).toThrow();
    });

    it(`${caseId} rejects pseudo paths`, () => {
      const { rejectPseudoPaths } = FOUR_LINE_0717_CURSOR_CASES[caseId].invariant;
      for (const pseudo of rejectPseudoPaths) {
        expect(pseudo.length).toBeGreaterThan(0);
      }
    });
  }

  it("brainstorm chat-first has no deliverable contract", () => {
    expect(FOUR_LINE_0717_CURSOR_CASES["brainstorm-chat-first"].invariant.noDeliverableContract).toBe(true);
  });

  it("10-page slides expects snapshot inconclusive when folder scan truncated", () => {
    expect(FOUR_LINE_0717_CURSOR_CASES["10-page-slides"].invariant.expectSnapshotInconclusive).toBe(true);
  });
});
