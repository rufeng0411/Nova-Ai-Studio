/**
 * PD-SAAS-FORK: 0717 七案结构不变量回归（匿名 fixture，无用户数据）
 */
import { describe, expect, it } from "vitest";
import {
  FOUR_LINE_0717_CASES,
  assertCompletionInvariant,
  type FourLine0717CaseId,
} from "./four-line-0717-cases.js";
import {
  buildBrandCampaignSdmSlots,
  isBrandCampaignFullCaseGoal,
  isWorldcupCampaignFullCaseGoal,
  resolveCampaignSdmSlots,
} from "../../src/saas/deliverables/campaignDeliverableCompleteness.js";
import { parseNumberedDeliverableList } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { resolveProfile } from "../../src/saas/deliverableCapabilityProfiles.js";
import {
  isNonGeoFootballReportGoal,
  isThinkingTextPseudoPath,
  shouldBindGeoProfileForDeliverableIntent,
} from "../../src/saas/taskState/deliverableIntent.js";
import {
  buildDeliverableAcceptanceCertificate,
} from "../../src/saas/deliverables/deliverableAcceptanceCertificate.js";
import type { SessionDeliverableManifest } from "../../src/saas/taskState/sessionDeliverableManifest.js";

const WORLDCUP_RAZER_6 = `帮我做【雷蛇】世界杯主题品牌传播 campaign 全案。
标准成果清单：
1. 调研 .md
2. brief .docx
3. 海报
4. 社媒包
5. 草稿编号
6. 监测模板`;

function manifestWithSlots(
  slots: SessionDeliverableManifest["slots"],
  extra?: Partial<SessionDeliverableManifest>,
): SessionDeliverableManifest {
  return {
    manifestVersion: 1,
    goalVersion: 1,
    sessionGoalAnchor: "test",
    slots,
    ...extra,
  };
}

describe("four-line-0717 invariants", () => {
  for (const [caseId, spec] of Object.entries(FOUR_LINE_0717_CASES) as Array<
    [FourLine0717CaseId, (typeof FOUR_LINE_0717_CASES)[FourLine0717CaseId]]
  >) {
    it(`${caseId}: fixture defines required slot count`, () => {
      expect(spec.invariant.requiredSlots).toBeGreaterThan(0);
      expect(spec.userGoalSnippet.length).toBeGreaterThan(8);
    });
  }

  it("campaign-worldcup-razer-6slot: 标准清单优先于产品名世界杯 → 6 槽", () => {
    expect(isBrandCampaignFullCaseGoal(WORLDCUP_RAZER_6)).toBe(true);
    expect(isWorldcupCampaignFullCaseGoal(WORLDCUP_RAZER_6)).toBe(false);
    const slots = resolveCampaignSdmSlots({
      userGoal: WORLDCUP_RAZER_6,
      parseNumberedList: parseNumberedDeliverableList,
    });
    expect(slots).toHaveLength(6);
    expect(slots.some((s) => s.id === "stage_website")).toBe(false);
    expect(slots.some((s) => s.id === "stage_plan_html")).toBe(false);
  });

  it("image-generation-poster-916: 精确 single-image profile", () => {
    const goal = FOUR_LINE_0717_CASES["image-generation-poster-916"].userGoalSnippet;
    const profile = resolveProfile("image-generation", undefined, goal);
    expect(profile.id).toBe("single-image");
    expect(
      profile.executionContract?.requiredDeliverables.some((d) => /canvas-manifest/i.test(String(d))) ?? false,
    ).toBe(false);
  });

  it("argentina-spain-prediction-report: 非 GEO keyword profile", () => {
    const goal = FOUR_LINE_0717_CASES["argentina-spain-prediction-report"].userGoalSnippet;
    expect(isNonGeoFootballReportGoal(goal)).toBe(true);
    expect(shouldBindGeoProfileForDeliverableIntent(goal)).toBe(false);
    const profile = resolveProfile(undefined, undefined, goal);
    expect(profile.id).not.toBe("geo_keyword");
  });

  it("reject pseudo paths from thinking text", () => {
    const inv = FOUR_LINE_0717_CASES["argentina-squad-html-report"].invariant;
    for (const pseudo of inv.rejectPseudoPaths) {
      expect(isThinkingTextPseudoPath(pseudo)).toBe(true);
    }
    expect(isThinkingTextPseudoPath("www.go")).toBe(true);
    expect(isThinkingTextPseudoPath("keywords.md")).toBe(false);
  });

  it("certificate: passed + incomplete slots throws", () => {
    const manifest = manifestWithSlots(buildBrandCampaignSdmSlots());
    expect(() => buildDeliverableAcceptanceCertificate({
      manifest,
      scopeDir: "artifacts/task-test/",
      verifiedPaths: ["artifacts/task-test/research-report.md"],
      missingPaths: ["campaign-brief.docx"],
      acceptanceStatus: "passed",
    })).toThrow(/passed with/);
  });

  it("certificate: complete only when all required slots bound", () => {
    const slots = buildBrandCampaignSdmSlots().slice(0, 1);
    const manifest = manifestWithSlots(slots, { taskArtifactDir: "artifacts/task-x/" });
    const cert = buildDeliverableAcceptanceCertificate({
      manifest,
      scopeDir: "artifacts/task-x/",
      verifiedPaths: ["artifacts/task-x/research-report.md"],
      acceptanceStatus: "needs_repair",
    });
    expect(cert?.completionState).toBe("complete");
    expect(cert?.requiredDone).toBe(cert?.requiredTotal);
    assertCompletionInvariant({
      completionState: cert?.completionState,
      acceptanceStatus: "passed",
      requiredDone: cert?.requiredDone ?? 0,
      requiredTotal: cert?.requiredTotal ?? 0,
    });
  });

  it("forbidPassedWithIncomplete cases are documented", () => {
    const gated = (Object.keys(FOUR_LINE_0717_CASES) as FourLine0717CaseId[])
      .filter((id) => FOUR_LINE_0717_CASES[id].invariant.forbidPassedWithIncomplete);
    expect(gated.length).toBeGreaterThanOrEqual(5);
  });

  it("terminal conversation presentation has zero checking rows", async () => {
    const { presentConversationDeliverableRows } = await import(
      "../../ui/src/shared/presentConversationDeliverableRows.ts"
    );
    const { deliverableContextInvariantViolations } = await import(
      "../../ui/src/shared/deliverableContextInvariants.ts"
    );
    const rows = [
      {
        id: "html",
        label: "HTML 网页",
        path: "artifacts/task-f845/index.html",
        resolvedPath: "artifacts/task-f845/index.html",
        status: "checking" as const,
        previewable: false,
        linkable: false,
      },
    ];
    const presented = presentConversationDeliverableRows(rows, "terminal");
    const checking = presented.filter((row) => row.status === "checking").length;
    expect(checking).toBe(0);
    expect(
      deliverableContextInvariantViolations(presented, "terminal").some((v) => v.id === "I4"),
    ).toBe(false);
  });
});
