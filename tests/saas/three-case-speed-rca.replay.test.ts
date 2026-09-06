import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { compileSessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { shouldBypassOrchestrationForCapability } from "../../src/router/orchestrate/shouldBypassOrchestration.js";
import { matrixCoreSlotsSatisfied } from "../../src/saas/deliverables/deliverableGroundTruth.js";
import {
  BLACKCLOAK_MATRIX_GOAL,
  GEO_BRAND_FULL_GOAL,
  SPONGEBOB_US_RESEARCH_GOAL,
  THREE_CASE_SPEED_RCA_FIXTURES,
} from "../fixtures/three-case-speed-rca-20260726.js";

describe("three-case speed RCA replay", () => {
  const prevBypass = process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO;
  const prevGt = process.env.PILOTDECK_MATRIX_CORE_GT_PASS;
  const prevSdm = process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;

  beforeEach(() => {
    process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO = "1";
    process.env.PILOTDECK_MATRIX_CORE_GT_PASS = "1";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
  });

  afterEach(() => {
    if (prevBypass === undefined) delete process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO;
    else process.env.PILOTDECK_ORCH_BYPASS_MATRIX_GEO = prevBypass;
    if (prevGt === undefined) delete process.env.PILOTDECK_MATRIX_CORE_GT_PASS;
    else process.env.PILOTDECK_MATRIX_CORE_GT_PASS = prevGt;
    if (prevSdm === undefined) delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    else process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = prevSdm;
  });

  for (const fixture of THREE_CASE_SPEED_RCA_FIXTURES) {
    it(`${fixture.caseId}: bypass orchestration when flagged`, () => {
      expect(
        shouldBypassOrchestrationForCapability(fixture.capabilitySlug, undefined, fixture.goal),
      ).toBe(fixture.expectBypassOrch);
    });

    it(`${fixture.caseId}: SDM has no flywheel phantom slots`, () => {
      const manifest = compileSessionDeliverableManifest({
        userGoal: fixture.goal,
        capabilitySlug: fixture.capabilitySlug,
        turnId: "replay-turn",
        taskArtifactDir: "artifacts/task-20260726-replay",
        taskDirKey: "20260726-replay",
      });
      expect(manifest).not.toBeNull();
      const slotText = (manifest?.slots ?? [])
        .filter((s) => s.status !== "removed")
        .map((s) => `${s.label} ${s.pathHint ?? ""} ${(s.pathHints ?? []).join(" ")}`)
        .join("\n");
      for (const forbidden of fixture.forbiddenSlotHints) {
        expect(slotText).not.toMatch(new RegExp(forbidden, "i"));
      }
      expect(manifest?.profileId).not.toBe("content_flywheel");
      const active = (manifest?.slots ?? []).filter((s) => s.status !== "removed");
      expect(active.length).toBeLessThanOrEqual(fixture.maxSlots);
      for (const slot of active) {
        if (/^(?:成果文件|deliverable|交付物)$/i.test(String(slot.label ?? "").trim())) {
          expect(slot.pathHint ?? slot.pathHints?.[0]).toBeTruthy();
        }
      }
    });
  }

  it("matrix core GT pass with 7 verified platform files", () => {
    const verified = [
      "artifacts/task-20260726-b75064fd/article.md",
      "artifacts/task-20260726-b75064fd/zhihu.md",
      "artifacts/task-20260726-b75064fd/xiaohongshu.md",
      "artifacts/task-20260726-b75064fd/wechat.md",
      "artifacts/task-20260726-b75064fd/douyin.md",
      "artifacts/task-20260726-b75064fd/bilibili.md",
      "artifacts/task-20260726-b75064fd/data-sources.md",
    ];
    expect(matrixCoreSlotsSatisfied(BLACKCLOAK_MATRIX_GOAL, verified)).toBe(true);
  });

  it("spongebob goal compiles without matrix profile hijack", () => {
    const manifest = compileSessionDeliverableManifest({
      userGoal: SPONGEBOB_US_RESEARCH_GOAL,
      capabilitySlug: "nova-research-user-general",
      turnId: "replay-turn",
    });
    expect(manifest?.profileId).not.toBe("content_flywheel");
  });

  it("geo full case bypasses without slug", () => {
    expect(shouldBypassOrchestrationForCapability(undefined, undefined, GEO_BRAND_FULL_GOAL)).toBe(true);
  });
});
