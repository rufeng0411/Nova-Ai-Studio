import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compileDeliverableBriefContract,
  resolveEffectiveCompileGoal,
  shouldSkipBriefContractSynthesis,
  userGoalHasMustDeliver,
} from "./deliverableBriefContract.js";
import { compileSessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";

describe("deliverableBriefContract", () => {
  const prevBrief = process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT;
  const prevSdm = process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;

  beforeEach(() => {
    process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = "1";
  });

  afterEach(() => {
    if (prevBrief == null) delete process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT;
    else process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT = prevBrief;
    if (prevSdm == null) delete process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST;
    else process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST = prevSdm;
  });

  it("skips greeting / continue / task-resume", () => {
    expect(shouldSkipBriefContractSynthesis("你好啊")).toBe(true);
    expect(shouldSkipBriefContractSynthesis("继续")).toBe(true);
    expect(shouldSkipBriefContractSynthesis("<task-resume>x</task-resume>")).toBe(true);
  });

  it("does not synthesize over explicit 须交付", () => {
    const goal = "做官网。须交付：landing.html。";
    expect(userGoalHasMustDeliver(goal)).toBe(true);
    const contract = compileDeliverableBriefContract({
      userGoal: goal,
      capabilitySlug: "od-saas-landing",
    });
    expect(contract.userMustDeliverPresent).toBe(true);
    expect(contract.mustDeliverText).toBeUndefined();
    expect(contract.slots.some((s) => /landing\.html/i.test(s.pathHint))).toBe(true);
  });

  it("high-confidence landing synthesizes index.html", () => {
    const contract = compileDeliverableBriefContract({
      userGoal: "为青盏做获客官网单页",
      capabilitySlug: "od-saas-landing",
    });
    expect(contract.confidence).toBe("high");
    expect(contract.mustDeliverText).toMatch(/index\.html/);
  });

  it("enforce overlays compileGoal but SDM keeps user anchor", () => {
    process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT = "enforce";
    const goal = "为青盏做获客官网单页，使用能力官网落地页";
    const resolved = resolveEffectiveCompileGoal({
      userAnchor: goal,
      capabilitySlug: "od-saas-landing",
    });
    expect(resolved.applied).toBe(true);
    expect(resolved.compileGoal).toContain("须交付：");
    expect(resolved.compileGoal).toContain(goal);

    const manifest = compileSessionDeliverableManifest({
      userGoal: goal,
      capabilitySlug: "od-saas-landing",
    });
    expect(manifest).not.toBeNull();
    expect(manifest!.sessionGoalAnchor).not.toMatch(/须交付：/);
    expect(manifest!.sessionGoalAnchor).toContain("获客官网");
    const hints = manifest!.slots.flatMap((s) => s.pathHints ?? (s.pathHint ? [s.pathHint] : []));
    expect(hints.some((h) => /index\.html/i.test(h))).toBe(true);
  });

  it("shadow does not change compileGoal slots vs off for free text without slug map apply", () => {
    process.env.PILOTDECK_DELIVERABLE_BRIEF_CONTRACT = "shadow";
    const goal = "随便聊聊天气";
    const resolved = resolveEffectiveCompileGoal({ userAnchor: goal });
    expect(resolved.applied).toBe(false);
    expect(resolved.compileGoal).toBe(goal);
  });

  it("GEO lite slug does not inflate to 7 slots", () => {
    const contract = compileDeliverableBriefContract({
      userGoal: "做关键词研究",
      capabilitySlug: "geo-keyword-research",
    });
    expect(contract.slots.length).toBeLessThanOrEqual(2);
    expect(contract.slots.some((s) => /keywords\.md/i.test(s.pathHint))).toBe(true);
  });

  it("matrix pattern does not bind flywheel basenames", () => {
    const contract = compileDeliverableBriefContract({
      userGoal: "跑一稿五平台矩阵 one-article-matrix",
    });
    expect(contract.capabilitySlugHint).toBe("one-article-matrix");
    const basenames = contract.slots.map((s) => s.pathHint).join(" ");
    expect(basenames).toMatch(/01-topics\.md/);
    expect(basenames).not.toMatch(/content.flywheel|飞轮/);
  });
});
