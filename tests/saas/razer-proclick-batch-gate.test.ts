import { describe, expect, it, beforeAll } from "vitest";
import {
  parseMustDeliverClause,
  resolveAuthoritativeSdmSlots,
  stripDeliverableAnnotation,
} from "../../src/saas/deliverables/deliverableChecklistAuthority.js";
import {
  pathSatisfiesSdmSlot,
  slotSatisfiedByValidation,
} from "../../src/saas/deliverables/sdmSlotMatching.js";
import { shouldTriggerDeliverableRepair } from "../../src/saas/taskContinuationPolicy.js";
import {
  RAZER_GEO_KEYWORD_POLLUTED_GOAL,
  RAZER_GEO_KEYWORD_VERIFIED,
  RAZER_PROCLICK_BATCH_FIXTURES,
} from "../../tests/fixtures/razer-proclick-batch-20260727.js";

describe("razer-proclick-batch gate L1", () => {
  beforeAll(() => {
    process.env.PILOTDECK_SDM_GEO_KEYWORD_ALIAS = "1";
    process.env.PILOTDECK_REPAIR_ALIAS_SHORT_CIRCUIT = "1";
    process.env.PILOTDECK_SDM_PARSE_MUST_DELIVER = "1";
    process.env.PILOTDECK_SAAS_MODE = "1";
  });

  it("stripDeliverableAnnotation removes paren pollution from path labels", () => {
    expect(stripDeliverableAnnotation("keywords.md（核心词与用户问句）")).toBe("keywords.md");
    expect(stripDeliverableAnnotation("keywords.html（与 keywords.md 同步）")).toBe("keywords.html");
  });

  it("polluted geo-keyword try goal compiles clean keywords.md/html slots", () => {
    const slots = parseMustDeliverClause(RAZER_GEO_KEYWORD_POLLUTED_GOAL);
    expect(slots.map((s) => s.pathHint)).toEqual(["keywords.md", "keywords.html"]);
    for (const slot of slots) {
      expect(slot.pathHint).not.toMatch(/[（(]/);
      expect(slot.pathHint).not.toMatch(/写入系统分配/);
    }
  });

  it("Chinese verified paths satisfy geo keyword slots via alias", () => {
    const slots = resolveAuthoritativeSdmSlots({
      userGoal: RAZER_GEO_KEYWORD_POLLUTED_GOAL,
      capabilitySlug: "geo-keyword-research",
      profileId: "geo_keyword",
      parseNumberedList: parseMustDeliverClause,
    });
    const mdSlot = slots.find((s) => s.pathHint === "keywords.md");
    const htmlSlot = slots.find((s) => s.pathHint === "keywords.html");
    expect(mdSlot).toBeTruthy();
    expect(htmlSlot).toBeTruthy();
    expect(slotSatisfiedByValidation(mdSlot!, RAZER_GEO_KEYWORD_VERIFIED, {
      taskArtifactDir: "artifacts/task-20260727-razer01",
    })).toBe(true);
    expect(slotSatisfiedByValidation(htmlSlot!, RAZER_GEO_KEYWORD_VERIFIED, {
      taskArtifactDir: "artifacts/task-20260727-razer01",
    })).toBe(true);
  });

  it("alias short-circuit stops repair when verified Chinese files exist", () => {
    const slots = parseMustDeliverClause(RAZER_GEO_KEYWORD_POLLUTED_GOAL);
    const repair = shouldTriggerDeliverableRepair({
      userGoal: RAZER_GEO_KEYWORD_POLLUTED_GOAL,
      capabilitySlug: "geo-keyword-research",
      sessionManifest: {
        slots,
        taskArtifactDir: "artifacts/task-20260727-razer01",
      },
      validationResult: {
        acceptance: "needs_repair",
        verified: RAZER_GEO_KEYWORD_VERIFIED,
        missing: ["keywords.md", "keywords.html"],
        broken: [],
        completionState: "incomplete",
      },
    });
    expect(repair).toBe(false);
  });

  for (const fixture of RAZER_PROCLICK_BATCH_FIXTURES) {
    it(`${fixture.caseId}: SDM compile gate`, () => {
      const slots = resolveAuthoritativeSdmSlots({
        userGoal: fixture.userGoal,
        capabilitySlug: fixture.capabilitySlug,
        profileId: fixture.expectProfileId,
        parseNumberedList: parseMustDeliverClause,
      });

      if (fixture.chatFirst) {
        expect(slots.length).toBeLessThanOrEqual(fixture.maxSlots ?? 0);
        return;
      }

      if (fixture.minSlots != null) {
        expect(slots.length).toBeGreaterThanOrEqual(fixture.minSlots);
      }

      const hints = slots.flatMap((s) => [s.pathHint, ...(s.pathHints ?? [])].filter(Boolean));
      for (const forbidden of fixture.forbiddenPathHints) {
        expect(hints.some((h) => String(h).includes(forbidden))).toBe(false);
      }
      for (const required of fixture.requiredPathHints) {
        if (required.startsWith(".")) continue;
        expect(hints.some((h) => String(h).toLowerCase().includes(required.toLowerCase()))).toBe(true);
      }
    });
  }

  it("pathSatisfiesSdmSlot matches Chinese GEO html basename to keywords.html slot", () => {
    const slot = { id: "kw_html", pathHint: "keywords.html", kind: "html" };
    expect(
      pathSatisfiesSdmSlot(
        "artifacts/task-20260727-razer01/雷蛇 Pro Click V2 GEO 关键词研究.html",
        slot,
      ),
    ).toBe(true);
  });
});
