/**
 * PD-SAAS-FORK 0731 L0′: success-anchor compile regression (S1–S6).
 * Must not regress distill / must_deliver / campaign core slot structure.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildBrandCampaignSdmSlots,
} from "../../src/saas/deliverables/campaignDeliverableGoal.js";
import {
  hasExplicitLiteMustDeliverOverride,
  isToxicResearchReportAuthorityPack,
  resolveAuthoritativeSdmSlots,
} from "../../src/saas/deliverables/deliverableChecklistAuthority.js";
import { parseNumberedDeliverableList } from "../../src/saas/taskState/sessionDeliverableManifest.js";
import { mergeNumberedSlotsWithProfile } from "../../src/saas/taskState/mergeNumberedSlotsWithProfile.js";
import {
  CASE_75A2313F,
  CASE_F84F63E3,
  CASE_DISTILL_WUXIAOBO,
} from "../fixtures/four-line-0731-research-distill-cases.js";

const S2_GOAL = CASE_75A2313F.goal;
const S3_GOAL =
  "用「活动全案」写【吴裕泰活动，如 618 大促】完整方案：目标、人群、渠道、内容日历与 KPI。须交付：event-plan.md。\n写入系统分配任务目录。";
const S4_GOAL = CASE_F84F63E3.goal;
const S5_GOAL = [
  "用「大模型收录探测」对【Razer blade 26】做十一模型收录分析。",
  "标准成果清单：",
  "1. coverage-matrix.md",
  "2. probe-notes.md",
  "3. summary.md",
].join("\n");
const S6_GOAL =
  "帮我为【Nike 刺客新品】做一套上市全案，按以下阶段一次性规划并执行，每阶段产出存系统分配的任务目录。直接开始做。";

function compile(goal: string, capabilitySlug = "") {
  return resolveAuthoritativeSdmSlots({
    userGoal: goal,
    capabilitySlug,
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });
}

describe("four-line-0731-success-regression L0′", () => {
  const prevDistill = process.env.PILOTDECK_DISTILL_SDM;

  beforeEach(() => {
    process.env.PILOTDECK_DISTILL_SDM = "shadow";
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST ??= "1";
    process.env.PILOTDECK_CHECKLIST_AUTHORITY_TEMPLATES ??= "1";
  });

  afterEach(() => {
    if (prevDistill == null) delete process.env.PILOTDECK_DISTILL_SDM;
    else process.env.PILOTDECK_DISTILL_SDM = prevDistill;
  });

  it("S1 c6255800: distill main slot compile", () => {
    const slots = compile(CASE_DISTILL_WUXIAOBO.goal);
    expect(slots.length).toBe(1);
    expect(slots[0]?.id).toBe("authority_writing-style-distill_1");
    expect(slots[0]?.pathHints).toContain("wuxiaobo-writing-os.md");
  });

  it("S2 19b116f0: must_deliver single md, no research toxic pack", () => {
    expect(hasExplicitLiteMustDeliverOverride(S2_GOAL)).toBe(true);
    const slots = compile(S2_GOAL, CASE_75A2313F.slug);
    expect(slots.map((s) => s.pathHint)).toEqual(["industry-market-report.md"]);
    expect(isToxicResearchReportAuthorityPack(slots)).toBe(false);
  });

  it("S3 54dc633c: must_deliver single md", () => {
    const slots = compile(S3_GOAL);
    expect(slots.length).toBeGreaterThanOrEqual(1);
    expect(slots.some((s) => /01-sources|03-report|report\.docx/i.test(s.pathHint ?? ""))).toBe(false);
    expect(slots[0]?.pathHint).toMatch(/event-plan\.md/i);
  });

  it("S4 484856c2: must_deliver user research md", () => {
    const slots = compile(S4_GOAL, CASE_F84F63E3.slug);
    expect(slots.map((s) => s.pathHint)).toEqual(["user-research-report.md"]);
    expect(isToxicResearchReportAuthorityPack(slots)).toBe(false);
  });

  it("S5 43ddcfc7: enumerated slots compile", () => {
    const slots = compile(S5_GOAL);
    expect(slots.length).toBeGreaterThanOrEqual(3);
    const basenames = slots.flatMap((s) => [s.pathHint, ...(s.pathHints ?? [])]).filter(Boolean);
    expect(basenames.some((h) => /coverage-matrix/i.test(String(h)))).toBe(true);
  });

  it("S6 9bb3d7c1: campaign core slot structure unchanged", () => {
    // Freeze brand campaign template (must not be mutated by this batch).
    const brandIds = buildBrandCampaignSdmSlots().map((s) => s.id);
    expect(brandIds).toEqual([
      "brand_research",
      "brand_brief",
      "brand_visual",
      "brand_platform",
      "brand_draft",
      "brand_monitoring",
    ]);
    // Nike 上市全案 compiles product-launch-full authority pack (7 slots).
    const slots = compile(S6_GOAL);
    expect(slots.length).toBe(7);
    expect(slots.every((s) => /^authority_product-launch-full_/i.test(s.id))).toBe(true);
    expect(slots.map((s) => s.pathHint)).toEqual([
      "research.md",
      "gtm-strategy.md",
      "press-release.docx",
      "landing.html",
      "03-social-slices.md",
      "go-live-checklist.md",
      "draft-status.md",
    ]);
  });
});
