import { describe, expect, it, beforeEach } from "vitest";

import { FOUR_CASE_NOVAPAGE_FIXTURES } from "../fixtures/four-case-novapage-rca-20260726.js";
import { applyParallelGroupHints, compileSessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { slotSatisfiedByValidation } from "../../src/saas/deliverables/sdmSlotMatching.js";
import { ES9_FOUR_FORMAT_VAP_GOAL } from "../fixtures/es9-four-format-vap-case.js";

describe("four-case novapage P0′ SDM replay", () => {
  beforeEach(() => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES = "1";
    process.env.PILOTDECK_SDM_PARSE_MUST_DELIVER = "1";
    process.env.PILOTDECK_PARALLEL_OFFICE_EXPORT = "enforce";
  });

  for (const fixture of FOUR_CASE_NOVAPAGE_FIXTURES) {
    it(`${fixture.caseId}: compiles SDM without phantom office slots`, () => {
      const manifest = compileSessionDeliverableManifest({
        userGoal: fixture.userGoal,
        capabilitySlug: fixture.capabilitySlug,
        turnId: `t-${fixture.caseId}`,
      });
      expect(manifest).toBeTruthy();
      const slots = manifest!.slots.filter((s) => s.status !== "removed");
      expect(slots.length).toBeGreaterThanOrEqual(fixture.minSlots);
      if (fixture.expectProfileId) {
        expect(manifest!.profileId).toBe(fixture.expectProfileId);
      }
      const hints = slots.flatMap((s) => [
        s.pathHint,
        ...(s.pathHints ?? []),
        s.id,
        s.label ?? "",
      ].filter(Boolean)).join(" ");
      for (const forbidden of fixture.forbiddenPathHints) {
        expect(hints).not.toContain(forbidden);
      }
      for (const required of fixture.requiredPathHints) {
        expect(hints).toMatch(new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
      expect(slots.some((s) => s.parallelGroup === "office-export")).toBe(false);
    });
  }

  it("launch: 03-social-slices.md satisfies social slot", () => {
    const fixture = FOUR_CASE_NOVAPAGE_FIXTURES.find((c) => c.caseId === "novapage-launch")!;
    const manifest = compileSessionDeliverableManifest({
      userGoal: fixture.userGoal,
      capabilitySlug: fixture.capabilitySlug,
      turnId: "t-launch-slot",
    });
    const socialSlot = manifest!.slots.find((s) =>
      (s.pathHint ?? "").includes("03-social-slices")
      || (s.pathHints ?? []).some((h) => h.includes("03-social-slices")),
    );
    expect(socialSlot).toBeTruthy();
    expect(
      slotSatisfiedByValidation(socialSlot!, [
        "artifacts/task-demo/03-social-slices.md",
      ]),
    ).toBe(true);
  });

  it("ES9 four-format still tags office-export when explicit office pack", () => {
    const manifest = compileSessionDeliverableManifest({
      userGoal: ES9_FOUR_FORMAT_VAP_GOAL,
      turnId: "t-es9",
    });
    const hinted = applyParallelGroupHints(manifest!, ES9_FOUR_FORMAT_VAP_GOAL);
    expect(hinted.slots.some((s) => s.parallelGroup === "office-export")).toBe(true);
  });

  it("campaign full-case does not get office-export phantom from parallel hints", () => {
    const fixture = FOUR_CASE_NOVAPAGE_FIXTURES.find((c) => c.caseId === "novapage-campaign")!;
    const manifest = compileSessionDeliverableManifest({
      userGoal: fixture.userGoal,
      turnId: "t-campaign-phantom",
    });
    const hinted = applyParallelGroupHints(manifest!, fixture.userGoal);
    expect(hinted.slots.some((s) => /office_export|research-report\.docx/i.test(String(s.pathHint)))).toBe(false);
  });
});
